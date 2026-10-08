import { format, parseISO } from 'date-fns'
import { Clock } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { taskHref, useTaskActions } from '../../data/taskActions'
import { plannedHours } from '../../domain/capacity'
import type { FollowUpItem } from '../../domain/followups'
import type { CalendarEvent, ISODate, Settings, Task } from '../../domain/types'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { formatHours } from '../components/format'
import { TaskRow } from '../components/TaskRow'
import { MeetingList } from './MeetingList'
import { TaskDayMenu } from './TaskDayMenu'

/** One column of the week board: a day (or "any day"), its meetings, hours line, follow-ups and tasks. */
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
  className,
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
  className?: string
}) {
  const actions = useTaskActions()
  const navigate = useNavigate()
  const hours = plannedHours(tasks, settings, followUps.length)
  const over = capacity !== null ? Math.round(hours * 10) - Math.round(capacity * 10) : 0
  const empty = tasks.length === 0 && followUps.length === 0

  // "4h · 6.5h free"; nothing at all for an empty, capacity-less day (weekends).
  let hoursText = ''
  if (capacity === null) hoursText = hours > 0 ? `${formatHours(hours)}h` : ''
  else if (over > 0) hoursText = `${formatHours(hours)}h · ${formatHours(over / 10)}h over`
  else if (hours > 0 && capacity > 0)
    hoursText = `${formatHours(hours)}h · ${formatHours(capacity - hours)}h free`
  else if (capacity > 0) hoursText = `${formatHours(capacity)}h free`

  return (
    <Card
      size="sm"
      role="region"
      className={cn(
        'min-w-0 gap-2 rounded-2xl xl:[--card-spacing:--spacing(3)]',
        isToday && 'ring-2 ring-primary/40',
        className,
      )}
      aria-label={day ? format(parseISO(day), 'EEEE MMMM d') : 'This week, any day'}
      data-day={day ?? 'any'}
      data-today={isToday ? '' : undefined}
    >
      <header className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5 px-(--card-spacing) md:flex-col md:items-start md:justify-start md:gap-0.5">
        <h2
          className={cn(
            'flex items-center gap-1.5 text-sm font-medium',
            isToday ? 'text-foreground' : 'text-muted-foreground',
          )}
        >
          {day ? (
            <>
              <span>{format(parseISO(day), 'EEE')}</span>
              <span className={cn('font-normal', !isToday && 'text-muted-foreground/70')}>
                {format(parseISO(day), 'MMM d')}
              </span>
            </>
          ) : (
            'Any day'
          )}
          {isToday && <span className="size-1.5 rounded-full bg-primary" aria-label="Today" role="img" />}
        </h2>
        {hoursText && (
          <p className={cn('text-xs tabular-nums', over > 0 ? 'text-destructive' : 'text-muted-foreground')}>
            {hoursText}
          </p>
        )}
      </header>

      <MeetingList events={meetings} compact className="px-(--card-spacing)" />

      {followUps.length > 0 && (
        <ul className="flex flex-col gap-1 px-(--card-spacing)">
          {followUps.map((item) => (
            <li key={item.task.id} className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <Clock className="mt-0.5 size-3 shrink-0" aria-hidden />
              <Link to={taskHref(item.task)} className="min-w-0 underline-offset-4 hover:underline">
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      )}

      {tasks.length > 0 && (
        // Columns are narrow: `compact` rows put the grey metadata under the title.
        <div className="divide-y px-(--card-spacing)">
          {tasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              hideDay
              compact
              projectName={task.projectId ? projectNames.get(task.projectId) : 'Inbox'}
              onToggleDone={(t) => void actions.toggleDone(t)}
              onOpen={(t) => navigate(taskHref(t))}
              actions={<TaskDayMenu task={task} weekStart={weekStart} variant="move" />}
            />
          ))}
        </div>
      )}
      {empty && (
        <p className="hidden px-(--card-spacing) text-xs text-muted-foreground/60 md:block">
          Nothing planned
        </p>
      )}
    </Card>
  )
}
