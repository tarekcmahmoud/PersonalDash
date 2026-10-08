import type { PlanContext } from './context'
import type { ID, ISODate, Project, Task } from './types'
import { addDaysISO, fromISODate } from './week'

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
  const from = fromISODate(weekStart).getTime()
  const to = fromISODate(addDaysISO(weekStart, 7)).getTime() // exclusive: next Monday 00:00 local

  const done = ctx.tasks
    .filter((t) => {
      if (!t.completedAt) return false
      const at = new Date(t.completedAt).getTime()
      return at >= from && at < to
    })
    .sort((a, b) => new Date(a.completedAt!).getTime() - new Date(b.completedAt!).getTime())

  const rankOf = new Map(ctx.projects.map((p) => [p.id, p.rank]))
  const groups = new Map<ID | null, Task[]>()
  for (const t of done) {
    const list = groups.get(t.projectId)
    if (list) list.push(t)
    else groups.set(t.projectId, [t])
  }
  // Inbox (null) last; unknown projects after known ones, before Inbox.
  const groupOrder = (id: ID | null): number =>
    id === null ? Infinity : (rankOf.get(id) ?? Number.MAX_SAFE_INTEGER)
  const doneByProject = [...groups.entries()]
    .map(([projectId, tasks]) => ({ projectId, tasks }))
    .sort((a, b) => {
      const ra = groupOrder(a.projectId)
      const rb = groupOrder(b.projectId)
      return ra === rb ? 0 : ra < rb ? -1 : 1
    })

  const leftovers = ctx.tasks.filter((t) => t.weekStart === weekStart && t.status !== 'done')

  const touched = new Set(done.map((t) => t.projectId))
  const untouched = ctx.projects
    .filter((p) => p.status === 'active' && !p.isSystem && !touched.has(p.id))
    .sort((a, b) => a.rank - b.rank)

  return { weekStart, doneByProject, leftovers, untouched, totalDone: done.length }
}

const dirtyAfter = (task: Task): boolean => (task.gcalEventId ? true : task.gcalDirty)

/** Patch: move an unfinished task into nextWeekStart, slipCount + 1, pinnedDay cleared, gcalDirty if it had an event. */
export function carryOver(task: Task, nextWeekStart: ISODate): Partial<Task> {
  return {
    weekStart: nextWeekStart,
    pinnedDay: null,
    slipCount: task.slipCount + 1,
    gcalDirty: dirtyAfter(task),
  }
}

/** Patch: unplan an unfinished task (weekStart & pinnedDay null), slipCount + 1, gcalDirty if it had an event. */
export function returnToProject(task: Task): Partial<Task> {
  return {
    weekStart: null,
    pinnedDay: null,
    slipCount: task.slipCount + 1,
    gcalDirty: dirtyAfter(task),
  }
}

export const isChronicSlipper = (task: Task): boolean => task.slipCount >= CHRONIC_SLIP_THRESHOLD

/** Patch for completing a task (status done, completedAt = nowIso, gcalDirty if pinned with an event). */
export function completeTask(task: Task, nowIso: string): Partial<Task> {
  return { status: 'done', completedAt: nowIso, gcalDirty: dirtyAfter(task) }
}

/** Patch for un-completing a task. */
export function reopenTask(task: Task): Partial<Task> {
  return { status: 'todo', completedAt: null, gcalDirty: dirtyAfter(task) }
}
