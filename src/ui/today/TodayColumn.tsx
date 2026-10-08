import { Button } from '@primer/react'
import { format, parseISO } from 'date-fns'
import type { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { taskHref, useTaskActions } from '../../data/taskActions'
import { dayCapacity, plannedHours } from '../../domain/capacity'
import type { PlanContext } from '../../domain/context'
import type { Task } from '../../domain/types'
import { CapacityBar } from '../components/CapacityBar'
import { TaskRow } from '../components/TaskRow'
import { eventsOnDay } from '../plan/events'
import { FollowUpRow } from '../plan/FollowUpRow'
import { MeetingList } from '../plan/MeetingList'
import { Section } from '../plan/Section'
import { TaskDayMenu } from '../plan/TaskDayMenu'
import { weekStats } from '../plan/weekStats'
import styles from './TodayColumn.module.css'

/** Today's meetings, pinned tasks, due follow-ups, overdue pins and the rest of the week. */
export function TodayColumn({ ctx }: { ctx: PlanContext }) {
  const actions = useTaskActions()
  const navigate = useNavigate()
  const { today, tasks, projects } = ctx
  const names = new Map(projects.map((p) => [p.id, p.name]))

  const stats = weekStats(ctx)
  const meetings = eventsOnDay(ctx.events, today)
  const pinnedToday = tasks.filter((t) => t.pinnedDay === today)
  const followUpsDue = stats.followUps.filter((f) => f.date <= today)
  const overduePinned = tasks.filter(
    (t) => t.pinnedDay !== null && t.pinnedDay < today && t.status !== 'done',
  )
  const restOfWeek = stats.planned.filter((t) => t.status !== 'done' && t.pinnedDay === null)
  const laterPinned = stats.planned
    .filter((t) => t.status !== 'done' && t.pinnedDay !== null && t.pinnedDay > today)
    .sort((a, b) => (a.pinnedDay ?? '').localeCompare(b.pinnedDay ?? ''))
  const laterDays = [...new Set(laterPinned.map((t) => t.pinnedDay!))]

  const day = dayCapacity(today, ctx.settings, ctx.events)
  const todayHours = plannedHours(pinnedToday, ctx.settings, followUpsDue.length)
  const nothingPlanned = stats.planned.length === 0 && overduePinned.length === 0

  const row = (task: Task, trailing?: ReactNode) => (
    <TaskRow
      key={task.id}
      task={task}
      projectName={task.projectId ? names.get(task.projectId) : 'Inbox'}
      onToggleDone={(t) => void actions.toggleDone(t)}
      onOpen={(t) => navigate(taskHref(t))}
      trailing={trailing}
    />
  )
  const dayMenu = (task: Task) => <TaskDayMenu task={task} weekStart={ctx.weekStart} variant="pin" />

  return (
    <div className={styles.column}>
      {meetings.length > 0 && (
        <Section title="Meetings today" muted>
          <MeetingList events={meetings} />
        </Section>
      )}

      {nothingPlanned && (
        <Section title="Nothing planned this week">
          <p className={styles.empty}>Pick the tasks you want to move forward this week.</p>
          <Button as={Link} to="/plan" variant="primary">
            Plan the week
          </Button>
        </Section>
      )}

      {pinnedToday.length > 0 && (
        <Section title="Pinned for today" count={pinnedToday.filter((t) => t.status !== 'done').length}>
          {pinnedToday.map((t) => row(t, dayMenu(t)))}
        </Section>
      )}

      {followUpsDue.length > 0 && (
        <Section title="Follow-ups" count={followUpsDue.length}>
          {followUpsDue.map((item) => (
            <FollowUpRow key={item.task.id} item={item} today={today} />
          ))}
        </Section>
      )}

      {overduePinned.length > 0 && (
        <Section title="Overdue" count={overduePinned.length}>
          {overduePinned.map((t) =>
            row(
              t,
              <Button size="small" onClick={() => void actions.pin(t, today)}>
                Move to today
              </Button>,
            ),
          )}
        </Section>
      )}

      {(restOfWeek.length > 0 || laterPinned.length > 0) && (
        <Section title="Rest of this week" count={restOfWeek.length + laterPinned.length}>
          {restOfWeek.length > 0 && (
            <>
              {laterPinned.length > 0 && <h3 className={styles.dayLabel}>Any day</h3>}
              {restOfWeek.map((t) => row(t, dayMenu(t)))}
            </>
          )}
          {laterDays.map((d) => (
            <div key={d}>
              <h3 className={styles.dayLabel}>{format(parseISO(d), 'EEEE')}</h3>
              {laterPinned.filter((t) => t.pinnedDay === d).map((t) => row(t, dayMenu(t)))}
            </div>
          ))}
        </Section>
      )}

      <Section title="Capacity">
        <div className={styles.capacity}>
          {(day.capacity > 0 || todayHours > 0) && (
            <div>
              <div className={styles.capLabel}>Today</div>
              <CapacityBar planned={todayHours} capacity={day.capacity} meetingHours={day.meetingHours} />
            </div>
          )}
          <div>
            <div className={styles.capLabel}>This week</div>
            <CapacityBar
              planned={stats.hours}
              capacity={stats.capacity.capacity}
              meetingHours={stats.capacity.meetingHours}
            />
          </div>
        </div>
      </Section>
    </div>
  )
}
