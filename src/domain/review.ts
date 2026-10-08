import type { PlanContext } from './context'
import type { ID, ISODate, Project, Task } from './types'

export const CHRONIC_SLIP_THRESHOLD = 2

export interface WeekRetro {
  weekStart: ISODate
  /** Tasks completed during the week (completedAt within the week), grouped by project (null = Inbox). */
  doneByProject: { projectId: ID | null; tasks: Task[] }[]
  /** Tasks planned in the week that are not done. */
  leftovers: Task[]
  /** Active non-system projects with no task completed in the week. */
  untouched: Project[]
  totalDone: number
}

/** Retro for the week starting at weekStart (usually the previous week). */
export function weekRetro(ctx: Pick<PlanContext, 'projects' | 'tasks'>, weekStart: ISODate): WeekRetro {
  void ctx
  void weekStart
  throw new Error('not implemented')
}

/** Patch: move an unfinished task into nextWeekStart, slipCount + 1, pinnedDay cleared, gcalDirty if it had an event. */
export function carryOver(task: Task, nextWeekStart: ISODate): Partial<Task> {
  void task
  void nextWeekStart
  throw new Error('not implemented')
}

/** Patch: unplan an unfinished task (weekStart & pinnedDay null), slipCount + 1, gcalDirty if it had an event. */
export function returnToProject(task: Task): Partial<Task> {
  void task
  throw new Error('not implemented')
}

export const isChronicSlipper = (task: Task): boolean => task.slipCount >= CHRONIC_SLIP_THRESHOLD

/** Patch for completing a task (status done, completedAt = nowIso, gcalDirty if pinned with an event). */
export function completeTask(task: Task, nowIso: string): Partial<Task> {
  void task
  void nowIso
  throw new Error('not implemented')
}

/** Patch for un-completing a task. */
export function reopenTask(task: Task): Partial<Task> {
  void task
  throw new Error('not implemented')
}
