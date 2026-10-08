import { PencilIcon, PlusIcon, TrashIcon } from '@primer/octicons-react'
import { Button, Select, Spinner, useConfirm } from '@primer/react'
import { Blankslate } from '@primer/react/experimental'
import { useState } from 'react'
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom'
import { useApply, usePlanContext } from '../../data/hooks'
import { projectHealth } from '../../domain/health'
import { nextTask } from '../../domain/order'
import type { ProjectStatus } from '../../domain/types'
import { HealthBadges } from '../components/HealthBadges'
import { Page } from '../components/Page'
import { ProjectObjective } from '../components/ProjectObjective'
import { MilestoneDialog } from '../project/MilestoneDialog'
import { MilestoneHeader } from '../project/MilestoneHeader'
import { projectGroups } from '../project/ordering'
import { ProjectFormDialog } from '../project/ProjectFormDialog'
import { TaskGroup } from '../project/TaskGroup'
import { useIsNarrow } from '../project/useIsNarrow'
import { TaskDialogHost } from '../task/TaskDialogHost'
import { useTaskParam } from '../task/useTaskParam'
import styles from './ProjectPage.module.css'

export function ProjectPage() {
  const { projectId } = useParams()
  const ctx = usePlanContext()
  const apply = useApply()
  const confirm = useConfirm()
  const navigate = useNavigate()
  const { open } = useTaskParam()
  const narrow = useIsNarrow()
  const [editing, setEditing] = useState(false)
  const [addingMilestone, setAddingMilestone] = useState(false)

  if (!ctx) {
    return (
      <Page title="Project">
        <Spinner aria-label="Loading project" />
      </Page>
    )
  }

  const project = ctx.projects.find((p) => p.id === projectId)
  if (!project) {
    return (
      <Page title="Project not found">
        <Blankslate border>
          <Blankslate.Heading>This project does not exist</Blankslate.Heading>
          <Blankslate.Description>It may have been deleted.</Blankslate.Description>
          <Blankslate.PrimaryAction onClick={() => navigate('/projects')}>
            Back to projects
          </Blankslate.PrimaryAction>
        </Blankslate>
      </Page>
    )
  }

  const groups = projectGroups(project.id, ctx.milestones, ctx.tasks)
  const milestones = groups.flatMap((g) => (g.milestone ? [g.milestone] : []))
  const next = nextTask(project.id, ctx)

  const setStatus = (status: ProjectStatus) =>
    void apply({ kind: 'saveProjects', projects: [{ ...project, status }] })

  const remove = async () => {
    const count = ctx.tasks.filter((t) => t.projectId === project.id).length
    const ok = await confirm({
      title: `Delete “${project.name}”?`,
      content: `This permanently deletes the project, its ${milestones.length} milestone${milestones.length === 1 ? '' : 's'} and ${count} task${count === 1 ? '' : 's'}.`,
      confirmButtonContent: 'Delete project',
      confirmButtonType: 'danger',
    })
    if (!ok) return
    await apply({ kind: 'deleteProject', id: project.id })
    navigate('/projects')
  }

  const actions = (
    <div className={styles.actions}>
      {!project.isSystem && (
        <Select
          aria-label="Project status"
          value={project.status}
          onChange={(e) => setStatus(e.target.value as ProjectStatus)}
        >
          <Select.Option value="active">Active</Select.Option>
          <Select.Option value="on_hold">On hold</Select.Option>
          <Select.Option value="done">Done</Select.Option>
        </Select>
      )}
      <Button leadingVisual={PencilIcon} onClick={() => setEditing(true)}>
        Edit
      </Button>
      {!project.isSystem && (
        <Button variant="danger" leadingVisual={TrashIcon} onClick={() => void remove()}>
          Delete
        </Button>
      )}
    </div>
  )

  const description = (
    <div className={styles.description}>
      <RouterLink to="/projects" className={styles.back}>
        ← All projects
      </RouterLink>
      <ProjectObjective project={project} />
      <HealthBadges flags={projectHealth(project, ctx)} />
    </div>
  )

  const hasMilestones = milestones.length > 0
  return (
    <Page title={project.name} description={description} actions={narrow ? undefined : actions}>
      <div className={styles.groups}>
        {narrow && actions}
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
                ) : hasMilestones ? (
                  <h2 className={styles.plainHeading}>No milestone</h2>
                ) : undefined
              }
            />
          ))}
        <div>
          <Button leadingVisual={PlusIcon} onClick={() => setAddingMilestone(true)}>
            Add milestone
          </Button>
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
      <TaskDialogHost />
    </Page>
  )
}
