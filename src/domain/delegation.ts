import { isDelegated } from './followups'
import type { ISODate, Person, Task } from './types'

/** Days until the first follow-up when a task is delegated. */
export const FIRST_FOLLOW_UP_DAYS = 3

export interface DelegatedItem {
  task: Task
  /** The follow-up date is today or earlier: time to check in. */
  due: boolean
  /** The follow-up date has passed. */
  overdue: boolean
}

export interface PersonDelegation {
  person: Person
  /** Their open tasks: by follow-up date (no date last), then title. */
  items: DelegatedItem[]
  /** How many follow-ups are due (today or earlier). */
  dueCount: number
}

const byFollowUp = (a: Task, b: Task): number =>
  (a.followUpDate ?? '9999') < (b.followUpDate ?? '9999')
    ? -1
    : (a.followUpDate ?? '9999') > (b.followUpDate ?? '9999')
      ? 1
      : a.title.localeCompare(b.title)

/**
 * Everything delegated, grouped by person: people with follow-ups due first (then by their earliest follow-up),
 * then by name. People without open delegated tasks are left out.
 */
export function delegationByPerson(tasks: Task[], people: Person[], today: ISODate): PersonDelegation[] {
  return people
    .map((person) => {
      const items = tasks
        .filter((t) => isDelegated(t) && t.assigneeId === person.id)
        .sort(byFollowUp)
        .map((task) => ({
          task,
          due: task.followUpDate !== null && task.followUpDate <= today,
          overdue: task.followUpDate !== null && task.followUpDate < today,
        }))
      return { person, items, dueCount: items.filter((i) => i.due).length }
    })
    .filter((g) => g.items.length > 0)
    .sort(
      (a, b) =>
        Number(b.dueCount > 0) - Number(a.dueCount > 0) ||
        byFollowUp(a.items[0]!.task, b.items[0]!.task) ||
        a.person.name.localeCompare(b.person.name),
    )
}

/**
 * Patch that delegates a task to `personId`, to be followed up on `followUpDate`. It leaves your weeks (no longer
 * planned or pinned) and any "waiting" state; done tasks stay done.
 */
export function delegateTask(task: Task, personId: string, followUpDate: ISODate | null): Partial<Task> {
  return {
    assigneeId: personId,
    followUpDate,
    weekStart: null,
    pinnedDay: null,
    status: task.status === 'waiting' ? 'todo' : task.status,
    waitingOn: null,
  }
}

/** Patch that takes a delegated task back: yours again, no follow-up. */
export function takeBackTask(task: Task): Partial<Task> {
  void task
  return { assigneeId: null, followUpDate: null }
}
