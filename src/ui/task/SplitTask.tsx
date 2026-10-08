import { Button, Textarea, useConfirm } from '@primer/react'
import { useState } from 'react'
import { useApply, useSnapshot } from '../../data/hooks'
import { makeTask } from '../../domain/factories'
import { explicitBlockerIds } from '../../domain/order'
import type { Task } from '../../domain/types'
import { groupTasks, parseSubtasks } from '../project/ordering'
import styles from './TaskDialog.module.css'

/**
 * Split an XL task: one subtask per line (optional trailing [S]/[M]/[L], default M). The subtasks take the XL
 * task's place right after it in the same group; the XL task is deleted. Explicit blockers move to the first
 * subtask, and tasks that were blocked by the XL task are blocked by the last subtask instead.
 */
export function SplitTask({ task, onDone }: { task: Task; onDone: () => void }) {
  const apply = useApply()
  const { data } = useSnapshot()
  const confirm = useConfirm()
  const [text, setText] = useState('')
  const subtasks = parseSubtasks(text)

  const split = async () => {
    if (!data || subtasks.length === 0) return
    const ok = await confirm({
      title: 'Split this task?',
      content: `“${task.title}” will be replaced by ${subtasks.length} new task${subtasks.length === 1 ? '' : 's'}.`,
      confirmButtonContent: 'Split task',
    })
    if (!ok) return

    const created = subtasks.map((s) =>
      makeTask({
        title: s.title,
        size: s.size,
        projectId: task.projectId,
        milestoneId: task.milestoneId,
      }),
    )
    const group = groupTasks(data.tasks, task.projectId, task.milestoneId)
    const at = group.findIndex((t) => t.id === task.id)
    const inOrder = [...group.slice(0, at + 1), ...created, ...group.slice(at + 1)]
    const createdIds = new Set(created.map((c) => c.id))
    const before = new Map(group.map((t) => [t.id, t.position]))
    const toSave = inOrder
      .map((t, i) => ({ ...t, position: i }))
      .filter((t) => createdIds.has(t.id) || before.get(t.id) !== t.position)

    await apply({ kind: 'saveTasks', tasks: toSave })

    const first = created[0]!
    const last = created[created.length - 1]!
    const ownBlockers = explicitBlockerIds(task.id, data.dependencies)
    if (ownBlockers.length > 0) {
      await apply({ kind: 'setDependencies', taskId: first.id, blockedByIds: ownBlockers })
    }
    const dependents = [
      ...new Set(data.dependencies.filter((d) => d.blockedByTaskId === task.id).map((d) => d.taskId)),
    ]
    for (const dependentId of dependents) {
      const others = explicitBlockerIds(dependentId, data.dependencies).filter((id) => id !== task.id)
      await apply({ kind: 'setDependencies', taskId: dependentId, blockedByIds: [...others, last.id] })
    }
    await apply({ kind: 'deleteTask', id: task.id })
    onDone()
  }

  return (
    <div className={styles.split}>
      <p className={styles.hint}>
        This task is too big or unclear to schedule. Break it into smaller steps, one per line. Add [S], [M]
        or [L] at the end of a line to set its size (default M).
      </p>
      <Textarea
        block
        rows={4}
        value={text}
        aria-label="Subtasks, one per line"
        placeholder={'Outline the content model [S]\nBuild the editor [L]\nPublishing flow'}
        onChange={(e) => setText(e.target.value)}
      />
      <Button disabled={subtasks.length === 0} onClick={() => void split()}>
        Split into subtasks
      </Button>
    </div>
  )
}
