import { format, getYear, parseISO } from 'date-fns'
import { MoreHorizontal } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useApply, useSnapshot } from '../../data/hooks'
import { makeTemplate } from '../../domain/factories'
import { nowISO } from '../../domain/ids'
import { parseOutline, projectToDoc, serializeOutline, type ParseResult } from '../../domain/outline'
import type { Template } from '../../domain/types'
import { Page } from '../components/Page'
import { OutlineEditor } from '../outline/OutlineEditor'
import { outlineStats, type OutlineStats } from '../outline/outlineStats'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const STARTER_OUTLINE = '# New template\n\n## Phase 1\n- First task [S]\n'

/** Same outline with its `# Name` header replaced. */
function withName(outline: string, name: string): string {
  const header = /^#(?!#)[^\n]*/m
  return header.test(outline) ? outline.replace(header, `# ${name}`) : `# ${name}\n${outline}`
}

/** "Oct 2" (with the year when it is not the current one). */
function updatedText(iso: string): string {
  try {
    const date = parseISO(iso)
    return format(date, getYear(date) === new Date().getFullYear() ? 'MMM d' : 'MMM d, yyyy')
  } catch {
    return ''
  }
}

const plural = (n: number, one: string) => `${n} ${n === 1 ? one : `${one}s`}`

function statsText(stats: OutlineStats): string {
  return `${plural(stats.milestones, 'workstream')} · ${plural(stats.tasks, 'task')}`
}

interface EditorState {
  /** Existing template being edited; null for a new one. */
  templateId: string | null
  title: string
  text: string
}

