import type { PlanContext } from './context'
import type { Dependency, ID, Milestone, Task } from './types'

type OrderInput = Pick<PlanContext, 'milestones' | 'tasks' | 'dependencies'>

const cmpStr = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0)

/** Deterministic ordering: position, then createdAt, then id. */
function byPositionThenCreated(a: Task, b: Task): number {
  return a.position - b.position || cmpStr(a.createdAt, b.createdAt) || cmpStr(a.id, b.id)
}

const byPosition = (a: Milestone, b: Milestone): number => a.position - b.position || cmpStr(a.id, b.id)

/** A workstream and its substreams, each by position. */
export interface StreamNode {
  milestone: Milestone
  substreams: Milestone[]
}

/**
 * A project's workstreams by position, each with its substreams by position. A milestone whose parent is not a
 * workstream of the same project (missing, foreign, or itself a substream) is treated as a workstream.
 */
export function streamTree(projectId: ID, milestones: Milestone[]): StreamNode[] {
  const own = milestones.filter((m) => m.projectId === projectId)
  const byId = new Map(own.map((m) => [m.id, m]))
  const isSub = (m: Milestone): boolean => {
    const parent = m.parentId === null ? undefined : byId.get(m.parentId)
    return parent !== undefined && parent.id !== m.id && parent.parentId === null
  }
  return own
    .filter((m) => !isSub(m))
    .sort(byPosition)
    .map((milestone) => ({
      milestone,
      substreams: own.filter((m) => isSub(m) && m.parentId === milestone.id).sort(byPosition),
    }))
}

/** All of a project's milestones in workflow order: each workstream followed by its substreams. */
export function orderedMilestones(projectId: ID, milestones: Milestone[]): Milestone[] {
  return streamTree(projectId, milestones).flatMap((n) => [n.milestone, ...n.substreams])
}

/** "Workstream › Substream" for a substream, the plain name for a workstream. */
export function streamLabel(milestone: Milestone, milestones: Milestone[]): string {
  const parent = milestone.parentId ? milestones.find((m) => m.id === milestone.parentId) : undefined
  return parent && parent.projectId === milestone.projectId && parent.parentId === null
    ? `${parent.name} › ${milestone.name}`
    : milestone.name
}

/**
 * All tasks of a project in workflow order: milestone-less tasks first (by position), then each workstream's
 * own tasks followed by each of its substreams' tasks (see orderedMilestones), each by position. Includes done
 * tasks. Equal positions are tie-broken by createdAt, then id (milestones have no createdAt: by id).
 * Tasks pointing at a milestone that does not belong to the project are treated as milestone-less.
 */
export function orderedProjectTasks(projectId: ID, milestones: Milestone[], tasks: Task[]): Task[] {
  const projectMilestones = orderedMilestones(projectId, milestones)
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
 * A project's tasks grouped by stream, in order: the workstream-less group first (only when it has tasks), then
 * each workstream's own tasks followed by each of its substreams (see orderedMilestones; included even when
 * empty). Every stream, substreams included, is a parallel track with its own next step.
 */
export function projectWorkstreams(
  projectId: ID,
  ctx: Pick<OrderInput, 'milestones' | 'tasks'>,
): Workstream[] {
  const ordered = orderedProjectTasks(projectId, ctx.milestones, ctx.tasks)
  const milestones = orderedMilestones(projectId, ctx.milestones)
  const ids = new Set(milestones.map((m) => m.id))
  const loose = ordered.filter((t) => t.milestoneId === null || !ids.has(t.milestoneId))
  return [
    ...(loose.length > 0 ? [{ id: null, tasks: loose }] : []),
    ...milestones.map((m) => ({ id: m.id, tasks: ordered.filter((t) => t.milestoneId === m.id) })),
  ]
}

/**
 * The tasks that must be done before `task` can start: exactly its Dependency links (any workstream). Order
 * within a workstream is priority only, so a task without links can start any time.
 * Returns only blockers whose status is not 'done' (a 'waiting' blocker still blocks).
 */
export function unfinishedBlockers(task: Task, ctx: Pick<OrderInput, 'tasks' | 'dependencies'>): Task[] {
  const wanted = new Set(explicitBlockerIds(task.id, ctx.dependencies))
  if (wanted.size === 0) return []
  return ctx.tasks.filter((t) => wanted.has(t.id) && t.status !== 'done')
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
