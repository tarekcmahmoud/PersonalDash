import type { PlanContext } from '../../domain/context'
import type { Task } from '../../domain/types'
import { weekStats } from '../plan/weekStats'

/**
 * The tasks whose resources Today shows: what is on today's list (open tasks pinned today, overdue pins, due
 * follow-ups); with nothing there, the rest of the week's open tasks.
 */
export function resourceTasks(ctx: PlanContext): { scope: 'today' | 'week'; tasks: Task[] } {
  const { today } = ctx
  const stats = weekStats(ctx)
  const onToday = [
    ...ctx.tasks.filter((t) => t.pinnedDay === today && t.status !== 'done'),
    ...ctx.tasks.filter((t) => t.pinnedDay !== null && t.pinnedDay < today && t.status !== 'done'),
    ...stats.followUps.filter((f) => f.date <= today).map((f) => f.task),
  ]
  if (onToday.length > 0) return { scope: 'today', tasks: onToday }
  return { scope: 'week', tasks: stats.planned.filter((t) => t.status !== 'done') }
}
