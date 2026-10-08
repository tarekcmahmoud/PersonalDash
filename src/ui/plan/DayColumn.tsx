import { ClockIcon } from '@primer/octicons-react'
import { format, parseISO } from 'date-fns'
import { Link, useNavigate } from 'react-router-dom'
import { taskHref, useTaskActions } from '../../data/taskActions'
import { plannedHours } from '../../domain/capacity'
import type { FollowUpItem } from '../../domain/followups'
import type { CalendarEvent, ISODate, Settings, Task } from '../../domain/types'
import { TaskRow } from '../components/TaskRow'
import styles from './DayColumn.module.css'
import { MeetingList } from './MeetingList'
import { TaskDayMenu } from './TaskDayMenu'

function formatHours(h: number): string {
  return String(Math.round(h * 10) / 10)
}

/** One column of the week board: a day (or "any day"), its meetings, capacity line, tasks and follow-ups. */
export function DayColumn({
  weekStart,
  day,
  isToday,
  tasks,
  followUps,
  meetings,
  capacity,
  settings,
  projectNames,
}: {
  weekStart: ISODate
  /** null = the "This week, any day" column. */
  day: ISODate | null
  isToday?: boolean
  tasks: Task[]
  followUps: FollowUpItem[]
  meetings: CalendarEvent[]
  /** Hours available that day (null for the any-day column). */
  capacity: number | null
  settings: Settings
  projectNames: Map<string, string>
}) {
  const actions = useTaskActions()
  const navigate = useNavigate()
  const hours = plannedHours(tasks, settings, followUps.length)
  const over = capacity !== null && Math.round(hours * 10) > Math.round(capacity * 10)
  const heading = day ? format(parseISO(day), 'EEE d') : 'Any day'
  const empty = tasks.length === 0 && followUps.length === 0

  return (
    <section
      className={[styles.column, isToday && styles.today, !day && styles.anyDay].filter(Boolean).join(' ')}
      aria-label={day ? format(parseISO(day), 'EEEE MMMM d') : 'This week, any day'}
      data-day={day ?? 'any'}
      data-today={isToday ? '' : undefined}
    >
      <header className={styles.head}>
        <h2 className={styles.title}>{heading}</h2>
        {isToday && <span className={styles.todayTag}>Today</span>}
        <span className={over ? styles.over : styles.hours}>
          {capacity !== null
            ? `${formatHours(hours)}h of ${formatHours(capacity)}h`
            : `${formatHours(hours)}h`}
        </span>
      </header>

      <MeetingList events={meetings} compact />

      <div className={styles.cards}>
        {followUps.map((item) => (
          <div key={item.task.id} className={styles.followUp}>
            <ClockIcon />
            <Link to={taskHref(item.task)}>{item.label}</Link>
          </div>
        ))}
        {tasks.map((task) => (
          <div key={task.id} className={styles.card}>
            <TaskRow
              task={task}
              projectName={task.projectId ? projectNames.get(task.projectId) : 'Inbox'}
              onToggleDone={(t) => void actions.toggleDone(t)}
              onOpen={(t) => navigate(taskHref(t))}
              trailing={<TaskDayMenu task={task} weekStart={weekStart} variant="move" />}
            />
          </div>
        ))}
        {empty && <p className={styles.empty}>Nothing planned</p>}
      </div>
    </section>
  )
}
