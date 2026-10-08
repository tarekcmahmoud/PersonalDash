import type { PlanContext } from './context'
import type { ISODate, Project } from './types'
import { daysBetween } from './week'

export type HealthFlag =
  /** Active, non-system project with no task planned in the week. */
  | { kind: 'neglected' }
  /** Project has weeklyMin and fewer tasks planned in the week (follow-ups don't count). */
  | { kind: 'below_min'; planned: number; min: number }
  /** targetDate within settings.deadlineWarningDays of today (and not past). */
  | { kind: 'deadline_soon'; date: ISODate; dateKind: 'hard' | 'soft'; daysLeft: number }
  /** targetDate before today and project not done. */
  | { kind: 'overdue'; date: ISODate; dateKind: 'hard' | 'soft'; daysOver: number }
  /** Active project with no remaining todo/waiting tasks — needs breakdown or closing. */
  | { kind: 'no_next_step' }

/**
 * Health flags for one project in ctx.weekStart. Only 'active' projects get flags; [] otherwise.
 * Flag order: neglected, below_min, overdue | deadline_soon, no_next_step.
 */
export function projectHealth(project: Project, ctx: PlanContext): HealthFlag[] {
  if (project.status !== 'active') return []
  const flags: HealthFlag[] = []
  const mine = ctx.tasks.filter((t) => t.projectId === project.id)

  if (!project.isSystem) {
    const planned = mine.filter((t) => t.weekStart === ctx.weekStart).length
    if (planned === 0) flags.push({ kind: 'neglected' })
    if (project.weeklyMin !== null && planned < project.weeklyMin) {
      flags.push({ kind: 'below_min', planned, min: project.weeklyMin })
    }
  }

  if (project.targetDate !== null) {
    const daysLeft = daysBetween(ctx.today, project.targetDate)
    if (daysLeft < 0) {
      flags.push({
        kind: 'overdue',
        date: project.targetDate,
        dateKind: project.dateKind,
        daysOver: -daysLeft,
      })
    } else if (daysLeft <= ctx.settings.deadlineWarningDays) {
      flags.push({ kind: 'deadline_soon', date: project.targetDate, dateKind: project.dateKind, daysLeft })
    }
  }

  if (!project.isSystem && !mine.some((t) => t.status === 'todo' || t.status === 'waiting')) {
    flags.push({ kind: 'no_next_step' })
  }
  return flags
}

/** Number of active non-system projects. */
export function activeProjectCount(projects: Project[]): number {
  return projects.filter((p) => p.status === 'active' && !p.isSystem).length
}

/** True when activeProjectCount > settings.activeCap. */
export function isOverActiveCap(ctx: Pick<PlanContext, 'projects' | 'settings'>): boolean {
  return activeProjectCount(ctx.projects) > ctx.settings.activeCap
}
