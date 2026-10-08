import { Label } from '@primer/react'
import { format, parseISO } from 'date-fns'
import type { Project } from '../../domain/types'
import styles from './ProjectObjective.module.css'

/** "Dec 15", plus the year when it is not the current year ("Mar 1 2027"). */
function formatTargetDate(date: string): string {
  const d = parseISO(date)
  const sameYear = d.getFullYear() === new Date().getFullYear()
  return format(d, sameYear ? 'MMM d' : 'MMM d yyyy')
}

/** A project's "Done when …" outcome and its target date. */
export function ProjectObjective({ project, compact }: { project: Project; compact?: boolean }) {
  const outcome = project.outcome.trim()
  const rootClass = compact ? `${styles.root} ${styles.compact}` : styles.root
  const outcomeClass = outcome ? styles.outcome : `${styles.outcome} ${styles.empty}`

  return (
    <div className={rootClass}>
      <span className={outcomeClass}>{outcome || 'No outcome set'}</span>
      {project.targetDate && (
        <Label variant={project.dateKind === 'hard' ? 'severe' : 'secondary'}>
          {project.dateKind === 'hard'
            ? `Deadline · ${formatTargetDate(project.targetDate)}`
            : `Target · ${formatTargetDate(project.targetDate)}`}
        </Label>
      )}
    </div>
  )
}
