import type { PlanContext } from './context'
import type { ISODate, Project } from './types'

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

/** Health flags for one project in ctx.weekStart. Only 'active' projects get flags; [] otherwise. */
export function projectHealth(project: Project, ctx: PlanContext): HealthFlag[] {
  void project
  void ctx
  throw new Error('not implemented')
}

/** Number of active non-system projects. */
export function activeProjectCount(projects: Project[]): number {
  void projects
  throw new Error('not implemented')
}

/** True when activeProjectCount > settings.activeCap. */
export function isOverActiveCap(ctx: Pick<PlanContext, 'projects' | 'settings'>): boolean {
  void ctx
  throw new Error('not implemented')
}
