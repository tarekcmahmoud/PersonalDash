import { Plus } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu'
import { useApply, useUpdateTasks } from '../../data/hooks'
import { useTaskActions } from '../../data/taskActions'
import type { PlanContext } from '../../domain/context'
import { makeTask } from '../../domain/factories'
import { explicitBlockerIds, streamLabel, unfinishedBlockers } from '../../domain/order'
import { FIRST_FOLLOW_UP_DAYS } from '../../domain/delegation'
import type { Person, Project, Task, TaskSize } from '../../domain/types'
import { addDaysISO } from '../../domain/week'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { TaskRow } from '../components/TaskRow'
import { AddTaskRow } from './AddTaskRow'
import { CollapsibleGroup } from './CollapsibleGroup'
import { LinkRails } from './LinkRails'
import { railLanes, railsWidth } from './links'
import { MilestoneDialog } from './MilestoneDialog'
import { endPosition, renumberGroup, type TaskGroupData } from './ordering'
import { RowMenu } from './RowMenu'
import { SortableList, type SortableControls } from './SortableList'
import { NO_GROUP, useTaskDropList } from './taskDndContext'
import { DIMMED_CLASSES } from './useProjectView'

interface Props {
  project: Project
  group: TaskGroupData
  ctx: PlanContext
  /** The next task of each workstream (see `nextTasks`), each marked with a grey "Next". */
  nextIds: ReadonlySet<string>
  /** Heading (workstream header or plain title). */
  header?: ReactNode
  /** Greyed out because another workstream is in focus. */
  dimmed?: boolean
  onOpenTask: (task: Task) => void
  /** Starts "Waits for…": the next task picked becomes one this task waits for. */
  onStartLink?: (task: Task) => void
  /** A substream: a smaller, flat card meant to sit inside its workstream's card. */
  nested?: boolean
  /** Shown at the bottom of the card, after the tasks (the workstream's substream cards). */
  children?: ReactNode
}

/**
 * The tasks of one workflow group (workstream-less or one workstream): open tasks sortable, done collapsed.
 * Links between its open tasks are drawn as rails in the left gutter; links to tasks elsewhere are grey notes
 * ("After: …", "Then: …"). Tasks waiting for an unfinished task are greyed out.
 */
