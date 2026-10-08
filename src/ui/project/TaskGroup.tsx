import { Details, Label } from '@primer/react'
import type { ReactNode } from 'react'
import { useApply, useUpdateTasks } from '../../data/hooks'
import { useTaskActions } from '../../data/taskActions'
import type { PlanContext } from '../../domain/context'
import { makeTask } from '../../domain/factories'
import { unfinishedBlockers } from '../../domain/order'
import type { Project, Task, TaskSize } from '../../domain/types'
import { TaskRow } from '../components/TaskRow'
import { endPosition, renumberGroup, type TaskGroupData } from './ordering'
import { QuickAddTask } from './QuickAddTask'
import { SortableList } from './SortableList'
import styles from './TaskGroup.module.css'

interface Props {
  project: Project
  group: TaskGroupData
  ctx: PlanContext
  /** The project's next task id, highlighted with a "Next" label. */
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

  const renderRow = (task: Task, controls?: ReactNode) => {
    const blockers = task.status === 'done' ? [] : unfinishedBlockers(task, ctx)
    const blocked = blockers.length > 0
    return (
      <TaskRow
        task={task}
        checklist={checklistOf(task.id)}
        muted={blocked}
        note={blocked ? `Blocked by: ${blockers.map((b) => b.title).join(', ')}` : undefined}
        onToggleDone={(t) => void actions.toggleDone(t)}
        onOpen={(t) => onOpenTask(t)}
        trailing={
          <>
            {task.id === nextId && <Label variant="success">Next</Label>}
            {controls}
          </>
        }
      />
    )
  }

  return (
    <section className={styles.group} aria-label={group.milestone?.name ?? 'Tasks without a milestone'}>
      {header}
      {open.length === 0 && done.length === 0 && <p className={styles.empty}>No tasks yet.</p>}
      <SortableList
        items={open}
        onReorder={reorder}
        label={(t) => t.title}
        renderItem={(task, controls) => <div className={styles.row}>{renderRow(task, controls)}</div>}
      />
      <QuickAddTask groupName={groupName} onAdd={add} />
      {done.length > 0 && (
        <Details className={styles.done}>
          <Details.Summary className={styles.summary}>{`${done.length} done`}</Details.Summary>
          {done.map((t) => (
            <div key={t.id} className={styles.row}>
              {renderRow(t)}
            </div>
          ))}
        </Details>
      )}
    </section>
  )
}
