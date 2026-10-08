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

export interface Workstream {
  /** Milestone id, or null for the project's tasks that are in no workstream. */
  id: ID | null
  /** The stream's tasks in order (all statuses). */
  tasks: Task[]
}

/**
 * A project's tasks grouped by workstream, in order: the workstream-less group first (only when it has tasks),
 * then each workstream by position (included even when empty). Workstreams run in parallel.
 */
export function projectWorkstreams(
  projectId: ID,
  ctx: Pick<OrderInput, 'milestones' | 'tasks'>,
): Workstream[] {
  const ordered = orderedProjectTasks(projectId, ctx.milestones, ctx.tasks)
  const milestones = ctx.milestones
    .filter((m) => m.projectId === projectId)
    .sort((a, b) => a.position - b.position || cmpStr(a.id, b.id))
  const ids = new Set(milestones.map((m) => m.id))
  const loose = ordered.filter((t) => t.milestoneId === null || !ids.has(t.milestoneId))
  return [
    ...(loose.length > 0 ? [{ id: null, tasks: loose }] : []),
    ...milestones.map((m) => ({ id: m.id, tasks: ordered.filter((t) => t.milestoneId === m.id) })),
  ]
}

/**
 * The tasks that must be done before `task` can start:
 * - if the task has explicit Dependency links → exactly those blocker tasks (any workstream);
 * - otherwise → the task immediately before it in the same workstream (if any). Workstreams run in
 *   parallel, so the first task of a workstream has no implicit predecessor.
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
    const stream = projectWorkstreams(task.projectId, ctx).find((w) => w.tasks.some((t) => t.id === task.id))
    const i = stream ? stream.tasks.findIndex((t) => t.id === task.id) : -1
    blockers = i > 0 ? [stream!.tasks[i - 1]!] : []
  }
  return blockers.filter((b) => b.status !== 'done')
}

/** status 'todo' and no unfinished blockers. */
export function isReady(task: Task, ctx: OrderInput): boolean {
  return task.status === 'todo' && unfinishedBlockers(task, ctx).length === 0
}

/** The next step of each workstream (first 'todo' task that isReady), in workstream order; streams without one are skipped. */
export function nextTasks(projectId: ID, ctx: OrderInput): Task[] {
  return projectWorkstreams(projectId, ctx).flatMap((w) => {
    const next = w.tasks.find((t) => isReady(t, ctx))
    return next ? [next] : []
  })
}

/** The project's first next step (first of nextTasks); null if none. */
export function nextTask(projectId: ID, ctx: OrderInput): Task | null {
  return nextTasks(projectId, ctx)[0] ?? null
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
