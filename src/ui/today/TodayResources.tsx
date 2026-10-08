import { ExternalLink } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { resourcesForTasks } from '../../domain/resources'
import type { Resource, Task } from '../../domain/types'
import { CardSection } from '../components/Page'
import { hostnameOf } from '../project/resourceUrl'

/** Rows shown before "Show all". */
const COLLAPSED_COUNT = 5

/**
 * The project resources that help with `tasks` (workstream links first, then project-wide), as one-line links
 * with grey metadata: hostname and the task they are for. Renders nothing when no task has resources.
 */
export function TodayResources({
  title,
  tasks,
  resources,
}: {
  title: string
  tasks: Task[]
  resources: Resource[]
}) {
  const [expanded, setExpanded] = useState(false)
  const relevant = resourcesForTasks(tasks, resources)
  if (relevant.length === 0) return null
  const shown = expanded ? relevant : relevant.slice(0, COLLAPSED_COUNT)

  return (
    <CardSection title={title} count={relevant.length}>
      <ul className="divide-y" aria-label={title}>
        {shown.map(({ resource, tasks: helped }) => {
          const host = hostnameOf(resource.url)
          const label = resource.title.trim() || host || resource.url
          const forTasks =
            helped.length === 1 ? helped[0]!.title : `${helped[0]!.title} and ${helped.length - 1} more`
          return (
            <li key={resource.id} className="flex min-h-11 flex-col justify-center py-1.5">
              <a
                href={resource.url}
                target="_blank"
                rel="noreferrer"
                className="min-w-0 truncate text-sm text-foreground underline-offset-4 outline-none hover:underline focus-visible:underline"
              >
                {label}
                <ExternalLink aria-hidden className="mb-0.5 ml-1 inline size-3 text-muted-foreground" />
              </a>
              <span className="truncate text-xs text-muted-foreground">
                {resource.title.trim() && host ? `${host} · ` : ''}For {forTasks}
              </span>
            </li>
          )
        })}
      </ul>
      {relevant.length > COLLAPSED_COUNT && (
        <Button
          variant="link"
          className="mt-1 h-8 p-0 text-sm text-muted-foreground"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? 'Show fewer' : `Show all ${relevant.length}`}
        </Button>
      )}
    </CardSection>
  )
}
