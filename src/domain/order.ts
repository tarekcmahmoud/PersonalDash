import type { PlanContext } from './context'
import type { Dependency, ID, Milestone, Task } from './types'

type OrderInput = Pick<PlanContext, 'milestones' | 'tasks' | 'dependencies'>

const cmpStr = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0)

/** Deterministic ordering: position, then createdAt, then id. */
function byPositionThenCreated(a: Task, b: Task): number {
  return a.position - b.position || cmpStr(a.createdAt, b.createdAt) || cmpStr(a.id, b.id)
}

/**
 * All tasks of a project in workflow order: milestone-less tasks first (by position),
 * then each milestone by position, its tasks by position. Includes done tasks.
 * Equal positions are tie-broken by createdAt, then id (milestones have no createdAt: by id).
 * Tasks pointing at a milestone that does not belong to the project are treated as milestone-less.
 */
export function orderedProjectTasks(projectId: ID, milestones: Milestone[], tasks: Task[]): Task[] {
  const projectMilestones = milestones
    .filter((m) => m.projectId === projectId)
    .sort((a, b) => a.position - b.position || cmpStr(a.id, b.id))
  const milestoneIds = new Set(projectMilestones.map((m) => m.id))
  const projectTasks = tasks.filter((t) => t.projectId === projectId)

  const result = projectTasks
    .filter((t) => t.milestoneId === null || !milestoneIds.has(t.milestoneId))
    .sort(byPositionThenCreated)
  for (const m of projectMilestones) {
    result.push(...projectTasks.filter((t) => t.milestoneId === m.id).sort(byPositionThenCreated))
  }
  return result
}

/**
 * The tasks that must be done before `task` can start:
 * - if the task has explicit Dependency links → exactly those blocker tasks;
 * - otherwise → the task immediately before it in orderedProjectTasks (if any).
 * Inbox tasks (projectId null) have no implicit predecessor.
 * Returns only blockers whose status is not 'done' (a 'waiting' predecessor still blocks).
 */
export function unfinishedBlockers(task: Task, ctx: OrderInput): Task[] {
  const explicit = explicitBlockerIds(task.id, ctx.dependencies)
  let blockers: Task[]
  if (explicit.length > 0) {
    const wanted = new Set(explicit)
    blockers = ctx.tasks.filter((t) => wanted.has(t.id))
  } else if (task.projectId === null) {
    blockers = []
  } else {
    const ordered = orderedProjectTasks(task.projectId, ctx.milestones, ctx.tasks)
    const i = ordered.findIndex((t) => t.id === task.id)
    blockers = i > 0 ? [ordered[i - 1]!] : []
  }
  return blockers.filter((b) => b.status !== 'done')
}

/** status 'todo' and no unfinished blockers. */
export function isReady(task: Task, ctx: OrderInput): boolean {
  return task.status === 'todo' && unfinishedBlockers(task, ctx).length === 0
}

/** First task in workflow order with status 'todo' that isReady; null if none. */
export function nextTask(projectId: ID, ctx: OrderInput): Task | null {
  const ordered = orderedProjectTasks(projectId, ctx.milestones, ctx.tasks)
  return ordered.find((t) => isReady(t, ctx)) ?? null
}

/** The explicit blocker ids of a task. */
export function explicitBlockerIds(taskId: ID, dependencies: Dependency[]): ID[] {
  return dependencies.filter((d) => d.taskId === taskId).map((d) => d.blockedByTaskId)
}

/** True if adding taskId ← blockedById would create a cycle in the explicit dependency graph. */
export function wouldCreateCycle(taskId: ID, blockedById: ID, dependencies: Dependency[]): boolean {
  if (taskId === blockedById) return true
  // The new edge makes taskId depend on blockedById; a cycle appears iff blockedById already
  // (transitively) depends on taskId.
  const seen = new Set<ID>()
  const stack: ID[] = [blockedById]
  while (stack.length > 0) {
    const current = stack.pop()!
    if (current === taskId) return true
    if (seen.has(current)) continue
    seen.add(current)
    stack.push(...explicitBlockerIds(current, dependencies))
  }
  return false
}
