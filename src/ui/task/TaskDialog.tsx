import { format, parseISO } from 'date-fns'
import { useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { cn } from '@/lib/utils'
import { useApply, useSnapshot } from '../../data/hooks'
import { nowISO } from '../../domain/ids'
import { explicitBlockerIds, orderedMilestones } from '../../domain/order'
import { FIRST_FOLLOW_UP_DAYS } from '../../domain/delegation'
import { completeTask, reopenTask } from '../../domain/review'
import type { ChecklistItem, ID, ISODate, Task, TaskSize, TaskStatus } from '../../domain/types'
import { addDaysISO, todayISO, weekDays, weekStartOf } from '../../domain/week'
import { CollapsibleGroup } from '../project/CollapsibleGroup'
import { ConfirmDialog } from '../project/ConfirmDialog'
import { endPosition } from '../project/ordering'
import { BlockedByEditor } from './BlockedByEditor'
import { ChecklistEditor } from './ChecklistEditor'
import { SplitTask } from './SplitTask'

const SIZES: TaskSize[] = ['S', 'M', 'L', 'XL']
const sameIds = (a: ID[], b: ID[]) => a.length === b.length && a.every((id) => b.includes(id))

/** The Day select: not planned, planned in a week without a day (`week:<Monday>`), or pinned to a date. */
type DayChoice = 'unplanned' | `week:${ISODate}` | ISODate

/**
 * Task fields that realise a Day choice; the same transitions as `useTaskActions().plan/pin/unplan`, merged
 * into the dialog's single save so the write is atomic.
 */
function dayPatch(task: Task, choice: DayChoice): Partial<Task> {
  const keepCalendarInSync = task.gcalEventId ? true : task.gcalDirty
  if (choice === 'unplanned') return { weekStart: null, pinnedDay: null, gcalDirty: keepCalendarInSync }
  if (choice.startsWith('week:'))
    return { weekStart: choice.slice('week:'.length), pinnedDay: null, gcalDirty: keepCalendarInSync }
  return { weekStart: weekStartOf(choice), pinnedDay: choice, gcalDirty: true }
}

/**
 * The weeks the Day select offers: this week, next week, and the task's own week when it is another one (a
 * leftover from an earlier week, or one further ahead), in date order.
 */
function dayWeeks(task: Task, today: ISODate): { weekStart: ISODate; label: string }[] {
  const thisWeek = weekStartOf(today)
  const nextWeek = addDaysISO(thisWeek, 7)
  const weeks = [...new Set([thisWeek, nextWeek, ...(task.weekStart ? [task.weekStart] : [])])].sort()
  return weeks.map((weekStart) => ({
    weekStart,
    label:
      weekStart === thisWeek
        ? 'This week'
        : weekStart === nextWeek
          ? 'Next week'
          : `Week of ${format(parseISO(weekStart), 'MMM d')}`,
  }))
}

function Field({
  label,
  htmlFor,
  hint,
  error,
  className,
  children,
}: {
  label: string
  htmlFor?: string
  hint?: ReactNode
  error?: string | null
  className?: string
  children: ReactNode
}) {
  return (
    <div className={cn('grid content-start gap-1.5', className)}>
      <Label htmlFor={htmlFor} className="text-xs font-normal text-muted-foreground">
        {label}
      </Label>
      {children}
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : (
        hint && <p className="text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  )
}

const NO_PROJECT = 'inbox'
const NO_MILESTONE = 'none'
const ME = 'me'
/**
 * Dropdowns whose options can be long (projects, workstreams, people): the list opens below the field, no wider
 * than it, and long names are cut off with "…" instead of widening it past the dialog's grid.
 */
const FIT_FIELD = 'w-(--radix-select-trigger-width) max-w-(--radix-select-trigger-width)'
const FIT_ITEM = '*:[span]:last:min-w-0'
const fitText = (text: string) => <span className="truncate">{text}</span>

/** Edit one task: details, location, status/waiting, day, and (collapsed) checklist, links (waits for), split. */
export function TaskDialog({ task, onClose }: { task: Task; onClose: () => void }) {
  const { data } = useSnapshot()
  const apply = useApply()
  const uid = useId()
  const titleRef = useRef<HTMLInputElement>(null)

  const savedChecklist = useMemo(
    () => (data?.checklist ?? []).filter((c) => c.taskId === task.id).sort((a, b) => a.position - b.position),
    [data?.checklist, task.id],
  )
  const savedBlockers = useMemo(
    () => explicitBlockerIds(task.id, data?.dependencies ?? []),
    [data?.dependencies, task.id],
  )

  const initialDay: DayChoice =
    task.weekStart === null ? 'unplanned' : (task.pinnedDay ?? `week:${task.weekStart}`)

  const [title, setTitle] = useState(task.title)
  const [size, setSize] = useState<TaskSize>(task.size)
  const [doneWhen, setDoneWhen] = useState(task.doneWhen)
  const [notes, setNotes] = useState(task.notes)
  const [projectId, setProjectId] = useState<ID | null>(task.projectId)
  const [milestoneId, setMilestoneId] = useState<ID | null>(task.milestoneId)
  const [status, setStatus] = useState<TaskStatus>(task.status)
  const [waitingOn, setWaitingOn] = useState(task.waitingOn ?? '')
  const [followUpDate, setFollowUpDate] = useState<ISODate>(task.followUpDate ?? '')
  const [assigneeId, setAssigneeId] = useState<ID | null>(task.assigneeId)
  const [day, setDay] = useState<DayChoice>(initialDay)
  const [checklist, setChecklist] = useState<ChecklistItem[]>(savedChecklist)
  const [blockedBy, setBlockedBy] = useState<ID[]>(savedBlockers)
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  if (!data) return null

  const projects = data.projects
    .filter((p) => p.status !== 'done' || p.id === task.projectId)
    .sort((a, b) => a.rank - b.rank)
  const milestones = projectId ? orderedMilestones(projectId, data.milestones) : []
  const projectName = projects.find((p) => p.id === task.projectId)?.name
  // Blockers only make sense inside the chosen project.
  const taskById = new Map(data.tasks.map((t) => [t.id, t]))
  const effectiveBlockers = projectId
    ? blockedBy.filter((id) => taskById.get(id)?.projectId === projectId)
    : []

  const titleError = submitted && !title.trim() ? 'A task needs a title.' : null
  // Delegation: to the chosen project's collaborators (and whoever it is delegated to already).
  const delegated = assigneeId !== null
  const collaboratorIds = data.projects.find((p) => p.id === projectId)?.collaboratorIds ?? []
  const assignable = data.people.filter((p) => collaboratorIds.includes(p.id) || p.id === task.assigneeId)

  const onAssigneeChange = (value: string) => {
    const id = value === ME ? null : value
    setAssigneeId(id)
    if (id && !followUpDate) setFollowUpDate(addDaysISO(todayISO(), FIRST_FOLLOW_UP_DAYS))
    if (id && status === 'waiting') setStatus('todo')
  }

  const onProjectChange = (value: string) => {
    setProjectId(value === NO_PROJECT ? null : value)
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
        followUpDate: status === 'waiting' || delegated ? followUpDate || null : null,
        assigneeId,
        // A delegated task leaves your weeks; otherwise the Day choice applies.
        ...(delegated ? { weekStart: null, pinnedDay: null } : day !== initialDay ? dayPatch(task, day) : {}),
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
    await apply({ kind: 'deleteTask', id: task.id })
    onClose()
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="flex max-h-[90dvh] flex-col gap-0 p-0 sm:max-w-xl max-sm:h-[100dvh] max-sm:max-h-none max-sm:max-w-none max-sm:rounded-none max-sm:border-0"
        onOpenAutoFocus={(e) => {
          // Focus the title without selecting it; on phones don't pop the keyboard at all.
          e.preventDefault()
          if (!window.matchMedia('(pointer: coarse)').matches) titleRef.current?.focus()
        }}
      >
        <DialogHeader className="gap-1 px-4 pt-5 pb-3 text-left sm:px-6">
          <DialogTitle className="text-base">Edit task</DialogTitle>
          <DialogDescription>{projectName ?? 'Inbox'}</DialogDescription>
        </DialogHeader>

        <div className="grid flex-1 content-start gap-4 overflow-y-auto px-4 py-2 sm:px-6">
          <Field label="Title" htmlFor={`${uid}-title`} error={titleError}>
            <Input
              id={`${uid}-title`}
              ref={titleRef}
              value={title}
              aria-invalid={titleError ? true : undefined}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void save()
                }
              }}
            />
          </Field>

          <div className="grid gap-1.5">
            <Label id={`${uid}-size`} className="text-xs font-normal text-muted-foreground">
              Size
            </Label>
            <ToggleGroup
              type="single"
              variant="outline"
              aria-labelledby={`${uid}-size`}
              value={size}
              onValueChange={(v) => v && setSize(v as TaskSize)}
            >
              {SIZES.map((s) => (
                <ToggleGroupItem key={s} value={s} className="min-w-10">
                  {s}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            <p className={cn('text-xs', size === 'XL' ? 'text-warning' : 'text-muted-foreground')}>
              {size === 'XL'
                ? 'Too big or unclear. Split it before scheduling.'
                : 'S ≈ 1h · M ≈ half a day · L ≈ a full day'}
            </p>
          </div>

          <Field label="Done when" htmlFor={`${uid}-done`}>
            <Input
              id={`${uid}-done`}
              value={doneWhen}
              placeholder="How will you know this is finished?"
              onChange={(e) => setDoneWhen(e.target.value)}
            />
          </Field>

          <Field label="Notes" htmlFor={`${uid}-notes`}>
            <Textarea id={`${uid}-notes`} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Project" htmlFor={`${uid}-project`}>
              <Select value={projectId ?? NO_PROJECT} onValueChange={onProjectChange}>
                <SelectTrigger id={`${uid}-project`} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper" className={FIT_FIELD}>
                  <SelectItem value={NO_PROJECT}>Inbox</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id} className={FIT_ITEM}>
                      {fitText(p.name)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Workstream" htmlFor={`${uid}-milestone`}>
              <Select
                value={milestoneId ?? NO_MILESTONE}
                disabled={projectId === null}
                onValueChange={(v) => setMilestoneId(v === NO_MILESTONE ? null : v)}
              >
                <SelectTrigger id={`${uid}-milestone`} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper" className={FIT_FIELD}>
                  <SelectItem value={NO_MILESTONE}>No workstream</SelectItem>
                  {/* Substreams follow their workstream, indented, by name only. */}
                  {milestones.map((m) => (
                    <SelectItem key={m.id} value={m.id} className={cn(FIT_ITEM, m.parentId && 'pl-6')}>
                      {fitText(m.name)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            {projectId && (
              <>
                <Field label="Assigned to" htmlFor={`${uid}-assignee`}>
                  <Select value={assigneeId ?? ME} onValueChange={onAssigneeChange}>
                    <SelectTrigger id={`${uid}-assignee`} className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent position="popper" className={FIT_FIELD}>
                      <SelectItem value={ME}>Me</SelectItem>
                      {assignable.map((p) => (
                        <SelectItem key={p.id} value={p.id} className={FIT_ITEM}>
                          {fitText(p.name)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {assignable.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      Add collaborators to the project to delegate its tasks.
                    </p>
                  )}
                </Field>
                {delegated ? (
                  <Field label="Follow up on" htmlFor={`${uid}-delegated-followup`}>
                    <Input
                      id={`${uid}-delegated-followup`}
                      type="date"
                      value={followUpDate}
                      onChange={(e) => setFollowUpDate(e.target.value)}
                    />
                  </Field>
                ) : (
                  <div className="max-sm:hidden" />
                )}
              </>
            )}

            <Field label="Status" htmlFor={`${uid}-status`}>
              <Select value={status} onValueChange={(v) => setStatus(v as TaskStatus)}>
                <SelectTrigger id={`${uid}-status`} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todo">To do</SelectItem>
                  {!delegated && <SelectItem value="waiting">Waiting</SelectItem>}
                  <SelectItem value="done">Done</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            {!delegated && (
              <Field label="Day" htmlFor={`${uid}-day`}>
                <Select value={day} onValueChange={(v) => setDay(v as DayChoice)}>
                  <SelectTrigger id={`${uid}-day`} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {dayWeeks(task, todayISO()).map(({ weekStart, label }) => (
                      <SelectGroup key={weekStart}>
                        <SelectLabel>{label}</SelectLabel>
                        <SelectItem value={`week:${weekStart}`}>{`${label}, no day`}</SelectItem>
                        {weekDays(weekStart).map((d) => (
                          <SelectItem key={d} value={d}>
                            {format(parseISO(d), 'EEE MMM d')}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                    <SelectSeparator />
                    <SelectItem value="unplanned">Not planned</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            )}

            {status === 'waiting' && !delegated && (
              <>
                <Field label="Waiting on" htmlFor={`${uid}-waiting`}>
                  <Input
                    id={`${uid}-waiting`}
                    value={waitingOn}
                    placeholder="Person or thing"
                    onChange={(e) => setWaitingOn(e.target.value)}
                  />
                </Field>
                <Field label="Follow up on" htmlFor={`${uid}-followup`}>
                  <Input
                    id={`${uid}-followup`}
                    type="date"
                    value={followUpDate}
                    onChange={(e) => setFollowUpDate(e.target.value)}
                  />
                </Field>
              </>
            )}
          </div>

          <div className="-mt-1 grid gap-1 pb-2">
            <CollapsibleGroup
              label="Checklist"
              count={checklist.length || undefined}
              defaultOpen={checklist.length > 0}
            >
              <div className="pt-1 pb-2">
                <ChecklistEditor taskId={task.id} items={checklist} onChange={setChecklist} />
              </div>
            </CollapsibleGroup>

            {projectId && (
              <CollapsibleGroup
                label="Waits for"
                count={effectiveBlockers.length || undefined}
                defaultOpen={savedBlockers.length > 0}
              >
                <div className="pt-1 pb-2">
                  <BlockedByEditor
                    task={task}
                    projectId={projectId}
                    tasks={data.tasks}
                    milestones={data.milestones}
                    dependencies={data.dependencies}
                    value={effectiveBlockers}
                    onChange={setBlockedBy}
                  />
                </div>
              </CollapsibleGroup>
            )}

            {size === 'XL' && task.status !== 'done' && (
              <CollapsibleGroup label="Split task" defaultOpen={task.size === 'XL'}>
                <div className="pt-1 pb-2">
                  <SplitTask task={task} onDone={onClose} />
                </div>
              </CollapsibleGroup>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 border-t px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
          <Button
            type="button"
            variant="ghost"
            aria-label="Delete task"
            className="mr-auto text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => setDeleting(true)}
          >
            Delete
          </Button>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" disabled={saving} onClick={() => void save()}>
            Save
          </Button>
        </div>

        <ConfirmDialog
          open={deleting}
          onOpenChange={setDeleting}
          title="Delete this task?"
          description={`“${task.title}” and its checklist will be deleted. This cannot be undone.`}
          confirmLabel="Delete task"
          destructive
          onConfirm={remove}
        />
      </DialogContent>
    </Dialog>
  )
}
