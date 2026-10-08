import { CheckCircleIcon, ReplyIcon, ArrowRightIcon, UndoIcon } from '@primer/octicons-react'
import { Button, Link } from '@primer/react'
import { Blankslate } from '@primer/react/experimental'
import { Link as RouterLink } from 'react-router-dom'
import { taskHref } from '../../data/taskActions'
import { CHRONIC_SLIP_THRESHOLD, isChronicSlipper } from '../../domain/review'
import type { ISODate, Project, Task } from '../../domain/types'
import { formatWeekRange } from '../../domain/week'
import { TaskRow } from '../components/TaskRow'
import styles from './Leftovers.module.css'
import { StepIntro } from './StepIntro'
import type { ReviewSession } from './useReviewSession'

/** Step 2: decide what happens to each task planned last week that is still open. */
export function Leftovers({
  session,
  projects,
  newWeek,
  pastWeek,
}: {
  session: ReviewSession
  projects: Project[]
  newWeek: ISODate
  pastWeek: ISODate
}) {
  const { retro, decisions, undecided } = session
  const nameOf = (t: Task): string => projects.find((p) => p.id === t.projectId)?.name ?? 'Inbox'

  if (retro.leftovers.length === 0) {
    return (
      <div>
        <StepIntro title="Leftovers" />
        <Blankslate border>
          <Blankslate.Visual>
            <CheckCircleIcon size="medium" />
          </Blankslate.Visual>
          <Blankslate.Heading>Nothing left over</Blankslate.Heading>
          <Blankslate.Description>
            {`Everything planned for ${formatWeekRange(pastWeek)} got done. Carry on to the next step.`}
          </Blankslate.Description>
        </Blankslate>
      </div>
    )
  }

  return (
    <div>
      <StepIntro title="Leftovers">
        {`These were planned for ${formatWeekRange(pastWeek)} but are not done. Carry each one over to ${formatWeekRange(newWeek)}, or send it back to its project.`}
      </StepIntro>

      <div className={styles.bulk}>
        <span className={styles.remaining} aria-live="polite">
          {undecided.length === 0
            ? 'All decided'
            : `${undecided.length} of ${retro.leftovers.length} to decide`}
        </span>
        <div className={styles.bulkButtons}>
          <Button size="small" disabled={undecided.length === 0} onClick={() => void session.carryAll()}>
            Carry over all
          </Button>
          <Button size="small" disabled={undecided.length === 0} onClick={() => void session.returnAll()}>
            Return all
          </Button>
        </div>
      </div>

      <ul className={styles.list}>
        {retro.leftovers.map((task) => {
          const decision = decisions[task.id]
          // The slip is counted by this decision, so a task is chronic once it reaches the threshold *with* it.
          const chronic = isChronicSlipper({ ...task, slipCount: task.slipCount + 1 })
          const slips = task.slipCount + 1
          return (
            <li key={task.id} className={styles.item} data-decided={decision ? decision.kind : undefined}>
              <TaskRow
                task={task}
                projectName={nameOf(task)}
                muted={!!decision}
                note={
                  decision ? (
                    <span className={styles.decision}>
                      {decision.kind === 'carry'
                        ? `Carried over to ${formatWeekRange(newWeek)}`
                        : `Back in ${nameOf(task)}, not planned`}
                    </span>
                  ) : chronic ? (
                    <span className={styles.chronic}>
                      {`Slipped ${slips} times — split it, or decide if it still matters`}
                    </span>
                  ) : undefined
                }
              />
              <div className={styles.actions}>
                {decision ? (
                  <Button
                    size="small"
                    variant="invisible"
                    leadingVisual={UndoIcon}
                    aria-label={`Undo decision for ${task.title}`}
                    onClick={() => void session.undo(task)}
                  >
                    Undo
                  </Button>
                ) : (
                  <>
                    <Button
                      size="small"
                      leadingVisual={ArrowRightIcon}
                      aria-label={`Carry over ${task.title}`}
                      onClick={() => void session.carry(task)}
                    >
                      Carry over
                    </Button>
                    <Button
                      size="small"
                      leadingVisual={ReplyIcon}
                      aria-label={`Back to project ${task.title}`}
                      onClick={() => void session.giveBack(task)}
                    >
                      Back to project
                    </Button>
                  </>
                )}
                {chronic && (
                  <Link
                    as={RouterLink}
                    to={taskHref(task)}
                    className={styles.open}
                    aria-label={`Open task ${task.title}`}
                  >
                    Open task
                  </Link>
                )}
              </div>
            </li>
          )
        })}
      </ul>
      <p className={styles.hint}>
        {`Tasks that slip ${CHRONIC_SLIP_THRESHOLD} times are flagged: they are usually too big or no longer important.`}
      </p>
    </div>
  )
}