export function TaskGroup({
  project,
  group,
  ctx,
  nextIds,
  header,
  dimmed = false,
  onOpenTask,
  onStartLink,
  nested = false,
  children,
}: Props) {
  const actions = useTaskActions()
  // Delegation: the project's collaborators, and names for delegated rows.
  const collaborators = project.collaboratorIds
    .map((id) => ctx.people.find((p) => p.id === id))
    .filter((p): p is Person => p !== undefined)
  const personName = (id: string) => ctx.people.find((p) => p.id === id)?.name
  const apply = useApply()
  const updateTasks = useUpdateTasks()
  const groupName = group.milestone?.name ?? 'the project'
  const open = group.tasks.filter((t) => t.status !== 'done')
  const done = group.tasks.filter((t) => t.status === 'done')
  // A workstream (not a substream) can get substreams: "+ Add substream" next to "+ Add task".
  const workstream = !nested && group.milestone?.parentId === null ? group.milestone : null
  const [addingSubstream, setAddingSubstream] = useState(false)
  const substreams = workstream ? ctx.milestones.filter((m) => m.parentId === workstream.id) : []
  // Drag and drop (inside the project page's TaskDndProvider): this list's id, and the card as its drop target.
  const listId = group.milestone?.id ?? NO_GROUP
  const { setNodeRef: setDropRef, isTarget: isDropTarget } = useTaskDropList(listId)
  // The list element, as state: the rails measure it once it is attached.
  const [listEl, setListEl] = useState<HTMLDivElement | null>(null)
  const inList = new Set(open.map((t) => t.id))
  const rails = railLanes(
    open.map((t) => t.id),
    ctx.dependencies,
  )
  const byId = new Map(ctx.tasks.map((t) => [t.id, t]))

  /** "Title (Workstream)" for a task outside this list: its workstream, or its project when elsewhere. */
  const elsewhere = (t: Task): string => {
    if (t.projectId !== project.id)
      return `${t.title} (${ctx.projects.find((p) => p.id === t.projectId)?.name ?? 'Inbox'})`
    const stream = ctx.milestones.find((m) => m.id === t.milestoneId)
    return `${t.title} (${stream ? streamLabel(stream, ctx.milestones) : 'No workstream'})`
  }
  const linkNote = (task: Task, blockers: Task[]): string | undefined => {
    const after = blockers.filter((b) => !inList.has(b.id))
    const then = ctx.dependencies
      .filter((d) => d.blockedByTaskId === task.id && !inList.has(d.taskId))
      .map((d) => byId.get(d.taskId))
      .filter((t): t is Task => t !== undefined && t.status !== 'done')
    const parts = [
      after.length > 0 ? `After: ${after.map(elsewhere).join(', ')}` : '',
      task.status !== 'done' && then.length > 0 ? `Then: ${then.map(elsewhere).join(', ')}` : '',
    ].filter(Boolean)
    return parts.length > 0 ? parts.join(' · ') : undefined
  }
  const unlink = (task: Task, blockerId: string) =>
    void apply({
      kind: 'setDependencies',
      taskId: task.id,
      blockedByIds: explicitBlockerIds(task.id, ctx.dependencies).filter((id) => id !== blockerId),
    })

  const reorder = (openInNewOrder: Task[]) => {
    const changed = renumberGroup(group.tasks, openInNewOrder)
    if (changed.length > 0) void updateTasks(changed.map((task) => ({ task, patch: {} })))
  }

  const add = (title: string, size: TaskSize) =>
    void apply({
      kind: 'saveTasks',
      tasks: [
        makeTask({
          title,
          size,
          projectId: project.id,
          milestoneId: group.milestone?.id ?? null,
          position: endPosition(ctx.tasks, project.id, group.milestone?.id ?? null),
        }),
      ],
    })

  const checklistOf = (taskId: string) => {
    const items = ctx.checklist.filter((c) => c.taskId === taskId)
    return { done: items.filter((c) => c.done).length, total: items.length }
  }

  const renderRow = (task: Task, controls?: SortableControls) => {
    const blockers = task.status === 'done' ? [] : unfinishedBlockers(task, ctx)
    const blocked = blockers.length > 0
    const waitsFor = explicitBlockerIds(task.id, ctx.dependencies)
      .map((id) => byId.get(id))
      .filter((t): t is Task => t !== undefined)
    return (
      <TaskRow
        task={task}
        assigneeName={task.assigneeId ? personName(task.assigneeId) : undefined}
        checklist={checklistOf(task.id)}
        muted={blocked}
        note={linkNote(task, blockers)}
        meta={nextIds.has(task.id) ? ['Next'] : []}
        onToggleDone={(t) => void actions.toggleDone(t)}
        onOpen={(t) => onOpenTask(t)}
        actions={
          controls && (
            <>
              {controls.handle}
              <RowMenu
                label={`Task actions: ${task.title}`}
                controls={controls}
                extra={
                  onStartLink && (
                    <>
                      <DropdownMenuItem onSelect={() => onStartLink(task)}>Waits for…</DropdownMenuItem>
                      {waitsFor.map((b) => (
                        <DropdownMenuItem key={b.id} onSelect={() => unlink(task, b.id)}>
                          {`Stop waiting for “${b.title}”`}
                        </DropdownMenuItem>
                      ))}
                      <DropdownMenuSeparator />
                      <DropdownMenuSub>
                        <DropdownMenuSubTrigger>Delegate to…</DropdownMenuSubTrigger>
                        <DropdownMenuSubContent className="max-w-64">
                          {collaborators.length === 0 ? (
                            <DropdownMenuItem disabled>No collaborators yet</DropdownMenuItem>
                          ) : (
                            collaborators.map((p) => (
                              <DropdownMenuItem
                                key={p.id}
                                disabled={task.assigneeId === p.id}
                                onSelect={() =>
                                  void actions.delegate(
                                    task,
                                    p.id,
                                    addDaysISO(ctx.today, FIRST_FOLLOW_UP_DAYS),
                                  )
                                }
                              >
                                <span className="truncate">{p.name}</span>
                              </DropdownMenuItem>
                            ))
                          )}
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>
                      {task.assigneeId && (
                        <DropdownMenuItem onSelect={() => void actions.takeBack(task)}>
                          Take back
                        </DropdownMenuItem>
                      )}
                    </>
                  )
                }
              />
            </>
          )
        }
      />
    )
  }

  const addRow = (
    <AddTaskRow
      groupName={groupName}
      onAdd={add}
      extra={
        workstream && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label={`Add substream to ${workstream.name}`}
            className="h-8 px-2 font-normal text-muted-foreground"
            onClick={() => setAddingSubstream(true)}
          >
            <Plus /> Add substream
          </Button>
        )
      }
    />
  )

  return (
    <section aria-label={group.milestone?.name ?? 'Tasks without a workstream'}>
      <Card
        ref={setDropRef}
        data-testid={nested ? 'substream-card' : 'workstream-card'}
        data-dimmed={dimmed}
        data-drop-target={isDropTarget || undefined}
        size={nested ? 'sm' : 'default'}
        className={cn(
          'gap-2 transition-shadow',
          nested ? 'bg-muted/40 shadow-none' : DIMMED_CLASSES,
          isDropTarget && 'ring-2 ring-foreground/20',
        )}
      >
        {header && <CardHeader>{header}</CardHeader>}
        <CardContent>
          <div ref={setListEl} className="relative" style={{ paddingLeft: railsWidth(rails) }}>
            <LinkRails container={listEl} rails={rails} />
            <SortableList
              className="divide-y"
              items={open}
              list={listId}
              onReorder={reorder}
              label={(t) => t.title}
              renderItem={renderRow}
            />
          </div>
          {/* With substreams, the workstream's own "Add task" sits below the last substream card. */}
          {children && <div className="mt-3 flex flex-col gap-3">{children}</div>}
          <div className={children ? 'mt-3' : 'mt-1'}>{addRow}</div>
          {done.length > 0 && (
            <CollapsibleGroup label={`${done.length} done`} className="mt-1">
              <div className="divide-y">
                {done.map((t) => (
                  <div key={t.id}>{renderRow(t)}</div>
                ))}
              </div>
            </CollapsibleGroup>
          )}
        </CardContent>
        {addingSubstream && workstream && (
          <MilestoneDialog
            projectId={project.id}
            parentId={workstream.id}
            nextPosition={substreams.length > 0 ? Math.max(...substreams.map((s) => s.position)) + 1 : 0}
            onClose={() => setAddingSubstream(false)}
          />
        )}
      </Card>
    </section>
  )
}
