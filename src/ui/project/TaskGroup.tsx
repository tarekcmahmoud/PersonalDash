import type { ReactNode } from 'react'
import { useApply, useUpdateTasks } from '../../data/hooks'
import { useTaskActions } from '../../data/taskActions'
import type { PlanContext } from '../../domain/context'
import { makeTask } from '../../domain/factories'
import { unfinishedBlockers } from '../../domain/order'
import type { Project, Task, TaskSize } from '../../domain/types'
import { TaskRow } from '../components/TaskRow'
import { AddTaskRow } from './AddTaskRow'
import { CollapsibleGroup } from './CollapsibleGroup'
import { endPosition, renumberGroup, type TaskGroupData } from './ordering'
import { RowMenu } from './RowMenu'
import { SortableList, type SortableControls } from './SortableList'

interface Props {
  project: Project
  group: TaskGroupData
  ctx: PlanContext
  /** The project's next task id, marked with a grey "Next". */
  nextId: string | null
  /** Heading (milestone header or plain title). */
  header?: ReactNode
  onOpenTask: (task: Task) => void
}

/** The tasks of one workflow group (milestone-less or one milestone): open tasks sortable, done collapsed. */
export function TaskGroup({ project, group, ctx, nextId, header, onOpenTask }: Props) {
  const actions = useTaskActions()
  const apply = useApply()
  const updateTasks = useUpdateTasks()
  const groupName = group.milestone?.name ?? 'the project'
  const open = group.tasks.filter((t) => t.status !== 'done')
  const done = group.tasks.filter((t) => t.status === 'done')

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
    return (
      <TaskRow
        task={task}
        checklist={checklistOf(task.id)}
        muted={blocked}
        note={blocked ? `After: ${blockers.map((b) => b.title).join(', ')}` : undefined}
        meta={task.id === nextId ? ['Next'] : []}
        onToggleDone={(t) => void actions.toggleDone(t)}
        onOpen={(t) => onOpenTask(t)}
        actions={
          controls && (
            <>
              {controls.handle}
              <RowMenu label={`Task actions: ${task.title}`} controls={controls} />
            </>
          )
        }
      />
    )
  }

  return (
    <section className="mb-8" aria-label={group.milestone?.name ?? 'Tasks without a milestone'}>
      {header}
      <SortableList
        className="divide-y"
        items={open}
        onReorder={reorder}
        label={(t) => t.title}
        renderItem={renderRow}
      />
      <div className="mt-1">
        <AddTaskRow groupName={groupName} onAdd={add} />
      </div>
      {done.length > 0 && (
        <CollapsibleGroup label={`${done.length} done`} className="mt-1">
          <div className="divide-y">
            {done.map((t) => (
              <div key={t.id}>{renderRow(t)}</div>
            ))}
          </div>
        </CollapsibleGroup>
      )}
    </section>
  )
}
