import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { taskHref } from '../../data/taskActions'
import { isChronicSlipper } from '../../domain/review'
import type { ISODate, Project, Task } from '../../domain/types'
import { formatWeekRange } from '../../domain/week'
import { TaskRow } from '../components/TaskRow'
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
      <StepIntro title="Leftovers">
        {`Nothing left over. Everything planned for ${formatWeekRange(pastWeek)} got done.`}
      </StepIntro>
    )
  }

  return (
    <div>
      <StepIntro title="Leftovers">
        {`Planned for ${formatWeekRange(pastWeek)} but not done. Carry each one over to ${formatWeekRange(newWeek)}, or send it back to its project.`}
      </StepIntro>

      <div className="mb-2 flex justify-end gap-1">
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
          disabled={undecided.length === 0}
          onClick={() => void session.carryAll()}
        >
          Carry over all
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
          disabled={undecided.length === 0}
          onClick={() => void session.returnAll()}
        >
          Return all
        </Button>
      </div>

      <Card size="sm" className="py-2">
        <CardContent>
          <ul className="divide-y">
            {retro.leftovers.map((task) => {
              const decision = decisions[task.id]
              // The slip is counted by this decision, so a task is chronic once it reaches the threshold *with* it.
              const chronic = isChronicSlipper({ ...task, slipCount: task.slipCount + 1 })
              const slips = task.slipCount + 1
              return (
                <li
                  key={task.id}
                  data-decided={decision ? decision.kind : undefined}
                  className="flex flex-wrap items-center gap-x-3 py-1"
                >
                  <TaskRow
                    className="min-w-0 flex-1 basis-64"
                    task={task}
                    projectName={nameOf(task)}
                    hideDay
                    muted={!!decision}
                    note={
                      decision ? (
                        decision.kind === 'carry' ? (
                          'Carried over'
                        ) : (
                          'Back in project'
                        )
                      ) : chronic ? (
                        <>
                          <span className="text-warning">
                            {`Slipped ${slips} times — split it, or decide if it still matters`}
                          </span>
                          {' · '}
                          <Link
                            to={taskHref(task)}
                            aria-label={`Open task ${task.title}`}
                            className="underline-offset-4 hover:text-foreground hover:underline"
                          >
                            Open task
                          </Link>
                        </>
                      ) : undefined
                    }
                  />
                  <div className="flex shrink-0 items-center gap-1 pb-1 max-sm:-ml-3 sm:pb-0">
                    {decision ? (
                      <Button
                        variant="link"
                        size="sm"
                        className="text-muted-foreground"
                        aria-label={`Undo decision for ${task.title}`}
                        onClick={() => void session.undo(task)}
                      >
                        Undo
                      </Button>
                    ) : (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`Carry over ${task.title}`}
                          onClick={() => void session.carry(task)}
                        >
                          Carry over
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`Back to project ${task.title}`}
                          onClick={() => void session.giveBack(task)}
                        >
                          Back to project
                        </Button>
                      </>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
