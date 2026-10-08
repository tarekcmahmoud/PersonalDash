import type { CalendarEvent } from '../../domain/types'
import { cn } from '@/lib/utils'
import { eventTimeText } from './events'

/** Read-only grey rows for calendar events ("10:00–11:00 Standup"). Renders nothing when there are none. */
export function MeetingList({
  events,
  compact,
  className,
}: {
  events: CalendarEvent[]
  compact?: boolean
  className?: string
}) {
  if (events.length === 0) return null
  return (
    <ul
      className={cn(
        'flex flex-col text-muted-foreground',
        compact ? 'gap-0.5 text-xs' : 'gap-1 text-sm',
        className,
      )}
      aria-label="Meetings"
    >
      {events.map((ev) => (
        <li key={ev.id} className="flex flex-wrap gap-x-2">
          <span className="whitespace-nowrap tabular-nums">{eventTimeText(ev)}</span>
          <span className="min-w-0 [overflow-wrap:anywhere]">{ev.title}</span>
        </li>
      ))}
    </ul>
  )
}
