import { format, parseISO } from 'date-fns'
import type { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { taskHref, useTaskActions } from '../../data/taskActions'
import type { PlanContext } from '../../domain/context'
import type { Task } from '../../domain/types'
import { Card, CardContent } from '@/components/ui/card'
import { CardSection } from '../components/Page'
import { TaskRow } from '../components/TaskRow'
import { eventsOnDay } from '../plan/events'
import { FollowUpRow } from '../plan/FollowUpRow'
import { MeetingList } from '../plan/MeetingList'
import { TaskDayMenu } from '../plan/TaskDayMenu'
import { weekStats } from '../plan/weekStats'
import { TodayResources } from './TodayResources'

/**
 * Today's meetings, pinned tasks, due follow-ups and overdue pins; the resources for those tasks; then the rest
 * of the week.
 */
export function TodayColumn({ ctx }: { ctx: PlanContext }) {
  const actions = useTaskActions()
  const navigate = useNavigate()
  const { today, tasks, projects } = ctx
  const names = new Map(projects.map((p) => [p.id, p.name]))

  const stats = weekStats(ctx)
  const meetings = eventsOnDay(ctx.events, today).filter((ev) => !ev.allDay)
  const pinnedToday = tasks.filter((t) => t.pinnedDay === today)
  const followUpsDue = stats.followUps.filter((f) => f.date <= today)
  const overduePinned = tasks.filter(
    (t) => t.pinnedDay !== null && t.pinnedDay < today && t.status !== 'done',
  )
  const unpinned = stats.planned.filter((t) => t.status !== 'done' && t.pinnedDay === null)
  const laterPinned = stats.planned
    .filter((t) => t.status !== 'done' && t.pinnedDay !== null && t.pinnedDay > today)
    .sort((a, b) => (a.pinnedDay ?? '').localeCompare(b.pinnedDay ?? ''))
  const laterDays = [...new Set(laterPinned.map((t) => t.pinnedDay!))]

  const nothingPlanned = stats.planned.length === 0 && overduePinned.length === 0
  // Resources follow what is on today's list; with nothing there, what is left of the week.
  const todayTasks = [
    ...pinnedToday.filter((t) => t.status !== 'done'),
    ...overduePinned,
    ...followUpsDue.map((f) => f.task),
  ]
  const resourceTasks = todayTasks.length > 0 ? todayTasks : [...unpinned, ...laterPinned]
  const todayHasContent =
    meetings.length + pinnedToday.length + followUpsDue.length + overduePinned.length > 0

  const row = (task: Task, extra: { actions?: ReactNode; hideDay?: boolean } = {}) => (
    <TaskRow
      key={task.id}
      task={task}
      projectName={task.projectId ? names.get(task.projectId) : 'Inbox'}
      onToggleDone={(t) => void actions.toggleDone(t)}
      onOpen={(t) => navigate(taskHref(t))}
      hideDay={extra.hideDay}
      actions={extra.actions ?? <TaskDayMenu task={task} weekStart={ctx.weekStart} variant="pin" />}
    />
  )

  return (
    <div className="flex flex-col gap-4">
      {(todayHasContent || !nothingPlanned) && (
        <CardSection title="Today">
          {meetings.length > 0 && <MeetingList events={meetings} className="mb-2" />}
          <div className="divide-y">
            {pinnedToday.map((t) => row(t, { hideDay: true }))}
            {followUpsDue.map((item) => (
              <FollowUpRow key={item.task.id} item={item} today={today} />
            ))}
            {overduePinned.map((t) =>
              row(t, {
                actions: (
                  <Button
                    variant="ghost"
                    size="xs"
                    className="h-8 text-muted-foreground md:h-6"
                    onClick={() => void actions.pin(t, today)}
                  >
                    Move to today
                  </Button>
                ),
              }),
            )}
          </div>
          {!todayHasContent && <p className="text-sm text-muted-foreground">Nothing pinned for today.</p>}
        </CardSection>
      )}

      <TodayResources
        title={todayTasks.length > 0 ? 'Resources for today' : 'Resources for this week'}
        tasks={resourceTasks}
        resources={ctx.resources}
      />

      {nothingPlanned && (
        <section>
          <Card>
            <CardContent className="flex flex-col items-start gap-3">
              <p className="text-sm text-muted-foreground">Nothing planned this week yet.</p>
              <Button asChild>
                <Link to="/plan">Plan the week</Link>
              </Button>
            </CardContent>
          </Card>
        </section>
      )}

      {(unpinned.length > 0 || laterPinned.length > 0) && (
        <CardSection title="Later this week">
          {unpinned.length > 0 && <div className="divide-y">{unpinned.map((t) => row(t))}</div>}
          {laterDays.map((d) => (
            <div key={d} className="mt-3 first:mt-0">
              <h3 className="text-xs font-medium text-muted-foreground">{format(parseISO(d), 'EEE')}</h3>
              <div className="divide-y">
                {laterPinned.filter((t) => t.pinnedDay === d).map((t) => row(t, { hideDay: true }))}
              </div>
            </div>
          ))}
        </CardSection>
      )}
    </div>
  )
}
