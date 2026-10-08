import { useSnapshot } from '../../data/hooks'
import { TaskDialog } from './TaskDialog'
import { useTaskParam } from './useTaskParam'

/** Renders the task dialog for the task named in the `?task=` query param (renders nothing otherwise). */
export function TaskDialogHost() {
  const { data } = useSnapshot()
  const { taskId, close } = useTaskParam()
  const task = taskId ? data?.tasks.find((t) => t.id === taskId) : undefined
  if (!task) return null
  return <TaskDialog key={task.id} task={task} onClose={close} />
}
