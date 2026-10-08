import type { CalendarEvent, ISODate } from '../../domain/types'

/**
 * Busy/free events overlapping the given week from the user's primary Google Calendar.
 * Returns [] when the calendar is not connected or the token is unavailable (never throws).
 * Implemented in phase 6; until then always [].
 */
export function useCalendarEvents(weekStart: ISODate): CalendarEvent[] {
  void weekStart
  return []
}
