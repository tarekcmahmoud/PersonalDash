import { Link } from 'react-router-dom'
import type { PlanContext } from '../../domain/context'
import { projectHealth } from '../../domain/health'
import { nextTask } from '../../domain/order'
import type { Project } from '../../domain/types'
import { ProjectSignal } from '../components/HealthBadges'
import { RowMenu } from './RowMenu'
import type { SortableControls } from './SortableList'

/**
 * One project in the Projects list, on up to three quiet lines: name · signal · open count, then the
 * outcome, then "Next: …". Reorder via the (hover) drag handle on desktop, the `…` menu on phones.
 */
export function ProjectRow({
  project,
  ctx,
  controls,
}: {
  project: Project
  ctx: PlanContext
  /** Reorder controls (active, non-system projects only). */
  controls?: SortableControls
}) {
  const open = ctx.tasks.filter((t) => t.projectId === project.id && t.status !== 'done').length
  const active = project.status === 'active'
  const next = active ? nextTask(project.id, ctx) : null
  // "No next step" is shown on the Next line, so it is not repeated as a signal.
  const flags = projectHealth(project, ctx).filter((f) => f.kind !== 'no_next_step')

  return (
    <div data-testid="project-row" className="group flex items-start gap-1 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-baseline gap-3">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-0.5">
            <Link
              to={`/projects/${project.id}`}
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              {project.name}
            </Link>
            {project.isSystem ? (
              <span className="text-xs text-muted-foreground">System</span>
            ) : (
              <ProjectSignal flags={flags} />
            )}
          </div>
          <span className="ml-auto shrink-0 text-xs text-muted-foreground tabular-nums">{`${open} open`}</span>
        </div>
        {(project.outcome || !project.isSystem) && (
          <p className="truncate text-sm text-muted-foreground">
            {project.outcome || <em>No outcome set</em>}
          </p>
        )}
        {active && (
          <p className="truncate text-sm text-muted-foreground">
            {next ? `Next: ${next.title}` : 'No next step'}
          </p>
        )}
      </div>
      {!controls && <div aria-hidden className="w-8 shrink-0 md:w-6" />}
      {controls && (
        <div className="-my-0.5 hidden w-6 shrink-0 justify-center opacity-100 transition-opacity md:flex md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100 [@media(hover:none)]:opacity-100">
          {controls.handle}
        </div>
      )}
      {controls && (
        <RowMenu label={`Project actions: ${project.name}`} controls={controls} className="-my-1 md:hidden" />
      )}
    </div>
  )
}
