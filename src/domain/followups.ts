import type { ISODate, Task } from './types'

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
  void tasks
  void weekStart
  void today
  throw new Error('not implemented')
}

/** Patch for "still waiting — follow up again on newDate". */
export function snoozeFollowUp(task: Task, newDate: ISODate): Partial<Task> {
  void task
  void newDate
  throw new Error('not implemented')
}

/** Patch for "received": back to todo, waiting fields cleared. */
export function receiveWaiting(task: Task): Partial<Task> {
  void task
  throw new Error('not implemented')
}
