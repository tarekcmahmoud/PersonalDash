import { CheckIcon, CopyIcon } from '@primer/octicons-react'
import { Button, Details, Flash, FormControl, Select, Textarea, TextInput } from '@primer/react'
import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useApply, useSnapshot } from '../../data/hooks'
import { makeProject, makeTemplate } from '../../domain/factories'
import { activeProjectCount, isOverActiveCap } from '../../domain/health'
import { docToBundle, parseOutline, type OutlineDoc, type ParseResult } from '../../domain/outline'
import type { DateKind, ProjectStatus } from '../../domain/types'
import { Page } from '../components/Page'
import { BREAKDOWN_PROMPT, copyText } from '../outline/breakdownPrompt'
import { OutlineEditor } from '../outline/OutlineEditor'
import styles from './ImportPage.module.css'

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
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])

  async function onClick() {
    const ok = await copyText(BREAKDOWN_PROMPT)
    setState(ok ? 'copied' : 'failed')
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setState('idle'), 2500)
  }

  return (
    <span className={styles.copyWrap}>
      <Button variant="invisible" size="small" leadingVisual={CopyIcon} onClick={onClick}>
        Copy the LLM prompt
      </Button>
      <span className={styles.copyStatus} role="status">
        {state === 'copied' && (
          <>
            <CheckIcon size={14} /> Copied
          </>
        )}
        {state === 'failed' && 'Could not copy. Select the prompt in docs/breakdown-prompt.md instead.'}
      </span>
    </span>
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
    >
      <div className={styles.stack}>
        <p className={styles.help}>
          No breakdown yet? Ask an LLM for one, then paste its answer below. <CopyPromptButton />
        </p>
        <Details className={styles.cheatsheet}>
          <Details.Summary>Format cheatsheet</Details.Summary>
          <pre className={styles.code}>{CHEATSHEET}</pre>
          <p className={styles.small}>
            Sizes: S about 1h, M about half a day, L about a full day, XL too big or unclear (split it before
            it can be scheduled). Tasks follow the previous one unless you use <code>after:</code>.
          </p>
        </Details>

        <OutlineEditor value={text} onChange={setText} onParse={setParsed} />

        <section className={styles.objective} aria-labelledby="objective-heading">
          <h2 id="objective-heading" className={styles.heading}>
            Objective
          </h2>
          <div className={styles.fields}>
            <FormControl required className={styles.wide}>
              <FormControl.Label>Project name</FormControl.Label>
              <TextInput
                block
                value={values.name}
                onChange={(e) => setField('name', e.target.value)}
                onBlur={() => touch('name')}
                validationStatus={errorFor('name') ? 'error' : undefined}
              />
              {errorFor('name') && (
                <FormControl.Validation variant="error">{errors.name}</FormControl.Validation>
              )}
            </FormControl>

            <FormControl required className={styles.wide}>
              <FormControl.Label>Outcome</FormControl.Label>
              <Textarea
                block
                rows={2}
                resize="vertical"
                placeholder="Done when …"
                value={values.outcome}
                onChange={(e) => setField('outcome', e.target.value)}
                onBlur={() => touch('outcome')}
                validationStatus={errorFor('outcome') ? 'error' : undefined}
              />
              {errorFor('outcome') && (
                <FormControl.Validation variant="error">{errors.outcome}</FormControl.Validation>
              )}
            </FormControl>

            <FormControl required>
              <FormControl.Label>Target date</FormControl.Label>
              <TextInput
                block
                type="date"
                value={values.targetDate}
                onChange={(e) => setField('targetDate', e.target.value)}
                onBlur={() => touch('targetDate')}
                validationStatus={errorFor('targetDate') ? 'error' : undefined}
              />
              {errorFor('targetDate') && (
                <FormControl.Validation variant="error">{errors.targetDate}</FormControl.Validation>
              )}
            </FormControl>

            <FormControl>
              <FormControl.Label>Date type</FormControl.Label>
              <Select
                block
                value={values.dateKind}
                onChange={(e) => setField('dateKind', e.target.value as DateKind)}
              >
                <Select.Option value="soft">Soft target</Select.Option>
                <Select.Option value="hard">Hard deadline</Select.Option>
              </Select>
            </FormControl>

            <FormControl>
              <FormControl.Label>Weekly minimum (tasks)</FormControl.Label>
              <TextInput
                block
                type="number"
                inputMode="numeric"
                min={1}
                placeholder="Optional"
                value={values.weeklyMin}
                onChange={(e) => setField('weeklyMin', e.target.value)}
                onBlur={() => touch('weeklyMin')}
                validationStatus={errorFor('weeklyMin') ? 'error' : undefined}
              />
              {errorFor('weeklyMin') && (
                <FormControl.Validation variant="error">{errors.weeklyMin}</FormControl.Validation>
              )}
            </FormControl>

            <FormControl>
              <FormControl.Label>Status</FormControl.Label>
              <Select
                block
                value={values.status}
                onChange={(e) => setField('status', e.target.value as ProjectStatus)}
              >
                <Select.Option value="active">Active</Select.Option>
                <Select.Option value="on_hold">On hold</Select.Option>
              </Select>
            </FormControl>
          </div>

          {overCap && snapshot && (
            <Flash variant="warning" className={styles.flash}>
              You already have {activeCount} active {activeCount === 1 ? 'project' : 'projects'} (your limit
              is {snapshot.settings.activeCap}). Another active project spreads your time thinner. Consider
              putting this one on hold.{' '}
              <Button size="small" onClick={() => setField('status', 'on_hold')}>
                Put on hold
              </Button>
            </Flash>
          )}
          {failure && (
            <Flash variant="danger" className={styles.flash}>
              {failure}
            </Flash>
          )}

          <div className={styles.actions}>
            <Button variant="primary" disabled={!doc || hasErrors || busy} onClick={onCreate}>
              Create project
            </Button>
            <Button disabled={!doc || hasErrors || busy} onClick={onSaveTemplate}>
              Save as template instead
            </Button>
          </div>
          {hasErrors && <p className={styles.small}>Fix the errors above to continue.</p>}
        </section>
      </div>
    </Page>
  )
}

export function ImportPage() {
  const location = useLocation()
  // Remount when navigated to again with new router state, so the prefill applies.
  return <ImportForm key={location.key} initial={readState(location.state)} />
}
