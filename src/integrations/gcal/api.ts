// Typed fetch helpers for the Google Calendar v3 REST API. Plain fetch, no googleapis package.
import type { CalendarEvent, ISODate } from '../../domain/types'
import { addDaysISO } from '../../domain/week'
import { invalidateToken } from './auth'

const BASE = 'https://www.googleapis.com/calendar/v3'

/** Display name of the dedicated calendar tasks are pushed to. */
export const PERSONALDASH_CALENDAR_NAME = 'PersonalDash'

export class GcalApiError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'GcalApiError'
    this.status = status
  }
}

/** Unwrap a thrown value into a user-presentable message. */
export const errorMessage = (e: unknown): string =>
  e instanceof Error ? e.message : typeof e === 'string' ? e : 'Unknown error'

async function failure(res: Response): Promise<GcalApiError> {
  let detail = ''
  try {
    const body = (await res.json()) as { error?: { message?: string } }
    detail = body.error?.message ?? ''
  } catch {
    // no JSON body
  }
  return new GcalApiError(res.status, `Google Calendar error ${res.status}${detail ? `: ${detail}` : ''}`)
}

/** fetch against the Calendar API. A 401 invalidates the stored token; any non-2xx throws GcalApiError. */
async function request(path: string, token: string, init: RequestInit = {}): Promise<Response> {
  let res: Response
  try {
    res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...init.headers,
      },
    })
  } catch {
    throw new GcalApiError(0, 'Could not reach Google Calendar (network error)')
  }
  if (res.status === 401) invalidateToken()
  if (!res.ok) throw await failure(res)
  return res
}

const enc = encodeURIComponent

// ---------------------------------------------------------------------------------------------
// Reading events (primary calendar)

interface GoogleEvent {
  id?: string
  status?: string
  summary?: string
  transparency?: string
  eventType?: string
  start?: { date?: string; dateTime?: string }
  end?: { date?: string; dateTime?: string }
  attendees?: { self?: boolean; responseStatus?: string }[]
}

/** Map a Google event to the domain type; null for events the app ignores (cancelled, malformed, working location). */
export function mapGoogleEvent(ev: GoogleEvent): CalendarEvent | null {
  if (ev.status === 'cancelled' || ev.eventType === 'workingLocation') return null
  const allDay = !!ev.start?.date
  const start = ev.start?.date ?? ev.start?.dateTime
  const end = ev.end?.date ?? ev.end?.dateTime
  if (!ev.id || !start || !end) return null
  const declined = ev.attendees?.some((a) => a.self && a.responseStatus === 'declined') ?? false
  return {
    id: ev.id,
    title: ev.summary?.trim() || '(No title)',
    start,
    end,
    allDay,
    busy: ev.transparency !== 'transparent' && !declined,
  }
}

/** Events on the user's primary calendar overlapping [timeMin, timeMax), recurring events expanded. */
export async function listPrimaryEvents(
  token: string,
  timeMin: Date,
  timeMax: Date,
): Promise<CalendarEvent[]> {
  const out: CalendarEvent[] = []
  let pageToken: string | undefined
  do {
    const params = new URLSearchParams({
      singleEvents: 'true',
      orderBy: 'startTime',
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      maxResults: '250',
    })
    if (pageToken) params.set('pageToken', pageToken)
    const res = await request(`/calendars/primary/events?${params}`, token)
    const body = (await res.json()) as { items?: GoogleEvent[]; nextPageToken?: string }
    for (const item of body.items ?? []) {
      const mapped = mapGoogleEvent(item)
      if (mapped) out.push(mapped)
    }
    pageToken = body.nextPageToken
  } while (pageToken)
  return out
}

// ---------------------------------------------------------------------------------------------
// The dedicated "PersonalDash" calendar

/** Creates the calendar and returns its id. */
export async function createPersonalDashCalendar(token: string): Promise<string> {
  const res = await request('/calendars', token, {
    method: 'POST',
    body: JSON.stringify({ summary: PERSONALDASH_CALENDAR_NAME }),
  })
  const body = (await res.json()) as { id?: string }
  if (!body.id) throw new GcalApiError(res.status, 'Google Calendar did not return a calendar id')
  return body.id
}

/** Whether the calendar still exists for this account. Other errors (e.g. scope limits) count as "exists". */
export async function calendarExists(token: string, calendarId: string): Promise<boolean> {
  try {
    await request(`/calendars/${enc(calendarId)}`, token)
    return true
  } catch (e) {
    if (e instanceof GcalApiError && (e.status === 404 || e.status === 410)) return false
    if (e instanceof GcalApiError && e.status === 401) throw e
    return true
  }
}

// ---------------------------------------------------------------------------------------------
// All-day task events on the PersonalDash calendar

export interface TaskEventInput {
  /** Pinned day, 'YYYY-MM-DD'. */
  day: ISODate
  summary: string
  description: string
}

function eventBody({ day, summary, description }: TaskEventInput) {
  return {
    summary,
    description,
    start: { date: day },
    end: { date: addDaysISO(day, 1) },
    transparency: 'transparent', // informational only; must not look like a busy meeting elsewhere
  }
}

export async function insertEvent(token: string, calendarId: string, input: TaskEventInput): Promise<string> {
  const res = await request(`/calendars/${enc(calendarId)}/events`, token, {
    method: 'POST',
    body: JSON.stringify(eventBody(input)),
  })
  const body = (await res.json()) as { id?: string }
  if (!body.id) throw new GcalApiError(res.status, 'Google Calendar did not return an event id')
  return body.id
}

/**
 * Update an event. If it no longer exists (404/410) it is inserted again.
 * Returns the id of the event that now represents the task.
 */
export async function patchEvent(
  token: string,
  calendarId: string,
  eventId: string,
  input: TaskEventInput,
): Promise<string> {
  try {
    await request(`/calendars/${enc(calendarId)}/events/${enc(eventId)}`, token, {
      method: 'PATCH',
      body: JSON.stringify(eventBody(input)),
    })
    return eventId
  } catch (e) {
    if (e instanceof GcalApiError && (e.status === 404 || e.status === 410)) {
      return insertEvent(token, calendarId, input)
    }
    throw e
  }
}

/** Delete an event; an already-missing event (404/410) counts as success. */
export async function deleteEvent(token: string, calendarId: string, eventId: string): Promise<void> {
  try {
    await request(`/calendars/${enc(calendarId)}/events/${enc(eventId)}`, token, { method: 'DELETE' })
  } catch (e) {
    if (e instanceof GcalApiError && (e.status === 404 || e.status === 410)) return
    throw e
  }
}
