import { format, parseISO } from 'date-fns'
import type { HealthFlag } from '../../domain/health'

/** Hours rounded to 1 decimal, without a trailing ".0". */
export function formatHours(hours: number): string {
  return String(Math.round(hours * 10) / 10)
}

/** "Dec 15", or "Dec 15, 2027" outside the current year. */
export function formatTargetDate(iso: string, now: Date = new Date()): string {
  const d = parseISO(iso)
  return d.getFullYear() === now.getFullYear() ? format(d, 'MMM d') : format(d, 'MMM d, yyyy')
}

export type SignalTone = 'danger' | 'warning' | 'muted'

/**
 * The single most important health signal of a project, or null. Priority:
 * overdue > hard deadline soon > below weekly minimum > nothing planned > soft deadline soon > no next step.
 */
export function topSignal(flags: HealthFlag[]): { text: string; tone: SignalTone } | null {
  const find = <K extends HealthFlag['kind']>(kind: K) =>
    flags.find((f): f is Extract<HealthFlag, { kind: K }> => f.kind === kind)
  const overdue = find('overdue')
  if (overdue) return { text: `Overdue ${overdue.daysOver}d`, tone: 'danger' }
  const soon = find('deadline_soon')
  const due = soon && (soon.daysLeft === 0 ? 'Due today' : `Due in ${soon.daysLeft}d`)
  if (soon && soon.dateKind === 'hard') return { text: due!, tone: 'danger' }
  const below = find('below_min')
  if (below) return { text: `${below.planned} of ${below.min} this week`, tone: 'warning' }
  if (find('neglected')) return { text: 'Nothing planned', tone: 'warning' }
  if (soon) return { text: due!, tone: 'muted' }
  if (find('no_next_step')) return { text: 'No next step', tone: 'muted' }
  return null
}

/** Where a task lives: "Project · Workstream" (or its substream), "Project", or "Inbox". */
export function taskPlace(
  task: { projectId: string | null; milestoneId: string | null },
  projects: { id: string; name: string }[],
  milestones: { id: string; name: string }[],
): string {
  if (!task.projectId) return 'Inbox'
  const project = projects.find((p) => p.id === task.projectId)?.name ?? 'Project'
  const stream = task.milestoneId ? milestones.find((m) => m.id === task.milestoneId)?.name : undefined
  return stream ? `${project} · ${stream}` : project
}
