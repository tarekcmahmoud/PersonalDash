import { MoreHorizontal, Plus } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { useApply, usePlanContext } from '../../data/hooks'
import { activeProjectCount, isOverActiveCap } from '../../domain/health'
import type { Project } from '../../domain/types'
import { MasonryGrid } from '../components/MasonryGrid'
import { Page } from '../components/Page'
import { CollapsibleGroup } from '../project/CollapsibleGroup'
import { ProjectFormDialog } from '../project/ProjectFormDialog'
import { ProjectCard } from '../project/ProjectCard'
import { SortableList } from '../project/SortableList'

const byRank = (a: Project, b: Project): number => a.rank - b.rank

export function ProjectsPage() {
  const ctx = usePlanContext()
  const apply = useApply()
  const navigate = useNavigate()
  const [creating, setCreating] = useState(false)

  const actions = (
    <>
      <Button onClick={() => setCreating(true)}>
        <Plus /> New project
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="More actions" className="text-muted-foreground">
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => navigate('/import')}>Import breakdown</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => navigate('/templates')}>New from template</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  )

  if (!ctx) {
    return (
      <Page title="Projects" actions={actions} wide>
        <div role="status" aria-label="Loading projects" className="grid gap-4">
          <Skeleton className="h-48 rounded-3xl" />
          <Skeleton className="h-48 rounded-3xl" />
          <Skeleton className="h-48 rounded-3xl" />
        </div>
      </Page>
    )
  }

  const system = ctx.projects.find((p) => p.isSystem)
  const regular = ctx.projects.filter((p) => !p.isSystem)
  const active = regular.filter((p) => p.status === 'active').sort(byRank)
  const onHold = regular.filter((p) => p.status === 'on_hold').sort(byRank)
  const done = regular.filter((p) => p.status === 'done').sort(byRank)

  const reorder = async (ordered: Project[]) => {
    const changed = ordered
      .map((p, i) => ({ ...p, rank: i + 1 }))
      .filter((p, i) => p.rank !== ordered[i]!.rank)
    if (changed.length === 0) return
    try {
      await apply({ kind: 'saveProjects', projects: changed })
    } catch {
      toast.error('Could not save the new order. Please try again.')
    }
  }

  return (
    <Page title="Projects" actions={actions} wide>
      {isOverActiveCap(ctx) && (
        <p className="-mt-2 mb-4 text-sm text-warning">
          {`${activeProjectCount(ctx.projects)} active projects — more than your cap of ${ctx.settings.activeCap}. Consider putting one on hold.`}
        </p>
      )}

      <section aria-label="Active projects" className="flex flex-col gap-8">
        {active.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No active projects. Create one, or reactivate a project below.
          </p>
        )}
        <SortableList
          layout="grid"
          items={active}
          onReorder={(items) => void reorder(items)}
          label={(p) => p.name}
          renderItem={(p, controls) => <ProjectCard project={p} ctx={ctx} controls={controls} />}
          container={(cards) => (
            <MasonryGrid>
              {cards}
              {system && <ProjectCard key={system.id} project={system} ctx={ctx} />}
            </MasonryGrid>
          )}
        />

        {onHold.length > 0 && (
          <CollapsibleGroup heading label="On hold" count={onHold.length}>
            <MasonryGrid className="mt-3">
              {onHold.map((p) => (
                <ProjectCard key={p.id} project={p} ctx={ctx} />
              ))}
            </MasonryGrid>
          </CollapsibleGroup>
        )}

        {done.length > 0 && (
          <CollapsibleGroup heading label="Done" count={done.length}>
            <MasonryGrid className="mt-3">
              {done.map((p) => (
                <ProjectCard key={p.id} project={p} ctx={ctx} />
              ))}
            </MasonryGrid>
          </CollapsibleGroup>
        )}
      </section>

      {creating && (
        <ProjectFormDialog
          onClose={() => setCreating(false)}
          onSaved={(p) => navigate(`/projects/${p.id}`)}
        />
      )}
    </Page>
  )
}
