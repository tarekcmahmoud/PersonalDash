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
import { Card, CardContent } from '@/components/ui/card'
import { CardSection, Page } from '../components/Page'
import { CollapsibleGroup } from '../project/CollapsibleGroup'
import { ProjectFormDialog } from '../project/ProjectFormDialog'
import { ProjectRow } from '../project/ProjectRow'
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
      <Page title="Projects" actions={actions}>
        <div role="status" aria-label="Loading projects" className="grid gap-4">
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
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
    <Page title="Projects" actions={actions}>
      {isOverActiveCap(ctx) && (
        <p className="-mt-2 mb-4 text-sm text-warning">
          {`${activeProjectCount(ctx.projects)} active projects — more than your cap of ${ctx.settings.activeCap}. Consider putting one on hold.`}
        </p>
      )}

      <div className="flex flex-col gap-4">
        <CardSection title="Active" count={active.length}>
          {active.length === 0 ? (
            <p className="py-2 text-sm text-muted-foreground">
              No active projects. Create one, or reactivate a project below.
            </p>
          ) : (
            <SortableList
              className="divide-y"
              items={active}
              onReorder={(items) => void reorder(items)}
              label={(p) => p.name}
              renderItem={(p, controls) => <ProjectRow project={p} ctx={ctx} controls={controls} />}
            />
          )}
          {system && (
            <div className="border-t">
              <ProjectRow project={system} ctx={ctx} />
            </div>
          )}
        </CardSection>

        {onHold.length > 0 && (
          <Card size="sm" className="py-2">
            <CardContent>
              <CollapsibleGroup heading label="On hold" count={onHold.length}>
                <div className="divide-y">
                  {onHold.map((p) => (
                    <ProjectRow key={p.id} project={p} ctx={ctx} />
                  ))}
                </div>
              </CollapsibleGroup>
            </CardContent>
          </Card>
        )}

        {done.length > 0 && (
          <Card size="sm" className="py-2">
            <CardContent>
              <CollapsibleGroup heading label="Done" count={done.length}>
                <div className="divide-y">
                  {done.map((p) => (
                    <ProjectRow key={p.id} project={p} ctx={ctx} />
                  ))}
                </div>
              </CollapsibleGroup>
            </CardContent>
          </Card>
        )}
      </div>

      {creating && (
        <ProjectFormDialog
          onClose={() => setCreating(false)}
          onSaved={(p) => navigate(`/projects/${p.id}`)}
        />
      )}
    </Page>
  )
}
