import { Button, Checkbox } from '@primer/react'
import { Link, useNavigate } from 'react-router-dom'
import { taskHref, useTaskActions } from '../../data/taskActions'
import type { PickCandidate, PickGroup } from '../../domain/planning'
import type { ISODate } from '../../domain/types'
import { HealthBadges } from '../components/HealthBadges'
import { TaskRow } from '../components/TaskRow'
import styles from './PickGroupCard.module.css'

function reasonText(c: PickCandidate): string | null {
  if (c.reason === 'xl') return 'Split this task first'
  if (c.reason === 'blocked') return `Blocked by: ${c.blockedBy.map((b) => b.title).join(', ')}`
  return null
}

/** One project in the pick list: health, planned count and its next tasks with a "Plan this week" toggle. */
export function PickGroupCard({
  group,
  weekStart,
  onShowMore,
}: {
  group: PickGroup
  weekStart: ISODate
  onShowMore: () => void
}) {
  const actions = useTaskActions()
  const navigate = useNavigate()
  const { project } = group

  return (
    <section className={styles.card} aria-label={project.name}>
      <header className={styles.head}>
        <h3 className={styles.name}>
          <Link to={`/projects/${project.id}`}>{project.name}</Link>
        </h3>
        <span className={styles.count}>{group.plannedCount} planned</span>
        <div className={styles.badges}>
          <HealthBadges flags={group.flags} />
        </div>
      </header>

      {group.candidates.length === 0 && <p className={styles.empty}>No open tasks.</p>}
      <div className={styles.list}>
        {group.candidates.map((c) => {
          const note = reasonText(c)
          return (
            <div key={c.task.id} className={styles.item}>
              <div className={styles.toggle}>
                <Checkbox
                  checked={c.planned}
                  disabled={!c.selectable}
                  aria-label={`Plan "${c.task.title}" this week`}
                  onChange={() => void (c.planned ? actions.unplan(c.task) : actions.plan(c.task, weekStart))}
                />
              </div>
              <div className={styles.row}>
                <TaskRow
                  task={c.task}
                  muted={!c.selectable}
                  note={note}
                  onOpen={(t) => navigate(taskHref(t))}
                />
              </div>
            </div>
          )
        })}
      </div>

      {group.hasMore && (
        <div className={styles.more}>
          <Button variant="invisible" onClick={onShowMore} aria-label={`Show more tasks for ${project.name}`}>
            Show more
          </Button>
        </div>
      )}
    </section>
  )
}
