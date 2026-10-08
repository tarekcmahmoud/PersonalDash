import { MoreHorizontal, Plus } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { useApply, usePlanContext } from '../../data/hooks'
import { projectHealth } from '../../domain/health'
import { nextTask } from '../../domain/order'
import type { ProjectStatus } from '../../domain/types'
import { ProjectSignal } from '../components/HealthBadges'
import { Page } from '../components/Page'
import { ProjectObjective } from '../components/ProjectObjective'
import { ConfirmDialog } from '../project/ConfirmDialog'
import { MilestoneDialog } from '../project/MilestoneDialog'
import { MilestoneHeader } from '../project/MilestoneHeader'
import { projectGroups } from '../project/ordering'
import { ProjectFormDialog } from '../project/ProjectFormDialog'
import { TaskGroup } from '../project/TaskGroup'
import { TaskDialogHost } from '../task/TaskDialogHost'
import { useTaskParam } from '../task/useTaskParam'

export function ProjectPage() {
  const { projectId } = useParams()
  const ctx = usePlanContext()
  const apply = useApply()
  const navigate = useNavigate()
  const { open } = useTaskParam()
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [addingMilestone, setAddingMilestone] = useState(false)

  if (!ctx) {
    return (
      <Page title="Project">
        <div role="status" aria-label="Loading project" className="grid gap-3">
          <Skeleton className="h-8" />
          <Skeleton className="h-8" />
          <Skeleton className="h-8" />
        </div>
      </Page>
    )
  }

  const project = ctx.projects.find((p) => p.id === projectId)
  if (!project) {
    return (
      <Page title="Project not found">
        <p className="text-sm text-muted-foreground">
          This project does not exist. It may have been deleted.
        </p>
        <Button variant="link" className="-ml-4" asChild>
          <Link to="/projects">Back to projects</Link>
        </Button>
      </Page>
    )
  }

  const groups = projectGroups(project.id, ctx.milestones, ctx.tasks)
  const milestones = groups.flatMap((g) => (g.milestone ? [g.milestone] : []))
  const next = nextTask(project.id, ctx)
  const taskCount = ctx.tasks.filter((t) => t.projectId === project.id).length

  const setStatus = (status: ProjectStatus) =>
    void apply({ kind: 'saveProjects', projects: [{ ...project, status }] })

  const remove = async () => {
    await apply({ kind: 'deleteProject', id: project.id })
    navigate('/projects')
  }

  const actions = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Project actions" className="text-muted-foreground">
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {!project.isSystem && (
          <>
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
              Status
            </DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={project.status}
              onValueChange={(v) => setStatus(v as ProjectStatus)}
            >
              <DropdownMenuRadioItem value="active">Active</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="on_hold">On hold</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="done">Done</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem onSelect={() => setEditing(true)}>Edit project…</DropdownMenuItem>
        {!project.isSystem && (
          <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(true)}>
            Delete project…
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )

  const description = (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
      <ProjectObjective project={project} />
      <ProjectSignal flags={projectHealth(project, ctx)} />
    </div>
  )

  const hasMilestones = milestones.length > 0
  return (
    <Page title={project.name} description={description} actions={actions}>
      <div className="flex flex-col gap-4">
        {groups
          // An empty milestone-less group only clutters a project that is organised in milestones.
          .filter((group) => group.milestone || group.tasks.length > 0 || !hasMilestones)
          .map((group) => (
            <TaskGroup
              key={group.milestone?.id ?? 'none'}
              project={project}
              group={group}
              ctx={ctx}
              nextId={next?.id ?? null}
              onOpenTask={(t) => open(t.id)}
              header={
                group.milestone ? (
                  <MilestoneHeader
                    milestone={group.milestone}
                    siblings={milestones}
                    taskCount={group.tasks.length}
                  />
                ) : undefined
              }
            />
          ))}
        <Button
          variant="ghost"
          size="sm"
          className="self-start px-2 font-normal text-muted-foreground"
          onClick={() => setAddingMilestone(true)}
        >
          <Plus /> Add milestone
        </Button>
      </div>

      {editing && <ProjectFormDialog project={project} onClose={() => setEditing(false)} />}
      {addingMilestone && (
        <MilestoneDialog
          projectId={project.id}
          nextPosition={milestones.length > 0 ? Math.max(...milestones.map((m) => m.position)) + 1 : 0}
          onClose={() => setAddingMilestone(false)}
        />
      )}
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={`Delete “${project.name}”?`}
        description={`This permanently deletes the project, its ${milestones.length} milestone${milestones.length === 1 ? '' : 's'} and ${taskCount} task${taskCount === 1 ? '' : 's'}.`}
        confirmLabel="Delete project"
        destructive
        onConfirm={remove}
      />
      <TaskDialogHost />
    </Page>
  )
}
