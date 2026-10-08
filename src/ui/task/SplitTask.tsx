import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useApply, useSnapshot } from '../../data/hooks'
import { makeTask } from '../../domain/factories'
import { explicitBlockerIds } from '../../domain/order'
import type { Task } from '../../domain/types'
import { ConfirmDialog } from '../project/ConfirmDialog'
import { groupTasks, parseSubtasks } from '../project/ordering'

/**
 * Split an XL task: one subtask per line (optional trailing [S]/[M]/[L], default M). The subtasks take the XL
 * task's place right after it in the same group; the XL task is deleted. Explicit blockers move to the first
 * subtask, and tasks that were blocked by the XL task are blocked by the last subtask instead.
 */
export function SplitTask({ task, onDone }: { task: Task; onDone: () => void }) {
  const apply = useApply()
  const { data } = useSnapshot()
  const [text, setText] = useState('')
  const [confirming, setConfirming] = useState(false)
  const subtasks = parseSubtasks(text)

  const split = async () => {
    if (!data || subtasks.length === 0) return

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
    <div className="grid gap-2">
      <p className="text-xs text-muted-foreground">
        Too big or unclear to schedule. One step per line; end a line with [S], [M] or [L] to set its size
        (default M).
      </p>
      <Textarea
        rows={4}
        value={text}
        aria-label="Subtasks, one per line"
        placeholder={'Outline the content model [S]\nBuild the editor [L]\nPublishing flow'}
        onChange={(e) => setText(e.target.value)}
      />
      <div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={subtasks.length === 0}
          onClick={() => setConfirming(true)}
        >
          Split into subtasks
        </Button>
      </div>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Split this task?"
        description={`“${task.title}” will be replaced by ${subtasks.length} new task${subtasks.length === 1 ? '' : 's'}.`}
        confirmLabel="Split task"
        onConfirm={split}
      />
    </div>
  )
}
