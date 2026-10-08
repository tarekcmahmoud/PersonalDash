import { Plus } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useApply } from '../../data/hooks'
import type { ID, Milestone, Project, Resource } from '../../domain/types'
import { MasonryGrid } from '../components/MasonryGrid'
import { renumber } from './ordering'
import { ResourceCard } from './ResourceCard'
import { ResourceDialog } from './ResourceDialog'
import { resourceDimmed } from './useProjectView'

/** The right-hand half of the Project page: a title, "Add resource" and a masonry grid of resource cards. */
export function ResourcesPane({
  project,
  resources,
  workstreams,
  focusId,
}: {
  project: Project
  resources: Resource[]
  workstreams: Milestone[]
  focusId: ID | null
}) {
  const apply = useApply()
  const [adding, setAdding] = useState(false)

  const move = (id: ID, delta: -1 | 1) => {
    const next = [...resources]
    const from = next.findIndex((r) => r.id === id)
    const [item] = next.splice(from, 1)
    next.splice(from + delta, 0, item!)
    const changed = renumber(next)
    if (changed.length > 0) void apply({ kind: 'saveResources', resources: changed })
  }

  return (
    <section aria-labelledby="resources-heading" className="flex flex-col gap-4">
      <div className="flex min-h-8 items-center justify-between gap-3">
        <h2 id="resources-heading" className="text-base font-medium">
          Resources
          {resources.length > 0 && (
            <span className="ml-1.5 text-sm font-normal text-muted-foreground/60">{resources.length}</span>
          )}
        </h2>
        <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
          <Plus /> Add resource
        </Button>
      </div>

      {resources.length === 0 ? (
        <p className="rounded-3xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
          No resources yet. Save the links, docs and references this project needs.
        </p>
      ) : (
        <MasonryGrid className="xl:grid-cols-2">
          {resources.map((resource) => (
            <ResourceCard
              key={resource.id}
              resource={resource}
              workstreams={workstreams}
              siblings={resources}
              dimmed={resourceDimmed(resource.workstreamIds, focusId)}
              onMove={move}
            />
          ))}
        </MasonryGrid>
      )}

      {adding && (
        <ResourceDialog projectId={project.id} workstreams={workstreams} onClose={() => setAdding(false)} />
      )}
    </section>
  )
}
