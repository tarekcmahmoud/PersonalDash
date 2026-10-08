import { Crosshair, MoreHorizontal, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
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
import {
  explicitBlockerIds,
  nextTasks,
  orderedMilestones,
  projectWorkstreams,
  streamTree,
  wouldCreateCycle,
} from '../../domain/order'
import type { ProjectStatus, Task } from '../../domain/types'
import { ProjectSignal } from '../components/HealthBadges'
import { Page } from '../components/Page'
import { ProjectObjective } from '../components/ProjectObjective'
import { ConfirmDialog } from '../project/ConfirmDialog'
import { MilestoneDialog } from '../project/MilestoneDialog'
import { MilestoneHeader } from '../project/MilestoneHeader'
import { moveIntoGroup, renumberGroup, sortedResources } from '../project/ordering'
import { ProjectFormDialog } from '../project/ProjectFormDialog'
import { ResourcesPane } from '../project/ResourcesPane'
import { TaskGroup } from '../project/TaskGroup'
import { useFocus, useProjectPane, type ProjectPane } from '../project/useProjectView'
import { TaskDndProvider } from '../project/TaskDnd'
import { NO_GROUP, type TaskDrop } from '../project/taskDndContext'
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
  // Focus mode works on workstreams (a workstream's substreams come with it).
  const workstreamIds =
    ctx && projectId ? streamTree(projectId, ctx.milestones).map((n) => n.milestone.id) : []
  const { focusId, setFocus, exitFocus } = useFocus(workstreamIds)
  // "Waits for…": the task whose blocker is being picked (the next task clicked).
  const [linking, setLinking] = useState<Task | null>(null)

  useEffect(() => {
    if (!linking) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLinking(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [linking])

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

  const tree = streamTree(project.id, ctx.milestones)
  /** The project's workstreams (top level), in order. */
  const milestones = tree.map((n) => n.milestone)
  /** Workstreams and substreams, in workflow order (resources can link to either). */
  const allStreams = orderedMilestones(project.id, ctx.milestones)
  // Streams (substreams included) run in parallel: each has its own next step.
  const nextIds = new Set(nextTasks(project.id, ctx).map((t) => t.id))
  const tasksByStream = new Map(projectWorkstreams(project.id, ctx).map((w) => [w.id, w.tasks]))
  const tasksOf = (id: string | null) => tasksByStream.get(id) ?? []
  // A project without any task or workstream still needs a card to add its first tasks to.
  const showLoose = tasksOf(null).length > 0 || tree.length === 0
  const hasWorkstreams = milestones.length > 0
  const resources = sortedResources(ctx.resources, project.id)
  const focused = milestones.find((m) => m.id === focusId) ?? null
  const taskCount = ctx.tasks.filter((t) => t.projectId === project.id).length

  const onOpenTask = (t: Task) => (linking ? completeLink(t) : open(t.id))

  /** A dragged task was dropped: reorder within its list, or move it into another list before `beforeId`. */
  const dropTask = ({ taskId, from, to, beforeId }: TaskDrop) => {
    const task = ctx.tasks.find((t) => t.id === taskId)
    if (!task) return
    const target = to === NO_GROUP ? null : to
    const group = tasksOf(target)
    if (from !== to) {
      void apply({ kind: 'saveTasks', tasks: moveIntoGroup(group, task, target, beforeId) })
      return
    }
    const open = group.filter((t) => t.status !== 'done')
    const at = open.findIndex((t) => t.id === taskId)
    const toIndex = beforeId === null ? open.length - 1 : open.findIndex((t) => t.id === beforeId)
    if (at === -1 || toIndex === -1 || at === toIndex) return
    const reordered = [...open]
    reordered.splice(toIndex, 0, ...reordered.splice(at, 1))
    const changed = renumberGroup(group, reordered)
    if (changed.length > 0) void apply({ kind: 'saveTasks', tasks: changed })
  }

  /** Finishes "Waits for…": `linking` waits for `target` from now on (loops are refused). */
  const completeLink = (target: Task) => {
    const task = linking!
    setLinking(null)
    if (target.id === task.id) return
    const current = explicitBlockerIds(task.id, ctx.dependencies)
    if (current.includes(target.id)) return
    if (wouldCreateCycle(task.id, target.id, ctx.dependencies)) {
      toast.error(`“${task.title}” can't wait for “${target.title}”: that task already waits for it.`)
      return
    }
    void apply({ kind: 'setDependencies', taskId: task.id, blockedByIds: [...current, target.id] })
  }

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
    <Page
      wide
      back={{ to: '/projects', label: 'Projects' }}
      title={project.name}
      description={description}
      actions={actions}
    >
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
          {linking && (
            <div
              role="status"
              className="sticky top-2 z-10 flex items-center justify-between gap-3 rounded-2xl bg-muted px-4 py-2 text-sm"
            >
              <span className="min-w-0">
                Pick the task <span className="font-medium">“{linking.title}”</span> waits for.
              </span>
              <Button variant="ghost" size="sm" onClick={() => setLinking(null)}>
                Cancel
              </Button>
            </div>
          )}
          <TaskDndProvider tasks={ctx.tasks} onDrop={dropTask}>
            {showLoose && (
              <TaskGroup
                project={project}
                group={{ milestone: null, tasks: tasksOf(null) }}
                ctx={ctx}
                nextIds={nextIds}
                dimmed={focusId !== null}
                onOpenTask={onOpenTask}
                onStartLink={setLinking}
                header={
                  hasWorkstreams ? (
                    <h3 className="min-h-8 content-center text-base font-medium">No workstream</h3>
                  ) : undefined
                }
              />
            )}
            {tree.map(({ milestone, substreams }) => (
              <TaskGroup
                key={milestone.id}
                project={project}
                group={{ milestone, tasks: tasksOf(milestone.id) }}
                ctx={ctx}
                nextIds={nextIds}
                dimmed={focusId !== null && milestone.id !== focusId}
                onOpenTask={onOpenTask}
                onStartLink={setLinking}
                header={
                  <MilestoneHeader
                    milestone={milestone}
                    siblings={milestones}
                    substreams={substreams}
                    taskCount={[milestone, ...substreams].reduce((n, m) => n + tasksOf(m.id).length, 0)}
                    focused={milestone.id === focusId}
                    onToggleFocus={() => (milestone.id === focusId ? exitFocus() : setFocus(milestone.id))}
                  />
                }
              >
                {substreams.length > 0 &&
                  substreams.map((sub) => (
                    <TaskGroup
                      key={sub.id}
                      nested
                      project={project}
                      group={{ milestone: sub, tasks: tasksOf(sub.id) }}
                      ctx={ctx}
                      nextIds={nextIds}
                      onOpenTask={onOpenTask}
                      onStartLink={setLinking}
                      header={
                        <MilestoneHeader
                          milestone={sub}
                          siblings={substreams}
                          taskCount={tasksOf(sub.id).length}
                        />
                      }
                    />
                  ))}
              </TaskGroup>
            ))}
          </TaskDndProvider>
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
          <ResourcesPane project={project} resources={resources} workstreams={allStreams} focusId={focusId} />
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
