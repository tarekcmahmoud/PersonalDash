import { Copy, FileText } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useApply, useSnapshot } from '../../data/hooks'
import { makeProject, makeTemplate } from '../../domain/factories'
import { activeProjectCount, isOverActiveCap } from '../../domain/health'
import { docToBundle, parseOutline, type OutlineDoc, type ParseResult } from '../../domain/outline'
import type { DateKind, ProjectStatus } from '../../domain/types'
import { CardSection, Page } from '../components/Page'
import { BREAKDOWN_PROMPT, copyText } from '../outline/breakdownPrompt'
import { OutlineEditor } from '../outline/OutlineEditor'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

/** Router state accepted by /import: `navigate('/import', { state: { outline, templateId } })`. */
export interface ImportLocationState {
  outline?: string
  templateId?: string
}

function readState(state: unknown): ImportLocationState {
  if (typeof state !== 'object' || state === null) return {}
  const s = state as Record<string, unknown>
  return {
    outline: typeof s.outline === 'string' ? s.outline : undefined,
    templateId: typeof s.templateId === 'string' ? s.templateId : undefined,
  }
}

const CHEATSHEET = `# Project name
outcome: Done when …
target: 2026-12-15 hard        (hard or soft; soft if omitted)
min-per-week: 2                (optional)

- Task before any milestone [S]

## Milestone name
target: 2026-10-31 soft
- Task title [M] #key after:#otherkey
  done: what makes this task finished
  note: any detail
  - [ ] checklist item

// a comment`

interface FormValues {
  name: string
  outcome: string
  targetDate: string
  dateKind: DateKind
  weeklyMin: string
  status: ProjectStatus
}

function valuesFromDoc(doc: OutlineDoc | null): FormValues {
  return {
    name: doc?.name ?? '',
    outcome: doc?.outcome ?? '',
    targetDate: doc?.targetDate ?? '',
    dateKind: doc?.dateKind ?? 'soft',
    weeklyMin: doc?.weeklyMin != null ? String(doc.weeklyMin) : '',
    status: 'active',
  }
}

type FieldErrors = Partial<Record<'name' | 'outcome' | 'targetDate' | 'weeklyMin', string>>

function validate(v: FormValues): FieldErrors {
  const errors: FieldErrors = {}
  if (v.name.trim() === '') errors.name = 'Enter a project name'
  if (v.outcome.trim() === '') errors.outcome = 'Describe the outcome: what is true when this is done?'
  if (v.targetDate === '') errors.targetDate = 'Pick a target date'
  else if (!/^\d{4}-\d{2}-\d{2}$/.test(v.targetDate)) errors.targetDate = 'Use a valid date'
  if (v.weeklyMin.trim() !== '' && !(/^\d+$/.test(v.weeklyMin.trim()) && Number(v.weeklyMin) >= 1)) {
    errors.weeklyMin = 'Use a whole number of at least 1, or leave empty'
  }
  return errors
}

function CopyPromptButton() {
  async function onClick() {
    const ok = await copyText(BREAKDOWN_PROMPT)
    if (ok) toast.success('Prompt copied')
    else toast.error('Could not copy. Select the prompt in docs/breakdown-prompt.md instead.')
  }
  return (
    <Button variant="ghost" size="sm" onClick={onClick}>
      <Copy />
      Copy LLM prompt
    </Button>
  )
}

function FormatCheatsheet() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm">
          <FileText />
          Format
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(34rem,calc(100vw-2rem))] text-sm">
        <pre className="overflow-x-auto font-mono text-xs leading-5 text-muted-foreground">{CHEATSHEET}</pre>
        <p className="mt-3 text-xs text-muted-foreground">
          Sizes: S about 1h, M about half a day, L about a full day, XL too big or unclear (split it before it
          can be scheduled). Tasks follow the previous one unless you use{' '}
          <code className="font-mono">after:</code>.
        </p>
      </PopoverContent>
    </Popover>
  )
}

