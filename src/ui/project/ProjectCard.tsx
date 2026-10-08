import { Link } from 'react-router-dom'
import { Card, CardAction, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import type { PlanContext } from '../../domain/context'
import { projectHealth } from '../../domain/health'
import { nextTasks } from '../../domain/order'
import type { Project } from '../../domain/types'
import { formatTargetDate } from '../components/format'
import { ProjectSignal } from '../components/HealthBadges'
import { RowMenu } from './RowMenu'
import type { SortableControls } from './SortableList'

/** How many workstreams' next steps a card lists. */
const MAX_NEXT_LINES = 3

/**
 * One project as a card in the Projects masonry: name + one signal, the objective (outcome and date),
 * task progress, the next step of each workstream (up to 3), and this week's load. Cards grow with their outcome text, which is what
 * makes the masonry. Reorder via the (hover) drag handle or the `…` menu.
 */
export function ProjectCard({
  project,
  ctx,
  controls,
}: {
  project: Project
  ctx: PlanContext
  /** Reorder controls (active, non-system projects only). */
  controls?: SortableControls
}) {
  const tasks = ctx.tasks.filter((t) => t.projectId === project.id)
  const done = tasks.filter((t) => t.status === 'done').length
  const open = tasks.length - done
  const planned = tasks.filter((t) => t.weekStart === ctx.weekStart && t.status !== 'done').length
  const active = project.status === 'active'
  const nexts = active ? nextTasks(project.id, ctx) : []
  const streamCount = ctx.milestones.filter((m) => m.projectId === project.id).length
  const streamName = (milestoneId: string | null) =>
    streamCount > 1 ? ctx.milestones.find((m) => m.id === milestoneId)?.name : undefined
  // "No next step" is shown in the Next block, so it is not repeated as a signal.
  const flags = projectHealth(project, ctx).filter((f) => f.kind !== 'no_next_step')
  const date = project.targetDate
    ? `${project.dateKind === 'hard' ? 'Deadline' : 'Target'} ${formatTargetDate(project.targetDate)}`
    : null

  return (
    <Card data-testid="project-card" size="sm" className={cn('group', !active && 'opacity-80')}>
      <CardHeader>
        <CardTitle className="min-w-0">
          <Link
            to={`/projects/${project.id}`}
            className="text-foreground underline-offset-4 outline-none hover:underline focus-visible:underline"
          >
            {project.name}
          </Link>
        </CardTitle>
        <div className="flex min-h-4 flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
          {project.isSystem ? <span>System</span> : <ProjectSignal flags={flags} />}
          {date && !project.isSystem && <span>{date}</span>}
        </div>
        {controls && (
          <CardAction className="flex items-center gap-0.5">
            <span className="opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:hidden">
              {controls.handle}
            </span>
            <RowMenu label={`Project actions: ${project.name}`} controls={controls} />
          </CardAction>
        )}
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        {!project.isSystem && (
          <p className="line-clamp-4 text-sm text-muted-foreground">
            {project.outcome || <em>No outcome set</em>}
          </p>
        )}

        {tasks.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <Progress
              value={(done / tasks.length) * 100}
              aria-label={`${project.name}: ${done} of ${tasks.length} tasks done`}
              className="h-1"
            />
            <span className="text-xs text-muted-foreground tabular-nums">{`${done} of ${tasks.length} done`}</span>
          </div>
        )}

        {active && (
          <div className="rounded-xl bg-muted px-3 py-2">
            <div className="text-xs text-muted-foreground">Next</div>
            {nexts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No next step</p>
            ) : (
              <ul className="flex flex-col gap-0.5">
                {nexts.slice(0, MAX_NEXT_LINES).map((task) => {
                  const stream = streamName(task.milestoneId)
                  return (
                    <li key={task.id} className="line-clamp-2 text-sm">
                      {stream && <span className="text-muted-foreground">{`${stream}: `}</span>}
                      {task.title}
                    </li>
                  )
                })}
                {nexts.length > MAX_NEXT_LINES && (
                  <li className="text-xs text-muted-foreground">{`+${nexts.length - MAX_NEXT_LINES} more`}</li>
                )}
              </ul>
            )}
          </div>
        )}
      </CardContent>

      <CardFooter className="text-xs text-muted-foreground tabular-nums">
        {`${open} open`}
        {active && ` · ${planned} planned this week`}
      </CardFooter>
    </Card>
  )
}
