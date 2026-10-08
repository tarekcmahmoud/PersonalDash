import { Label } from '@primer/react'
import type { ReactNode } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { projectHealth } from '../../domain/health'
import type { PlanContext } from '../../domain/context'
import { nextTask } from '../../domain/order'
import type { Project } from '../../domain/types'
import { HealthBadges } from '../components/HealthBadges'
import { ProjectObjective } from '../components/ProjectObjective'
import styles from './ProjectRow.module.css'

/** One project in the Projects list: name, objective, health, next step and task counts. */
export function ProjectRow({
  project,
  ctx,
  controls,
}: {
  project: Project
  ctx: PlanContext
  /** Reorder controls (active projects only). */
  controls?: ReactNode
}) {
  const mine = ctx.tasks.filter((t) => t.projectId === project.id)
  const open = mine.filter((t) => t.status !== 'done').length
  const done = mine.length - open
  const next = project.status === 'active' ? nextTask(project.id, ctx) : null

  return (
    <div className={styles.row} data-testid="project-row">
      <div className={styles.head}>
        <RouterLink to={`/projects/${project.id}`} className={styles.name}>
          {project.name}
        </RouterLink>
        {project.isSystem && <Label variant="secondary">System</Label>}
        {controls && <div className={styles.controls}>{controls}</div>}
      </div>
      <ProjectObjective project={project} compact />
      <HealthBadges flags={projectHealth(project, ctx)} />
      <div className={styles.foot}>
        {project.status === 'active' && (
          <span className={styles.next}>
            <span className={styles.muted}>Next: </span>
            {next ? next.title : <span className={styles.muted}>No next step</span>}
          </span>
        )}
        <span className={styles.muted}>{`${open} open · ${done} done`}</span>
      </div>
    </div>
  )
}