function ImportForm({ initial }: { initial: ImportLocationState }) {
  const navigate = useNavigate()
  const apply = useApply()
  const { data: snapshot } = useSnapshot()

  const [text, setText] = useState(initial.outline ?? '')
  const [parsed, setParsed] = useState<ParseResult | null>(null)
  const doc = parsed?.doc ?? null
  const hasErrors = parsed ? parsed.issues.some((i) => i.severity === 'error') : false

  // Fields the user has edited; everything else follows the parsed outline.
  const [edited, setEdited] = useState<Partial<FormValues>>({})
  const [touched, setTouched] = useState<ReadonlySet<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)

  const values: FormValues = { ...valuesFromDoc(doc), ...edited }
  const errors = validate(values)
  const setField = <K extends keyof FormValues>(key: K, value: FormValues[K]) =>
    setEdited((prev) => ({ ...prev, [key]: value }))
  const touch = (key: string) => setTouched((prev) => new Set(prev).add(key))
  const errorFor = (key: keyof FieldErrors) => (touched.has(key) ? errors[key] : undefined)

  const overCap =
    snapshot !== undefined &&
    values.status === 'active' &&
    isOverActiveCap({
      projects: [...snapshot.projects, makeProject({ name: 'New project', status: 'active' })],
      settings: snapshot.settings,
    })

  async function onCreate() {
    setTouched(new Set(['name', 'outcome', 'targetDate', 'weeklyMin']))
    const fresh = parseOutline(text) // the debounced preview may lag a few keystrokes behind
    if (!fresh.doc || !snapshot || Object.keys(errors).length > 0) return
    const rank = Math.max(0, ...snapshot.projects.filter((p) => !p.isSystem).map((p) => p.rank)) + 1
    const bundle = docToBundle(fresh.doc, {
      rank,
      project: {
        name: values.name.trim(),
        outcome: values.outcome.trim(),
        targetDate: values.targetDate,
        dateKind: values.dateKind,
        weeklyMin: values.weeklyMin.trim() === '' ? null : Number(values.weeklyMin),
        status: values.status,
      },
    })
    setBusy(true)
    setFailure(null)
    try {
      await apply({ kind: 'insertBundle', bundle })
      const project = bundle.projects[0]
      toast.success('Project created')
      if (project) navigate(`/projects/${project.id}`)
    } catch (err) {
      setFailure(err instanceof Error ? err.message : 'Could not create the project')
      setBusy(false)
    }
  }

  async function onSaveTemplate() {
    const fresh = parseOutline(text)
    if (!fresh.doc || !snapshot) return
    const existing = initial.templateId
      ? snapshot.templates.find((t) => t.id === initial.templateId)
      : undefined
    const template = makeTemplate({
      ...(existing ? { id: existing.id } : {}),
      name: fresh.doc.name,
      outline: text,
    })
    setBusy(true)
    setFailure(null)
    try {
      await apply({ kind: 'saveTemplate', template })
      toast.success('Template saved')
      navigate('/templates')
    } catch (err) {
      setFailure(err instanceof Error ? err.message : 'Could not save the template')
      setBusy(false)
    }
  }

  const activeCount = snapshot ? activeProjectCount(snapshot.projects) : 0

  return (
    <Page
      wide
      title="Import breakdown"
      description="Paste a breakdown in the outline format, check the preview, then create the project."
      actions={
        <>
          <CopyPromptButton />
          <FormatCheatsheet />
        </>
      }
    >
      <OutlineEditor
        value={text}
        onChange={setText}
        onParse={setParsed}
        previewClassName="lg:max-h-[34rem] lg:overflow-y-auto"
        previewCard
      />

      <CardSection title="Objective" className="mt-4">
        <div>
          <div className="grid gap-x-4 gap-y-4 sm:grid-cols-2 xl:grid-cols-4">
            <Field id="project-name" label="Project name" error={errorFor('name')} className="sm:col-span-2">
              <Input
                id="project-name"
                value={values.name}
                aria-invalid={errorFor('name') ? true : undefined}
                onChange={(e) => setField('name', e.target.value)}
                onBlur={() => touch('name')}
              />
            </Field>

            <Field id="outcome" label="Outcome" error={errorFor('outcome')} className="sm:col-span-2">
              <Textarea
                id="outcome"
                rows={2}
                className="resize-y"
                placeholder="Done when …"
                value={values.outcome}
                aria-invalid={errorFor('outcome') ? true : undefined}
                onChange={(e) => setField('outcome', e.target.value)}
                onBlur={() => touch('outcome')}
              />
            </Field>

            <Field id="target-date" label="Target date" error={errorFor('targetDate')}>
              <Input
                id="target-date"
                type="date"
                value={values.targetDate}
                aria-invalid={errorFor('targetDate') ? true : undefined}
                onChange={(e) => setField('targetDate', e.target.value)}
                onBlur={() => touch('targetDate')}
              />
            </Field>

            <div className="grid gap-1.5">
              <Label id="date-kind-label">Date type</Label>
              <ToggleGroup
                type="single"
                variant="outline"
                aria-label="Date type"
                value={values.dateKind}
                onValueChange={(v) => {
                  if (v === 'soft' || v === 'hard') setField('dateKind', v)
                }}
              >
                <ToggleGroupItem value="soft">Soft target</ToggleGroupItem>
                <ToggleGroupItem value="hard">Hard deadline</ToggleGroupItem>
              </ToggleGroup>
            </div>

            <Field id="weekly-min" label="Weekly minimum (tasks)" error={errorFor('weeklyMin')}>
              <Input
                id="weekly-min"
                type="number"
                inputMode="numeric"
                min={1}
                placeholder="Optional"
                value={values.weeklyMin}
                aria-invalid={errorFor('weeklyMin') ? true : undefined}
                onChange={(e) => setField('weeklyMin', e.target.value)}
                onBlur={() => touch('weeklyMin')}
              />
            </Field>

            <div className="grid gap-1.5">
              <Label htmlFor="status">Status</Label>
              <Select value={values.status} onValueChange={(v) => setField('status', v as ProjectStatus)}>
                <SelectTrigger id="status" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="on_hold">On hold</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {overCap && snapshot && (
            <p className="mt-4 text-sm text-warning">
              You already have {activeCount} active {activeCount === 1 ? 'project' : 'projects'} (limit{' '}
              {snapshot.settings.activeCap}); another one spreads your time thinner.{' '}
              <Button
                variant="link"
                className="h-auto p-0 text-sm text-warning"
                onClick={() => setField('status', 'on_hold')}
              >
                Put on hold instead
              </Button>
            </p>
          )}
          {failure && (
            <p className="mt-4 text-sm text-destructive" role="alert">
              {failure}
            </p>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-2">
            <Button disabled={!doc || hasErrors || busy} onClick={onCreate}>
              Create project
            </Button>
            <Button variant="ghost" disabled={!doc || hasErrors || busy} onClick={onSaveTemplate}>
              Save as template instead
            </Button>
          </div>
          {hasErrors && (
            <p className="mt-2 text-xs text-muted-foreground">Fix the errors above to continue.</p>
          )}
        </div>
      </CardSection>
    </Page>
  )
}

/** Label + control + inline validation message. */
function Field({
  id,
  label,
  error,
  className,
  children,
}: {
  id: string
  label: string
  error?: string
  className?: string
  children: ReactNode
}) {
  return (
    <div className={cn('grid content-start gap-1.5', className)}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}

export function ImportPage() {
  const location = useLocation()
  // Remount when navigated to again with new router state, so the prefill applies.
  return <ImportForm key={location.key} initial={readState(location.state)} />
}
