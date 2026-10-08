import type { PlanContext } from './context'
import type { HealthFlag } from './health'
import type { ISODate, Project, Task } from './types'

export interface PickCandidate {
  task: Task
  /** Already planned in ctx.weekStart. */
  planned: boolean
  /** Unfinished blockers that are NOT themselves planned in the same week. */
  blockedBy: Task[]
  /** False when the task can't be added to the week: XL size or blockedBy non-empty. */
  selectable: boolean
  reason: 'xl' | 'blocked' | null
}

export interface PickGroup {
  project: Project
  flags: HealthFlag[]
  /** Next PICK_LIST_DEPTH unfinished 'todo' tasks in workflow order (planned ones included and marked). */
  candidates: PickCandidate[]
  /** More 'todo' tasks exist beyond `candidates`. */
  hasMore: boolean
  /** Number of the project's tasks planned in the week. */
  plannedCount: number
}

export const PICK_LIST_DEPTH = 3

/** XL tasks and done tasks can't be scheduled. */
export function isSchedulable(task: Task): boolean {
  void task
  throw new Error('not implemented')
}

/** Tasks planned in the given week (weekStart matches), any status. */
export function tasksInWeek(tasks: Task[], weekStart: ISODate): Task[] {
  void tasks
  void weekStart
  throw new Error('not implemented')
}

/**
 * Pick list for weekly planning: one group per ACTIVE project (system project included),
 * ordered by:
 *   1. projects with a 'below_min' flag first,
 *   2. then projects with a hard targetDate within settings.deadlineWarningDays (or overdue), soonest first,
 *   3. then by rank ascending.
 * `depth` overrides PICK_LIST_DEPTH (used when the user expands a project).
 */
export function buildPickList(ctx: PlanContext, depth?: Record<string, number>): PickGroup[] {
  void ctx
  void depth
  throw new Error('not implemented')
}
