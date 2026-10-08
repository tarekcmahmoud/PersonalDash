import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { taskHref, useTaskActions } from '../../data/taskActions'
import type { PickCandidate, PickGroup } from '../../domain/planning'
import type { ISODate } from '../../domain/types'
import { ProjectSignal } from '../components/HealthBadges'
import { TaskRow } from '../components/TaskRow'

function reasonText(c: PickCandidate): string | null {
  if (c.reason === 'xl') return 'Split first'
  if (c.reason === 'blocked') return `After: ${c.blockedBy.map((b) => b.title).join(', ')}`
  return null
}

/** One project in the pick list: name, one signal, planned count and its next tasks with a "plan" checkbox. */
export function PickGroupCard({
  group,
  weekStart,
  onShowMore,
}: {
  group: PickGroup
  weekStart: ISODate
  onShowMore: () => void
}) {
  const actions = useTaskActions()
  const navigate = useNavigate()
  const { project } = group

  return (
    <Card role="region" aria-label={project.name} size="sm" className="gap-2">
      <CardHeader>
        <CardTitle className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-0.5">
          <h3 className="min-w-0">
            <Link to={`/projects/${project.id}`} className="underline-offset-4 hover:underline">
              {project.name}
            </Link>
          </h3>
          <ProjectSignal flags={group.flags} />
        </CardTitle>
        <CardAction className="text-xs text-muted-foreground tabular-nums">
          {group.plannedCount} planned
        </CardAction>
      </CardHeader>

      <CardContent>
        {group.candidates.length === 0 && (
          <p className="py-1 text-sm text-muted-foreground">No open tasks.</p>
        )}
        <div className="divide-y">
          {group.candidates.map((c) => (
            <div key={c.task.id} className="flex items-start gap-2">
              {/* The label widens the tap target to 32px around the checkbox, like TaskRow's own. */}
              <label className="mt-0.5 -ml-2 flex size-8 shrink-0 cursor-pointer items-center justify-center">
                <Checkbox
                  checked={c.planned}
                  disabled={!c.selectable}
                  aria-label={`Plan "${c.task.title}" this week`}
                  onCheckedChange={() =>
                    void (c.planned ? actions.unplan(c.task) : actions.plan(c.task, weekStart))
                  }
                />
              </label>
              <TaskRow
                className="min-w-0 flex-1"
                task={c.task}
                muted={!c.selectable}
                note={reasonText(c)}
                onOpen={(t) => navigate(taskHref(t))}
              />
            </div>
          ))}
        </div>

        {group.hasMore && (
          <Button
            variant="link"
            size="sm"
            className="-ml-2 text-xs text-muted-foreground"
            onClick={onShowMore}
            aria-label={`Show more tasks for ${project.name}`}
          >
            Show more
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
