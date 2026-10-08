import type { PlanContext } from './context'
import { projectHealth } from './health'
import type { HealthFlag } from './health'
import { projectWorkstreams, unfinishedBlockers } from './order'
import type { ISODate, Project, Task } from './types'
import { daysBetween } from './week'

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
  return task.size !== 'XL' && task.status !== 'done'
}

/** Tasks planned in the given week (weekStart matches), any status. */
export function tasksInWeek(tasks: Task[], weekStart: ISODate): Task[] {
  return tasks.filter((t) => t.weekStart === weekStart)
}

/**
 * A project's 'todo' tasks taken round-robin across its workstreams (1st of each stream, then 2nd of each…),
 * so every parallel stream's next step shows up first.
 */
function interleaveStreams(projectId: string, ctx: PlanContext): Task[] {
  // Delegated tasks are someone else's to do, so they aren't yours to plan.
  const streams = projectWorkstreams(projectId, ctx).map((w) =>
    w.tasks.filter((t) => t.status === 'todo' && t.assigneeId === null),
  )
  const out: Task[] = []
  for (let i = 0; streams.some((s) => i < s.length); i++) for (const s of streams) if (s[i]) out.push(s[i]!)
  return out
}

/**
 * Pick list for weekly planning: one group per ACTIVE project (system project included),
 * ordered by:
 *   1. projects with a 'below_min' flag first,
 *   2. then projects with a hard targetDate within settings.deadlineWarningDays (or overdue), soonest first,
 *   3. then by rank ascending.
 * Candidates are the project's own (not delegated) 'todo' tasks interleaved across workstreams (see
 * interleaveStreams).
 * `depth` overrides PICK_LIST_DEPTH (used when the user expands a project).
 *
 * A candidate that is already planned is reported as planned, selectable, reason null, whatever its
 * size or blockers (blockedBy is still reported). Otherwise XL takes precedence over 'blocked'.
 */
export function buildPickList(ctx: PlanContext, depth?: Record<string, number>): PickGroup[] {
  const warn = ctx.settings.deadlineWarningDays
  const urgentDate = (p: Project): string | null =>
    p.dateKind === 'hard' && p.targetDate !== null && daysBetween(ctx.today, p.targetDate) <= warn
      ? p.targetDate
      : null

  const groups: PickGroup[] = ctx.projects
    .filter((p) => p.status === 'active')
    .map((project) => {
      const limit = Math.max(0, depth?.[project.id] ?? PICK_LIST_DEPTH)
      const todos = interleaveStreams(project.id, ctx)
      const candidates = todos.slice(0, limit).map((task): PickCandidate => {
        const planned = task.weekStart === ctx.weekStart
        const blockedBy = unfinishedBlockers(task, ctx).filter((b) => b.weekStart !== ctx.weekStart)
        if (planned) return { task, planned, blockedBy, selectable: true, reason: null }
        if (task.size === 'XL') return { task, planned, blockedBy, selectable: false, reason: 'xl' }
        if (blockedBy.length > 0) return { task, planned, blockedBy, selectable: false, reason: 'blocked' }
        return { task, planned, blockedBy, selectable: true, reason: null }
      })
      return {
        project,
        flags: projectHealth(project, ctx),
        candidates,
        hasMore: todos.length > candidates.length,
        plannedCount: tasksInWeek(ctx.tasks, ctx.weekStart).filter((t) => t.projectId === project.id).length,
      }
    })

  // Array.prototype.sort is stable, so groups that compare equal keep their input order.
  return groups.sort((a, b) => {
    const belowA = a.flags.some((f) => f.kind === 'below_min')
    const belowB = b.flags.some((f) => f.kind === 'below_min')
    if (belowA !== belowB) return belowA ? -1 : 1
    const dateA = urgentDate(a.project)
    const dateB = urgentDate(b.project)
    if ((dateA !== null) !== (dateB !== null)) return dateA !== null ? -1 : 1
    if (dateA !== null && dateB !== null && dateA !== dateB) return dateA < dateB ? -1 : 1
    return a.project.rank - b.project.rank
  })
}
