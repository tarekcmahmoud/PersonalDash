import { Label } from '@primer/react'
import { Link } from 'react-router-dom'
import { taskHref } from '../../data/taskActions'
import type { PlanContext } from '../../domain/context'
import { projectHealth } from '../../domain/health'
import { nextTask } from '../../domain/order'
import { HealthBadges } from '../components/HealthBadges'
import { ProjectObjective } from '../components/ProjectObjective'
import { SizeLabel } from '../components/SizeLabel'
import styles from './ProjectsOverview.module.css'

/** One card per active project (by rank): health, objective, next task and whether it is planned this week. */
export function ProjectsOverview({ ctx }: { ctx: PlanContext }) {
  const projects = ctx.projects.filter((p) => p.status === 'active').sort((a, b) => a.rank - b.rank)

  return (
    <div className={styles.list}>
      {projects.map((project) => {
        const next = nextTask(project.id, ctx)
        const flags = projectHealth(project, ctx)
        const plannedCount = ctx.tasks.filter(
          (t) => t.projectId === project.id && t.weekStart === ctx.weekStart,
        ).length
        return (
          <article key={project.id} className={styles.card} aria-label={project.name}>
            <div className={styles.head}>
              <h3 className={styles.name}>
                <Link to={`/projects/${project.id}`}>{project.name}</Link>
              </h3>
              <HealthBadges flags={flags} />
            </div>
            {!project.isSystem && <ProjectObjective project={project} compact />}
            <div className={styles.next}>
              {next ? (
                <>
                  <span className={styles.nextLabel}>Next</span>
                  <Link to={taskHref(next)} className={styles.nextTitle}>
                    {next.title}
                  </Link>
                  <SizeLabel size={next.size} />
                  {next.weekStart === ctx.weekStart && <Label variant="success">Planned this week</Label>}
                </>
              ) : (
                <span className={styles.nextLabel}>No ready task</span>
              )}
            </div>
            <div className={styles.planned}>
              {plannedCount > 0 ? `${plannedCount} planned this week` : 'Nothing planned this week'}
            </div>
          </article>
        )
      })}
    </div>
  )
}