function TemplateEditorDialog({
  state,
  onSave,
  onClose,
  error,
  busy,
}: {
  state: EditorState
  onSave: (text: string) => void
  onClose: () => void
  error: string | null
  busy: boolean
}) {
  const [text, setText] = useState(state.text)
  const [parsed, setParsed] = useState<ParseResult | null>(null)
  const blocked = !parsed?.doc

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-sm:top-0 max-sm:left-0 max-sm:h-dvh max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none max-sm:p-4 sm:h-[88vh] sm:max-w-[1100px] grid-rows-[auto_minmax(0,1fr)_auto]"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader className="pr-8 text-left">
          <DialogTitle>{state.title}</DialogTitle>
          <DialogDescription>
            Templates are copied when a project is created from them; later edits do not change existing
            projects.
          </DialogDescription>
        </DialogHeader>
        <div className="-mx-1 min-h-0 overflow-y-auto px-1">
          <OutlineEditor value={text} onChange={setText} onParse={setParsed} label="Template outline" />
          {error && (
            <p className="mt-3 text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
        </div>
        <DialogFooter className="max-sm:flex-row max-sm:justify-end">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={blocked || busy} onClick={() => onSave(text)}>
            Save template
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ProjectPickerDialog({
  projects,
  onPick,
  onClose,
}: {
  projects: { id: string; name: string }[]
  onPick: (projectId: string) => void
  onClose: () => void
}) {
  const [projectId, setProjectId] = useState('')
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save a project as template</DialogTitle>
          <DialogDescription>Its workstreams and tasks become a reusable outline.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-1.5">
          <Label htmlFor="template-project">Project</Label>
          <Select value={projectId} onValueChange={setProjectId}>
            <SelectTrigger id="template-project" className="w-full">
              <SelectValue placeholder="Choose a project…" />
            </SelectTrigger>
            <SelectContent>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!projectId} onClick={() => onPick(projectId)}>
            Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function TemplatesPage() {
  const navigate = useNavigate()
  const apply = useApply()
  const { data: snapshot, isPending } = useSnapshot()

  const [editor, setEditor] = useState<EditorState | null>(null)
  const [picking, setPicking] = useState(false)
  const [conflict, setConflict] = useState<{ text: string; name: string; existing: Template } | null>(null)
  const [deleting, setDeleting] = useState<Template | null>(null)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)

  const templates = useMemo(() => snapshot?.templates ?? [], [snapshot?.templates])
  const rows = useMemo(
    () =>
      templates.map((template) => {
        const { doc } = parseOutline(template.outline)
        return { template, stats: doc ? outlineStats(doc) : null }
      }),
    [templates],
  )
  const projects = (snapshot?.projects ?? []).filter((p) => !p.isSystem)

  async function run(change: Parameters<typeof apply>[0]): Promise<boolean> {
    setBusy(true)
    setFailure(null)
    try {
      await apply(change)
      return true
    } catch (err) {
      setFailure(err instanceof Error ? err.message : 'Something went wrong')
      return false
    } finally {
      setBusy(false)
    }
  }

  async function saveFromEditor(text: string, mode: 'auto' | 'replace' | 'new', replaceTarget?: Template) {
    const { doc } = parseOutline(text)
    if (!doc || !editor) return
    let template: Template
    if (editor.templateId) {
      const existing = templates.find((t) => t.id === editor.templateId)
      template = makeTemplate({ ...existing, name: doc.name, outline: text, updatedAt: nowISO() })
    } else {
      const same = templates.find((t) => t.name.trim().toLowerCase() === doc.name.trim().toLowerCase())
      if (mode === 'auto' && same) {
        setConflict({ text, name: doc.name, existing: same })
        return
      }
      template =
        mode === 'replace' && replaceTarget
          ? { ...replaceTarget, name: doc.name, outline: text, updatedAt: nowISO() }
          : makeTemplate({ name: doc.name, outline: text })
    }
    if (await run({ kind: 'saveTemplate', template })) {
      setEditor(null)
      setConflict(null)
      toast.success('Template saved')
    }
  }

  function duplicate(template: Template) {
    const name = `${template.name} (copy)`
    void run({
      kind: 'saveTemplate',
      template: makeTemplate({ name, outline: withName(template.outline, name) }),
    }).then((ok) => ok && toast.success('Template duplicated'))
  }

  function openFromProject(projectId: string) {
    if (!snapshot) return
    try {
      const text = serializeOutline(projectToDoc(projectId, snapshot))
      const name = snapshot.projects.find((p) => p.id === projectId)?.name ?? 'project'
      setFailure(null)
      setPicking(false)
      setEditor({ templateId: null, title: `Save "${name}" as a template`, text })
    } catch (err) {
      setPicking(false)
      setFailure(err instanceof Error ? err.message : 'Could not read that project')
    }
  }

  return (
    <Page
      title="Templates"
      description="Reusable breakdowns. A project created from a template gets its own copy."
      actions={
        <>
          <Button
            onClick={() => setEditor({ templateId: null, title: 'New template', text: STARTER_OUTLINE })}
          >
            New template
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="More actions">
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setPicking(true)}>
                Save a project as template…
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      }
    >
      {failure && !editor && (
        <p className="mb-4 text-sm text-destructive" role="alert">
          {failure}
        </p>
      )}

      {isPending ? (
        <p className="text-sm text-muted-foreground">Loading templates…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No templates yet. Create one with &quot;New template&quot;, or save a project as a template from the
          … menu.
        </p>
      ) : (
        <Card size="sm" className="py-2">
          <CardContent>
            <ul className="divide-y" aria-label="Templates">
              {rows.map(({ template, stats }) => (
                <li
                  key={template.id}
                  aria-label={template.name}
                  className="group flex min-h-14 items-center gap-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{template.name}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {stats ? (
                        statsText(stats)
                      ) : (
                        <span className="text-destructive">Outline has errors</span>
                      )}
                      {updatedText(template.updatedAt) && <> · updated {updatedText(template.updatedAt)}</>}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1 opacity-100 transition-opacity md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100 md:has-[[data-state=open]]:opacity-100 [@media(hover:none)]:opacity-100">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!stats}
                      onClick={() =>
                        navigate('/import', { state: { outline: template.outline, templateId: template.id } })
                      }
                    >
                      Use
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`More actions for ${template.name}`}
                          className="data-[state=open]:bg-accent"
                        >
                          <MoreHorizontal />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onSelect={() =>
                            setEditor({
                              templateId: template.id,
                              title: `Edit "${template.name}"`,
                              text: template.outline,
                            })
                          }
                        >
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem disabled={busy} onSelect={() => duplicate(template)}>
                          Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(template)}>
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {picking && (
        <ProjectPickerDialog projects={projects} onPick={openFromProject} onClose={() => setPicking(false)} />
      )}

      {editor && (
        <TemplateEditorDialog
          key={`${editor.templateId ?? 'new'}-${editor.title}`}
          state={editor}
          busy={busy}
          error={failure}
          onClose={() => setEditor(null)}
          onSave={(text) => void saveFromEditor(text, 'auto')}
        />
      )}

      <AlertDialog open={!!conflict} onOpenChange={(open) => !open && setConflict(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>A template named &quot;{conflict?.name}&quot; already exists</AlertDialogTitle>
            <AlertDialogDescription>
              Replace the existing template with this one, or keep both and save this one as a new template?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => conflict && void saveFromEditor(conflict.text, 'new')}>
              Save as new
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => conflict && void saveFromEditor(conflict.text, 'replace', conflict.existing)}
            >
              Replace
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &quot;{deleting?.name}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              Projects already created from this template are not affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                const target = deleting
                if (target) void run({ kind: 'deleteTemplate', id: target.id })
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Page>
  )
}
