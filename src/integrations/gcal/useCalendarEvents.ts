import { useQuery } from '@tanstack/react-query'
import { useSnapshot } from '../../data/hooks'
import type { CalendarEvent, ISODate } from '../../domain/types'
import { addDaysISO, fromISODate } from '../../domain/week'
import { listPrimaryEvents } from './api'
import { getValidToken } from './auth'
import { useGcalAuth } from './useGcalAuth'

export const CALENDAR_EVENTS_KEY = ['gcal-events'] as const
const NO_EVENTS: CalendarEvent[] = []

/**
 * Busy/free events overlapping the given week (local Monday 00:00 to next Monday 00:00) from the
 * user's primary Google Calendar. Returns [] when the calendar is not connected, the token is
 * unavailable, or loading/fetching fails (never throws).
 */
export function useCalendarEvents(weekStart: ISODate): CalendarEvent[] {
  const { data: snapshot } = useSnapshot()
  const { hasToken } = useGcalAuth()
  const enabled = !!snapshot?.settings.calendarConnected && hasToken

  const { data } = useQuery({
    queryKey: [...CALENDAR_EVENTS_KEY, weekStart],
    enabled,
    staleTime: 5 * 60_000,
    retry: false,
    queryFn: async () => {
      const token = getValidToken()
      if (!token) return NO_EVENTS
      return listPrimaryEvents(token, fromISODate(weekStart), fromISODate(addDaysISO(weekStart, 7)))
    },
  })
  return enabled ? (data ?? NO_EVENTS) : NO_EVENTS
}
