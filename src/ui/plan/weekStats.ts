import type { PlanContext } from '../../domain/context'
import { plannedHours, weekCapacity, type WeekCapacity } from '../../domain/capacity'
import { followUpsForWeek, type FollowUpItem } from '../../domain/followups'
import { tasksInWeek } from '../../domain/planning'
import type { Task } from '../../domain/types'

export interface WeekStats {
  /** Tasks planned in ctx.weekStart (any status). */
  planned: Task[]
  followUps: FollowUpItem[]
  capacity: WeekCapacity
  /** Hours of unfinished planned tasks plus one S per follow-up. */
  hours: number
}

/** Planned tasks, follow-ups, capacity and planned hours of ctx.weekStart. */
export function weekStats(ctx: PlanContext): WeekStats {
  const planned = tasksInWeek(ctx.tasks, ctx.weekStart)
  const followUps = followUpsForWeek(ctx.tasks, ctx.weekStart, ctx.today)
  const override = ctx.weeks.find((w) => w.weekStart === ctx.weekStart)?.capacityOverride ?? null
  const capacity = weekCapacity(ctx.weekStart, ctx.settings, ctx.events, override)
  return { planned, followUps, capacity, hours: plannedHours(planned, ctx.settings, followUps.length) }
}
