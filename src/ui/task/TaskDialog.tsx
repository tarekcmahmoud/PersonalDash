import {
  Button,
  Dialog,
  FormControl,
  SegmentedControl,
  Select,
  Textarea,
  TextInput,
  useConfirm,
} from '@primer/react'
import { format, parseISO } from 'date-fns'
import { useMemo, useState, type ReactNode } from 'react'
import { useApply, useSnapshot } from '../../data/hooks'
import { nowISO } from '../../domain/ids'
import { explicitBlockerIds } from '../../domain/order'
import { completeTask, reopenTask } from '../../domain/review'
import type { ChecklistItem, ID, ISODate, Task, TaskSize, TaskStatus } from '../../domain/types'
import { endPosition } from '../project/ordering'
import { BlockedByEditor } from './BlockedByEditor'
import { ChecklistEditor } from './ChecklistEditor'
import { SplitTask } from './SplitTask'
import styles from './TaskDialog.module.css'

const SIZES: TaskSize[] = ['S', 'M', 'L', 'XL']
const sameIds = (a: ID[], b: ID[]) => a.length === b.length && a.every((id) => b.includes(id))

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={styles.section}>
      <h3 className={styles.sectionTitle}>{title}</h3>
      {children}
    </section>
  )
}

/** Edit one task: details, location, status/waiting, checklist, blockers, planning, split and delete. */
export function TaskDialog({ task, onClose }: { task: Task; onClose: () => void }) {
  const { data } = useSnapshot()
  const apply = useApply()
  const confirm = useConfirm()

  const savedChecklist = useMemo(
    () => (data?.checklist ?? []).filter((c) => c.taskId === task.id).sort((a, b) => a.position - b.position),
    [data?.checklist, task.id],
  )
  const savedBlockers = useMemo(
    () => explicitBlockerIds(task.id, data?.dependencies ?? []),
    [data?.dependencies, task.id],
  )

  const [title, setTitle] = useState(task.title)
  const [size, setSize] = useState<TaskSize>(task.size)
  const [doneWhen, setDoneWhen] = useState(task.doneWhen)
  const [notes, setNotes] = useState(task.notes)
  const [projectId, setProjectId] = useState<ID | null>(task.projectId)
  const [milestoneId, setMilestoneId] = useState<ID | null>(task.milestoneId)
  const [status, setStatus] = useState<TaskStatus>(task.status)
  const [waitingOn, setWaitingOn] = useState(task.waitingOn ?? '')
  const [followUpDate, setFollowUpDate] = useState<ISODate>(task.followUpDate ?? '')
  const [unplanned, setUnplanned] = useState(false)
  const [checklist, setChecklist] = useState<ChecklistItem[]>(savedChecklist)
  const [blockedBy, setBlockedBy] = useState<ID[]>(savedBlockers)
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)

  if (!data) return null

  const projects = data.projects
    .filter((p) => p.status !== 'done' || p.id === task.projectId)
    .sort((a, b) => a.rank - b.rank)
  const milestones = data.milestones
    .filter((m) => m.projectId === projectId)
    .sort((a, b) => a.position - b.position)
  const projectName = projects.find((p) => p.id === task.projectId)?.name
  // Blockers only make sense inside the chosen project.
  const taskById = new Map(data.tasks.map((t) => [t.id, t]))
  const effectiveBlockers = projectId
    ? blockedBy.filter((id) => taskById.get(id)?.projectId === projectId)
    : []

  const titleError = submitted && !title.trim() ? 'A task needs a title.' : null
  const planned = !unplanned && task.weekStart !== null

  const onProjectChange = (value: string) => {
    setProjectId(value === '' ? null : value)
    setMilestoneId(null)
  }

  const save = async () => {
    setSubmitted(true)
    if (!title.trim() || saving) return
    setSaving(true)
    try {
      let statusPatch: Partial<Task> = {}
      if (status !== task.status) {
        statusPatch =
          status === 'done'
            ? completeTask(task, nowISO())
            : { ...(task.status === 'done' ? reopenTask(task) : {}), status }
      }
      const moved = projectId !== task.projectId || milestoneId !== task.milestoneId
      const patch: Partial<Task> = {
        title: title.trim(),
        size,
        doneWhen: doneWhen.trim(),
        notes,
        projectId,
        milestoneId,
        ...(moved ? { position: endPosition(data.tasks, projectId, milestoneId) } : {}),
        ...statusPatch,
        waitingOn: status === 'waiting' ? waitingOn.trim() || null : null,
        followUpDate: status === 'waiting' ? followUpDate || null : null,
        ...(unplanned
          ? {
              weekStart: null,
              pinnedDay: null,
              gcalDirty: task.gcalEventId ? true : task.gcalDirty,
            }
          : {}),
      }
      await apply({ kind: 'saveTasks', tasks: [{ ...task, ...patch }] })

      const items = checklist.map((c, i) => ({ ...c, text: c.text.trim() || c.text, position: i }))
      const keptIds = new Set(items.map((c) => c.id))
      for (const old of savedChecklist) {
        if (!keptIds.has(old.id)) await apply({ kind: 'deleteChecklistItem', id: old.id })
      }
      const changedItems = items.filter((c) => {
        const old = savedChecklist.find((o) => o.id === c.id)
        return !old || old.text !== c.text || old.done !== c.done || old.position !== c.position
      })
      if (changedItems.length > 0) await apply({ kind: 'saveChecklist', items: changedItems })

      if (!sameIds(effectiveBlockers, savedBlockers)) {
        await apply({ kind: 'setDependencies', taskId: task.id, blockedByIds: effectiveBlockers })
      }
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    const ok = await confirm({
      title: 'Delete this task?',
      content: `“${task.title}” and its checklist will be deleted. This cannot be undone.`,
      confirmButtonContent: 'Delete task',
      confirmButtonType: 'danger',
    })
    if (!ok) return
    await apply({ kind: 'deleteTask', id: task.id })
    onClose()
  }

  return (
    <Dialog
      title="Edit task"
      subtitle={projectName ?? 'Inbox'}
      width="large"
      position={{ narrow: 'fullscreen', regular: 'center' }}
      onClose={onClose}
      footerButtons={[
        { content: 'Cancel', onClick: onClose },
        { content: 'Save', buttonType: 'primary', onClick: () => void save() },
      ]}
    >
      <div className={styles.body}>
        <FormControl required>
          <FormControl.Label>Title</FormControl.Label>
          <TextInput
            block
            value={title}
            validationStatus={titleError ? 'error' : undefined}
            onChange={(e) => setTitle(e.target.value)}
          />
          {titleError && <FormControl.Validation variant="error">{titleError}</FormControl.Validation>}
        </FormControl>

        <div className={styles.field}>
          <span id="task-size-label" className={styles.fieldLabel}>
            Size
          </span>
          <SegmentedControl aria-labelledby="task-size-label" onChange={(i) => setSize(SIZES[i] ?? 'M')}>
            {SIZES.map((s) => (
              <SegmentedControl.Button key={s} selected={size === s}>
                {s}
              </SegmentedControl.Button>
            ))}
          </SegmentedControl>
          <span className={styles.hint}>
            {size === 'XL'
              ? 'XL = too big or unclear. Split it into smaller tasks before scheduling.'
              : 'S ≈ 1h · M ≈ half a day · L ≈ a full day. XL = too big or unclear; split before scheduling.'}
          </span>
        </div>

        <FormControl>
          <FormControl.Label>Done when</FormControl.Label>
          <TextInput
            block
            value={doneWhen}
            placeholder="Optional: how will you know this is finished?"
            onChange={(e) => setDoneWhen(e.target.value)}
          />
        </FormControl>

        <FormControl>
          <FormControl.Label>Notes</FormControl.Label>
          <Textarea block rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </FormControl>

        <div className={styles.row}>
          <FormControl>
            <FormControl.Label>Project</FormControl.Label>
            <Select block value={projectId ?? ''} onChange={(e) => onProjectChange(e.target.value)}>
              <Select.Option value="">Inbox</Select.Option>
              {projects.map((p) => (
                <Select.Option key={p.id} value={p.id}>
                  {p.name}
                </Select.Option>
              ))}
            </Select>
          </FormControl>
          <FormControl disabled={projectId === null}>
            <FormControl.Label>Milestone</FormControl.Label>
            <Select block value={milestoneId ?? ''} onChange={(e) => setMilestoneId(e.target.value || null)}>
              <Select.Option value="">No milestone</Select.Option>
              {milestones.map((m) => (
                <Select.Option key={m.id} value={m.id}>
                  {m.name}
                </Select.Option>
              ))}
            </Select>
          </FormControl>
        </div>

        <div className={styles.row}>
          <FormControl>
            <FormControl.Label>Status</FormControl.Label>
            <Select block value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)}>
              <Select.Option value="todo">To do</Select.Option>
              <Select.Option value="waiting">Waiting</Select.Option>
              <Select.Option value="done">Done</Select.Option>
            </Select>
          </FormControl>
          {status === 'waiting' && (
            <>
              <FormControl>
                <FormControl.Label>Waiting on</FormControl.Label>
                <TextInput
                  block
                  value={waitingOn}
                  placeholder="Person or thing"
                  onChange={(e) => setWaitingOn(e.target.value)}
                />
              </FormControl>
              <FormControl>
                <FormControl.Label>Follow up on</FormControl.Label>
                <TextInput
                  block
                  type="date"
                  value={followUpDate}
                  onChange={(e) => setFollowUpDate(e.target.value)}
                />
              </FormControl>
            </>
          )}
        </div>

        <Section title="Checklist">
          <ChecklistEditor taskId={task.id} items={checklist} onChange={setChecklist} />
        </Section>

        {projectId && (
          <Section title="Blocked by">
            <BlockedByEditor
              task={task}
              projectId={projectId}
              tasks={data.tasks}
              milestones={data.milestones}
              dependencies={data.dependencies}
              value={effectiveBlockers}
              onChange={setBlockedBy}
            />
          </Section>
        )}

        <Section title="Planning">
          {planned ? (
            <div className={styles.planned}>
              <span>
                {`Planned for the week of ${format(parseISO(task.weekStart!), 'MMM d')}`}
                {task.pinnedDay ? `, pinned to ${format(parseISO(task.pinnedDay), 'EEEE MMM d')}` : ''}
              </span>
              <Button size="small" onClick={() => setUnplanned(true)}>
                Unplan
              </Button>
            </div>
          ) : (
            <p className={styles.hint}>
              {unplanned ? 'Will be unplanned when you save.' : 'Not planned for any week.'}
            </p>
          )}
        </Section>

        {size === 'XL' && task.status !== 'done' && (
          <Section title="Split task">
            <SplitTask task={task} onDone={onClose} />
          </Section>
        )}

        <div className={styles.danger}>
          <Button variant="danger" onClick={() => void remove()}>
            Delete task
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
