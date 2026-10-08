import type { Project } from '../../domain/types'
import { cn } from '@/lib/utils'
import { formatTargetDate } from './format'

/** Objective as one grey line: outcome · "Deadline Dec 15" (hard) or "Target Dec 15" (soft). */
export function ProjectObjective({ project, compact }: { project: Project; compact?: boolean }) {
  const date = project.targetDate
    ? `${project.dateKind === 'hard' ? 'Deadline' : 'Target'} ${formatTargetDate(project.targetDate)}`
    : null
  return (
    <p className={cn('text-sm text-muted-foreground', compact && 'truncate')}>
      {project.outcome ? project.outcome : <em>No outcome set</em>}
      {date && <span className="text-muted-foreground/70"> · {date}</span>}
    </p>
  )
}
