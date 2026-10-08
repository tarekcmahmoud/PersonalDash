import { format } from 'date-fns'
import type { CalendarEvent, ISODate } from '../../domain/types'
import { addDaysISO, fromISODate } from '../../domain/week'

/** Events overlapping one calendar day (local), all-day events first, then by start time. */
export function eventsOnDay(events: CalendarEvent[], day: ISODate): CalendarEvent[] {
  const dayStart = fromISODate(day).getTime()
  const dayEnd = fromISODate(addDaysISO(day, 1)).getTime()
  return events
    .filter((ev) =>
      ev.allDay
        ? ev.start <= day && day < ev.end
        : new Date(ev.start).getTime() < dayEnd && new Date(ev.end).getTime() > dayStart,
    )
    .sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.start.localeCompare(b.start))
}

/** "10:00–11:30" for timed events, "All day" otherwise. */
export function eventTimeText(ev: CalendarEvent): string {
  if (ev.allDay) return 'All day'
  return `${format(new Date(ev.start), 'HH:mm')}–${format(new Date(ev.end), 'HH:mm')}`
}
