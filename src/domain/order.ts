import type { PlanContext } from './context'
import type { Dependency, ID, Milestone, Task } from './types'

type OrderInput = Pick<PlanContext, 'milestones' | 'tasks' | 'dependencies'>

/**
 * All tasks of a project in workflow order: milestone-less tasks first (by position),
 * then each milestone by position, its tasks by position. Includes done tasks.
 */
export function orderedProjectTasks(projectId: ID, milestones: Milestone[], tasks: Task[]): Task[] {
  void projectId
  void milestones
  void tasks
  throw new Error('not implemented')
}

/**
 * The tasks that must be done before `task` can start:
 * - if the task has explicit Dependency links → exactly those blocker tasks;
 * - otherwise → the task immediately before it in orderedProjectTasks (if any).
 * Inbox tasks (projectId null) have no implicit predecessor.
 * Returns only blockers whose status is not 'done' (a 'waiting' predecessor still blocks).
 */
export function unfinishedBlockers(task: Task, ctx: OrderInput): Task[] {
  void task
  void ctx
  throw new Error('not implemented')
}

/** status 'todo' and no unfinished blockers. */
export function isReady(task: Task, ctx: OrderInput): boolean {
  void task
  void ctx
  throw new Error('not implemented')
}

/** First task in workflow order with status 'todo' that isReady; null if none. */
export function nextTask(projectId: ID, ctx: OrderInput): Task | null {
  void projectId
  void ctx
  throw new Error('not implemented')
}

/** The explicit blocker ids of a task. */
export function explicitBlockerIds(taskId: ID, dependencies: Dependency[]): ID[] {
  void taskId
  void dependencies
  throw new Error('not implemented')
}

/** True if adding taskId ← blockedById would create a cycle in the explicit dependency graph. */
export function wouldCreateCycle(taskId: ID, blockedById: ID, dependencies: Dependency[]): boolean {
  void taskId
  void blockedById
  void dependencies
  throw new Error('not implemented')
}
