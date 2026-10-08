import { XIcon } from '@primer/octicons-react'
import { Details, IconButton } from '@primer/react'
import { useNavigate } from 'react-router-dom'
import { taskHref, useTaskActions } from '../../data/taskActions'
import type { PlanContext } from '../../domain/context'
import { TaskRow } from '../components/TaskRow'
import { TaskDayMenu } from './TaskDayMenu'
import styles from './PlannedList.module.css'

/** Collapsible list of everything planned this week, with day pinning and unplan. */
export function PlannedList({ ctx, planned }: { ctx: PlanContext; planned: PlanContext['tasks'] }) {
  const actions = useTaskActions()
  const navigate = useNavigate()
  const rank = new Map(ctx.projects.map((p) => [p.id, p.rank]))
  const names = new Map(ctx.projects.map((p) => [p.id, p.name]))

  const sorted = [...planned].sort(
    (a, b) =>
      (a.pinnedDay ?? '9999').localeCompare(b.pinnedDay ?? '9999') ||
      (rank.get(a.projectId ?? '') ?? Infinity) - (rank.get(b.projectId ?? '') ?? Infinity),
  )

  return (
    <Details className={styles.details}>
      <Details.Summary>{`Planned this week (${planned.length})`}</Details.Summary>
      <div className={styles.body}>
        {sorted.length === 0 && <p className={styles.empty}>Nothing planned yet.</p>}
        {sorted.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            projectName={task.projectId ? names.get(task.projectId) : 'Inbox'}
            onOpen={(t) => navigate(taskHref(t))}
            trailing={
              <>
                <TaskDayMenu task={task} weekStart={ctx.weekStart} variant="pin" />
                <IconButton
                  icon={XIcon}
                  size="small"
                  variant="invisible"
                  aria-label={`Unplan "${task.title}"`}
                  onClick={() => void actions.unplan(task)}
                />
              </>
            }
          />
        ))}
      </div>
    </Details>
  )
}
