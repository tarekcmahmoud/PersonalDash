import type { ISODate, Person, Task } from './types'
import { isInWeek, weekEndOf } from './week'

export interface FollowUpItem {
  task: Task
  /** 'waiting': you wait on someone before you can go on. 'delegated': the task is theirs (task.assigneeId). */
  kind: 'waiting' | 'delegated'
  /** The follow-up date (may be before weekStart = overdue). */
  date: ISODate
  overdue: boolean
  /** "Follow up: <who> re <task title>" (or "Follow up re <title>" when nobody is named). */
  label: string
}

/** A delegated task: assigned to someone else and not done yet. */
export const isDelegated = (task: Task): boolean => task.assigneeId !== null && task.status !== 'done'

/**
 * Follow-ups due in the week: waiting or delegated tasks (see isDelegated) with followUpDate <= Sunday of the
 * week. Overdue items (date < weekStart) are included only when weekStart is the current week (contains today).
 * `people` names the assignees of delegated tasks. Sorted by date.
 */
export function followUpsForWeek(
  tasks: Task[],
  weekStart: ISODate,
  today: ISODate,
  people: Person[] = [],
): FollowUpItem[] {
  const weekEnd = weekEndOf(weekStart)
  const isCurrentWeek = isInWeek(today, weekStart)
  const items: FollowUpItem[] = []
  for (const task of tasks) {
    const kind = isDelegated(task) ? 'delegated' : task.status === 'waiting' ? 'waiting' : null
    if (!kind || !task.followUpDate) continue
    const date = task.followUpDate
    if (date > weekEnd) continue
    const overdue = date < weekStart
    if (overdue && !isCurrentWeek) continue
    const who =
      kind === 'delegated' ? people.find((p) => p.id === task.assigneeId)?.name : task.waitingOn?.trim()
    const label = who ? `Follow up: ${who} re ${task.title}` : `Follow up re ${task.title}`
    items.push({ task, kind, date, overdue, label })
  }
  return items.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
}

/** Patch for "still waiting — follow up again on newDate". */
export function snoozeFollowUp(task: Task, newDate: ISODate): Partial<Task> {
  void task
  return { followUpDate: newDate }
}

/** Patch for "received": back to todo, waiting fields cleared. */
export function receiveWaiting(task: Task): Partial<Task> {
  void task
  return { status: 'todo', waitingOn: null, followUpDate: null }
}
