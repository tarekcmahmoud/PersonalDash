import type { ISODate, Task } from './types'
import { isInWeek, weekEndOf } from './week'

export interface FollowUpItem {
  task: Task
  /** The follow-up date (may be before weekStart = overdue). */
  date: ISODate
  overdue: boolean
  /** "Follow up: <waitingOn> re <task title>" (or "Follow up re <title>" when waitingOn is empty). */
  label: string
}

/**
 * Follow-ups due in the week: tasks with status 'waiting' and followUpDate <= Sunday of the week.
 * Overdue items (date < weekStart) are included only when weekStart is the current week (contains today).
 * Sorted by date.
 */
export function followUpsForWeek(tasks: Task[], weekStart: ISODate, today: ISODate): FollowUpItem[] {
  const weekEnd = weekEndOf(weekStart)
  const isCurrentWeek = isInWeek(today, weekStart)
  const items: FollowUpItem[] = []
  for (const task of tasks) {
    if (task.status !== 'waiting' || !task.followUpDate) continue
    const date = task.followUpDate
    if (date > weekEnd) continue
    const overdue = date < weekStart
    if (overdue && !isCurrentWeek) continue
    const who = task.waitingOn?.trim()
    const label = who ? `Follow up: ${who} re ${task.title}` : `Follow up re ${task.title}`
    items.push({ task, date, overdue, label })
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
