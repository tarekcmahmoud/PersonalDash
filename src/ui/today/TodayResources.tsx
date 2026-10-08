import type { PlanContext } from '../../domain/context'
import { resourcesForTasks } from '../../domain/resources'
import { MasonryGrid } from '../components/MasonryGrid'
import { ResourceCard } from '../project/ResourceCard'
import { resourceTasks } from './resourceTasks'

/**
 * Today's right-hand pane, laid out like the Project page's resources: a heading and a masonry grid of resource
 * cards for the tasks in hand (workstream links first, then project-wide). Each card says which project and
 * task it is for.
 */
export function TodayResources({ ctx }: { ctx: PlanContext }) {
  const { scope, tasks } = resourceTasks(ctx)
  const relevant = resourcesForTasks(tasks, ctx.resources)
  const projectNames = new Map(ctx.projects.map((p) => [p.id, p.name]))

  return (
    <section aria-labelledby="today-resources-heading" className="flex flex-col gap-4">
      <div className="flex min-h-8 items-baseline gap-2">
        <h2 id="today-resources-heading" className="text-base font-medium">
          Resources
          {relevant.length > 0 && (
            <span className="ml-1.5 text-sm font-normal text-muted-foreground/60">{relevant.length}</span>
          )}
        </h2>
        <span className="text-sm text-muted-foreground">
          {scope === 'today' ? "for today's tasks" : "for this week's tasks"}
        </span>
      </div>

      {relevant.length === 0 ? (
        <p className="rounded-3xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
          No resources for these tasks. Add links on a project page and link them to a workstream.
        </p>
      ) : (
        <MasonryGrid className="xl:grid-cols-2">
          {relevant.map(({ resource, tasks: helped }) => {
            const first = helped[0]!.title
            const forTasks = helped.length === 1 ? first : `${first} and ${helped.length - 1} more`
            return (
              <ResourceCard
                key={resource.id}
                resource={resource}
                workstreams={ctx.milestones.filter((m) => m.projectId === resource.projectId)}
                note={`${projectNames.get(resource.projectId) ?? ''} · For ${forTasks}`}
              />
            )
          })}
        </MasonryGrid>
      )}
    </section>
  )
}
