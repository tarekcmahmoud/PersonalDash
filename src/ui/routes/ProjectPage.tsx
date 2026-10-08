import { Crosshair, MoreHorizontal, Plus } from 'lucide-react'
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
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { cn } from '@/lib/utils'
import { useApply, usePlanContext } from '../../data/hooks'
import { useServices } from '../../data/services'
import { projectHealth } from '../../domain/health'
import { nextTasks, projectWorkstreams } from '../../domain/order'
import type { ProjectStatus } from '../../domain/types'
import { ProjectSignal } from '../components/HealthBadges'
import { Page } from '../components/Page'
import { ProjectObjective } from '../components/ProjectObjective'
import { ConfirmDialog } from '../project/ConfirmDialog'
import { MilestoneDialog } from '../project/MilestoneDialog'
import { MilestoneHeader } from '../project/MilestoneHeader'
import { sortedResources } from '../project/ordering'
import { ProjectFormDialog } from '../project/ProjectFormDialog'
import { ResourcesPane } from '../project/ResourcesPane'
import { TaskGroup } from '../project/TaskGroup'
import { useFocus, useProjectPane, type ProjectPane } from '../project/useProjectView'
import { TaskDialogHost } from '../task/TaskDialogHost'
import { useTaskParam } from '../task/useTaskParam'

/** The pane switch is active navigation, so its selected segment may use the accent fill. */
const PANE_ITEM = 'flex-1 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground'

export function ProjectPage() {
  const { projectId } = useParams()
  const ctx = usePlanContext()
  const apply = useApply()
  const { repo } = useServices()
  const navigate = useNavigate()
  const { open } = useTaskParam()
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [addingMilestone, setAddingMilestone] = useState(false)
  const [pane, setPane] = useProjectPane()
  const projectMilestones = ctx?.milestones.filter((m) => m.projectId === projectId) ?? []
  const { focusId, setFocus, exitFocus } = useFocus(projectMilestones.map((m) => m.id))

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

  const milestones = [...projectMilestones].sort((a, b) => a.position - b.position)
  // Workstreams run in parallel: each has its own next step.
  const nextIds = new Set(nextTasks(project.id, ctx).map((t) => t.id))
  const streams = projectWorkstreams(project.id, ctx).map((w) => ({
    milestone: w.id ? (milestones.find((m) => m.id === w.id) ?? null) : null,
    tasks: w.tasks,
  }))
  // A project without any task or workstream still needs a card to add its first tasks to.
  const groups = streams.length === 0 ? [{ milestone: null, tasks: [] }] : streams
  const hasWorkstreams = milestones.length > 0
  const resources = sortedResources(ctx.resources, project.id)
  const focused = milestones.find((m) => m.id === focusId) ?? null
  const taskCount = ctx.tasks.filter((t) => t.projectId === project.id).length

  const setStatus = (status: ProjectStatus) =>
    void apply({ kind: 'saveProjects', projects: [{ ...project, status }] })

  const remove = async () => {
    // Uploaded resource images live in storage, outside the project's rows: remove them too (best effort).
    const images = resources.flatMap((r) => (r.imagePath ? [r.imagePath] : []))
    await apply({ kind: 'deleteProject', id: project.id })
    await Promise.allSettled(images.map((path) => repo.deleteImage(path)))
    navigate('/projects')
  }

  const focusControl = (
    <div className="flex items-center gap-1">
      {focused && (
        <span className="mr-1 flex items-center gap-1 text-sm text-muted-foreground">
          <span>
            Focusing on <span className="text-foreground">{focused.name}</span>
          </span>
          <span aria-hidden>·</span>
          <Button
            variant="link"
            size="sm"
            className="h-8 px-1 font-normal text-muted-foreground"
            aria-label="Exit focus mode"
            onClick={exitFocus}
          >
            Exit
          </Button>
        </span>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" disabled={milestones.length === 0}>
            <Crosshair /> Focus
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
            Focus on a workstream
          </DropdownMenuLabel>
          <DropdownMenuRadioGroup value={focusId ?? ''} onValueChange={setFocus}>
            {milestones.map((m) => (
              <DropdownMenuRadioItem key={m.id} value={m.id}>
                {m.name}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          {focused && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={exitFocus}>Exit focus</DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )

  const actions = (
    <>
      {focusControl}
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
    </>
  )

  const description = (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
      <ProjectObjective project={project} />
      <ProjectSignal flags={projectHealth(project, ctx)} />
    </div>
  )

  const paneClass = (name: ProjectPane) => cn('min-w-0', pane !== name && 'max-lg:hidden')
  return (
    <Page wide title={project.name} description={description} actions={actions}>
      <ToggleGroup
        type="single"
        variant="outline"
        aria-label="Project view"
        value={pane}
        onValueChange={(v) => v && setPane(v as ProjectPane)}
        className="mb-4 w-full lg:hidden"
      >
        <ToggleGroupItem value="workstreams" className={PANE_ITEM}>
          Workstreams
        </ToggleGroupItem>
        <ToggleGroupItem value="resources" className={PANE_ITEM}>
          Resources
        </ToggleGroupItem>
      </ToggleGroup>

      <div className="grid items-start gap-x-8 gap-y-6 lg:grid-cols-[minmax(360px,2fr)_3fr]">
        <section
          aria-labelledby="workstreams-heading"
          data-pane="workstreams"
          data-active={pane === 'workstreams'}
          className={cn(paneClass('workstreams'), 'flex flex-col gap-4')}
        >
          <div className="flex min-h-8 items-center">
            <h2 id="workstreams-heading" className="text-base font-medium">
              Workstreams
              {milestones.length > 0 && (
                <span className="ml-1.5 text-sm font-normal text-muted-foreground/60">
                  {milestones.length}
                </span>
              )}
            </h2>
          </div>
          {groups.map((stream) => (
            <TaskGroup
              key={stream.milestone?.id ?? 'none'}
              project={project}
              group={stream}
              ctx={ctx}
              nextIds={nextIds}
              dimmed={focusId !== null && stream.milestone?.id !== focusId}
              onOpenTask={(t) => open(t.id)}
              header={
                stream.milestone ? (
                  <MilestoneHeader
                    milestone={stream.milestone}
                    siblings={milestones}
                    taskCount={stream.tasks.length}
                    focused={stream.milestone.id === focusId}
                    onToggleFocus={() =>
                      stream.milestone!.id === focusId ? exitFocus() : setFocus(stream.milestone!.id)
                    }
                  />
                ) : hasWorkstreams ? (
                  <h3 className="min-h-8 content-center text-base font-medium">No workstream</h3>
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
            <Plus /> Add workstream
          </Button>
        </section>

        <div data-pane="resources" data-active={pane === 'resources'} className={paneClass('resources')}>
          <ResourcesPane project={project} resources={resources} workstreams={milestones} focusId={focusId} />
        </div>
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
        description={`This permanently deletes the project, its ${milestones.length} workstream${milestones.length === 1 ? '' : 's'}, ${resources.length} resource${resources.length === 1 ? '' : 's'} and ${taskCount} task${taskCount === 1 ? '' : 's'}.`}
        confirmLabel="Delete project"
        destructive
        onConfirm={remove}
      />
      <TaskDialogHost />
    </Page>
  )
}
