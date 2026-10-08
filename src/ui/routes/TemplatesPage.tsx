import { PlusIcon } from '@primer/octicons-react'
import { Button, ConfirmationDialog, Dialog, Flash, FormControl, Label, Select } from '@primer/react'
import { format, parseISO } from 'date-fns'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApply, useSnapshot } from '../../data/hooks'
import { makeTemplate } from '../../domain/factories'
import { nowISO } from '../../domain/ids'
import { parseOutline, projectToDoc, serializeOutline, type ParseResult } from '../../domain/outline'
import type { Template } from '../../domain/types'
import { Page } from '../components/Page'
import { OutlineEditor } from '../outline/OutlineEditor'
import { outlineStats } from '../outline/outlineStats'
import styles from './TemplatesPage.module.css'

const STARTER_OUTLINE = '# New template\n\n## Phase 1\n- First task [S]\n'

/** Same outline with its `# Name` header replaced. */
function withName(outline: string, name: string): string {
  const header = /^#(?!#)[^\n]*/m
  return header.test(outline) ? outline.replace(header, `# ${name}`) : `# ${name}\n${outline}`
}

function updatedText(iso: string): string {
  try {
    return format(parseISO(iso), 'MMM d, yyyy')
  } catch {
    return ''
  }
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
    <Dialog
      title={state.title}
      subtitle="Templates are copied when a project is created from them; later edits do not change existing projects."
      width="1100px"
      height="large"
      className={styles.dialog}
      onClose={onClose}
      footerButtons={[
        { buttonType: 'normal', content: 'Cancel', onClick: onClose },
        {
          buttonType: 'primary',
          content: 'Save template',
          disabled: blocked || busy,
          onClick: () => onSave(text),
        },
      ]}
    >
      <div className={styles.dialogBody}>
        <OutlineEditor value={text} onChange={setText} onParse={setParsed} label="Template outline" />
        {error && (
          <Flash variant="danger" className={styles.flash}>
            {error}
          </Flash>
        )}
      </div>
    </Dialog>
  )
}

export function TemplatesPage() {
  const navigate = useNavigate()
  const apply = useApply()
  const { data: snapshot, isPending } = useSnapshot()

  const [editor, setEditor] = useState<EditorState | null>(null)
  const [conflict, setConflict] = useState<{ text: string; name: string; existing: Template } | null>(null)
  const [deleting, setDeleting] = useState<Template | null>(null)
  const [projectId, setProjectId] = useState('')
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
    }
  }

  function duplicate(template: Template) {
    const name = `${template.name} (copy)`
    void run({
      kind: 'saveTemplate',
      template: makeTemplate({ name, outline: withName(template.outline, name) }),
    })
  }

  function openFromProject() {
    if (!snapshot || !projectId) return
    try {
      const text = serializeOutline(projectToDoc(projectId, snapshot))
      const name = snapshot.projects.find((p) => p.id === projectId)?.name ?? 'project'
      setFailure(null)
      setEditor({ templateId: null, title: `Save "${name}" as a template`, text })
    } catch (err) {
      setFailure(err instanceof Error ? err.message : 'Could not read that project')
    }
  }

  return (
    <Page
      title="Templates"
      description="Reusable breakdowns. A project created from a template gets its own copy."
      actions={
        <Button
          leadingVisual={PlusIcon}
          onClick={() => setEditor({ templateId: null, title: 'New template', text: STARTER_OUTLINE })}
        >
          New template
        </Button>
      }
    >
      <div className={styles.stack}>
        {failure && !editor && <Flash variant="danger">{failure}</Flash>}

        {isPending ? (
          <p className={styles.muted}>Loading templates…</p>
        ) : rows.length === 0 ? (
          <p className={styles.empty}>
            No templates yet. Create one with &quot;New template&quot;, or save a project as a template below.
          </p>
        ) : (
          <ul className={styles.list} aria-label="Templates">
            {rows.map(({ template, stats }) => (
              <li key={template.id} className={styles.item} aria-label={template.name}>
                <div className={styles.info}>
                  <div className={styles.name}>{template.name}</div>
                  <div className={styles.meta}>
                    {stats ? (
                      <>
                        {stats.tasks} {stats.tasks === 1 ? 'task' : 'tasks'} · {stats.milestones}{' '}
                        {stats.milestones === 1 ? 'milestone' : 'milestones'}
                      </>
                    ) : (
                      <Label variant="danger">Outline has errors</Label>
                    )}
                    {updatedText(template.updatedAt) && <> · Updated {updatedText(template.updatedAt)}</>}
                  </div>
                </div>
                <div className={styles.actions}>
                  <Button
                    variant="primary"
                    size="small"
                    disabled={!stats}
                    onClick={() =>
                      navigate('/import', { state: { outline: template.outline, templateId: template.id } })
                    }
                  >
                    New project from template
                  </Button>
                  <Button
                    size="small"
                    onClick={() =>
                      setEditor({
                        templateId: template.id,
                        title: `Edit "${template.name}"`,
                        text: template.outline,
                      })
                    }
                  >
                    Edit
                  </Button>
                  <Button size="small" disabled={busy} onClick={() => duplicate(template)}>
                    Duplicate
                  </Button>
                  <Button size="small" variant="danger" onClick={() => setDeleting(template)}>
                    Delete
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <section className={styles.fromProject} aria-labelledby="from-project-heading">
          <h2 id="from-project-heading" className={styles.heading}>
            Save a project as template
          </h2>
          <div className={styles.fromProjectRow}>
            <FormControl className={styles.projectSelect}>
              <FormControl.Label>Project</FormControl.Label>
              <Select block value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                <Select.Option value="">Choose a project…</Select.Option>
                {projects.map((p) => (
                  <Select.Option key={p.id} value={p.id}>
                    {p.name}
                  </Select.Option>
                ))}
              </Select>
            </FormControl>
            <Button disabled={!projectId} onClick={openFromProject}>
              Save as template
            </Button>
          </div>
        </section>
      </div>

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

      {conflict && (
        <ConfirmationDialog
          title={`A template named "${conflict.name}" already exists`}
          confirmButtonContent="Replace"
          cancelButtonContent="Save as new"
          onClose={(gesture) => {
            if (gesture === 'confirm') void saveFromEditor(conflict.text, 'replace', conflict.existing)
            else if (gesture === 'cancel') void saveFromEditor(conflict.text, 'new')
            else setConflict(null)
          }}
        >
          Replace the existing template with this one, or keep both and save this one as a new template?
        </ConfirmationDialog>
      )}

      {deleting && (
        <ConfirmationDialog
          title={`Delete "${deleting.name}"?`}
          confirmButtonContent="Delete"
          confirmButtonType="danger"
          onClose={(gesture) => {
            const target = deleting
            setDeleting(null)
            if (gesture === 'confirm') void run({ kind: 'deleteTemplate', id: target.id })
          }}
        >
          Projects already created from this template are not affected.
        </ConfirmationDialog>
      )}
    </Page>
  )
}
