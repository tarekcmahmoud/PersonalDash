import { ExternalLink } from 'lucide-react'
import { useState } from 'react'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { useApply, useImageSrc } from '../../data/hooks'
import { useServices } from '../../data/services'
import type { ID, Milestone, Resource } from '../../domain/types'
import { ConfirmDialog } from './ConfirmDialog'
import { RowMenu } from './RowMenu'
import { ResourceDialog } from './ResourceDialog'
import { hostnameOf } from './resourceUrl'
import { DIMMED_CLASSES } from './useProjectView'

interface Props {
  resource: Resource
  /** The project's workstreams (to name the linked ones). */
  workstreams: Milestone[]
  /** All resources of the project in grid order (for Move earlier / later). */
  siblings: Resource[]
  /** Greyed out because another workstream is in focus. */
  dimmed?: boolean
  onMove: (id: ID, delta: -1 | 1) => void
}

/**
 * One resource in the grid: optional image on top, the title as an external link, its hostname, a short
 * description and the workstreams it belongs to (grey chips; "Project-wide" when none). Hover `…` menu:
 * edit, move, delete.
 */
export function ResourceCard({ resource, workstreams, siblings, dimmed = false, onMove }: Props) {
  const apply = useApply()
  const { repo } = useServices()
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [imageFailed, setImageFailed] = useState(false)
  const src = useImageSrc(resource)
  const hasImage = !imageFailed && (resource.imagePath !== null || !!resource.imageUrl)

  const host = hostnameOf(resource.url)
  const title = resource.title.trim() || host || resource.url
  const index = siblings.findIndex((r) => r.id === resource.id)
  const linked = workstreams.filter((w) => resource.workstreamIds.includes(w.id)).map((w) => w.name)

  const remove = async () => {
    await apply({ kind: 'deleteResource', id: resource.id })
    if (resource.imagePath) await repo.deleteImage(resource.imagePath).catch(() => undefined)
  }

  return (
    <Card
      data-testid="resource-card"
      data-dimmed={dimmed}
      size="sm"
      className={cn('group gap-3', hasImage && 'pt-0', DIMMED_CLASSES)}
    >
      {hasImage && (
        <a
          href={resource.url}
          target="_blank"
          rel="noreferrer"
          tabIndex={-1}
          aria-hidden
          className="block aspect-video max-h-44 w-full overflow-hidden bg-muted"
        >
          {src && (
            <img
              src={src}
              alt={title}
              loading="lazy"
              onError={() => setImageFailed(true)}
              className="size-full object-cover"
            />
          )}
        </a>
      )}
      <CardHeader className={cn(hasImage && 'pt-0')}>
        <CardTitle className="min-w-0 text-sm leading-snug">
          <a
            href={resource.url}
            target="_blank"
            rel="noreferrer"
            className="inline text-foreground underline-offset-4 outline-none hover:underline focus-visible:underline"
          >
            {title}
            <ExternalLink aria-hidden className="mb-0.5 ml-1 inline size-3 text-muted-foreground" />
          </a>
        </CardTitle>
        {resource.title.trim() && host && (
          <div className="truncate text-xs text-muted-foreground">{host}</div>
        )}
        <CardAction className="-mt-1 -mr-1.5 opacity-100 transition-opacity md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100 [@media(hover:none)]:opacity-100">
          <RowMenu
            label={`Resource actions: ${title}`}
            moveLabels={['Move earlier', 'Move later']}
            controls={{
              isFirst: index <= 0,
              isLast: index === siblings.length - 1,
              move: (delta) => onMove(resource.id, delta),
            }}
            extra={
              <>
                <DropdownMenuItem onSelect={() => setEditing(true)}>Edit…</DropdownMenuItem>
                <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(true)}>
                  Delete…
                </DropdownMenuItem>
              </>
            }
          />
        </CardAction>
      </CardHeader>

      <CardContent className="flex flex-col gap-2.5">
        {resource.description && (
          <p className="line-clamp-4 text-sm break-words text-muted-foreground">{resource.description}</p>
        )}
        <div className="flex flex-wrap gap-1" aria-label="Linked workstreams">
          {(linked.length > 0 ? linked : ['Project-wide']).map((name) => (
            <span
              key={name}
              className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
              data-testid="resource-chip"
            >
              {name}
            </span>
          ))}
        </div>
      </CardContent>

      {editing && (
        <ResourceDialog
          projectId={resource.projectId}
          resource={resource}
          workstreams={workstreams}
          onClose={() => setEditing(false)}
        />
      )}
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={`Delete resource “${title}”?`}
        description="The link is removed from this project. This cannot be undone."
        confirmLabel="Delete resource"
        destructive
        onConfirm={remove}
      />
    </Card>
  )
}
