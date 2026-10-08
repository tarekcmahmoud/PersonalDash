import { ArrowRight } from 'lucide-react'
import { Fragment } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useApply, useSnapshot } from '../../data/hooks'
import type { ID, Task } from '../../domain/types'
import { endPosition } from '../project/ordering'

/**
 * "File to…" menu: move an Inbox task into an active project (optionally into one of its milestones).
 * Lists each project, followed by its "Project › Milestone" items.
 */
export function FileToMenu({ task }: { task: Task }) {
  const { data } = useSnapshot()
  const apply = useApply()
  if (!data) return null

  const projects = data.projects
    .filter((p) => p.status === 'active')
    .sort((a, b) => Number(a.isSystem) - Number(b.isSystem) || a.rank - b.rank)

  const fileTo = (projectId: ID, milestoneId: ID | null) =>
    void apply({
      kind: 'saveTasks',
      tasks: [{ ...task, projectId, milestoneId, position: endPosition(data.tasks, projectId, milestoneId) }],
    })

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label={`File to… ${task.title}`}
          className="shrink-0 text-muted-foreground"
        >
          File to… <ArrowRight />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-80 w-64">
        {projects.map((p, i) => {
          const milestones = data.milestones
            .filter((m) => m.projectId === p.id)
            .sort((a, b) => a.position - b.position)
          return (
            <Fragment key={p.id}>
              {i > 0 && <DropdownMenuSeparator />}
              <DropdownMenuItem onSelect={() => fileTo(p.id, null)}>{p.name}</DropdownMenuItem>
              {milestones.map((m) => (
                <DropdownMenuItem key={m.id} className="pl-5" onSelect={() => fileTo(p.id, m.id)}>
                  <span className="text-muted-foreground">{`${p.name} ›`}</span> {m.name}
                </DropdownMenuItem>
              ))}
            </Fragment>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
