import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  calendarExists,
  createPersonalDashCalendar,
  GcalApiError,
  listPrimaryEvents,
  mapGoogleEvent,
} from './api'
import { invalidateToken } from './auth'

vi.mock('./auth', () => ({ invalidateToken: vi.fn() }))

afterEach(() => {
  vi.unstubAllGlobals()
  vi.mocked(invalidateToken).mockClear()
})

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

describe('mapGoogleEvent', () => {
  const timed = {
    id: 'e1',
    summary: 'Standup',
    start: { dateTime: '2026-10-07T09:00:00+02:00' },
    end: { dateTime: '2026-10-07T09:30:00+02:00' },
  }

  it('maps a timed busy event', () => {
    expect(mapGoogleEvent(timed)).toEqual({
      id: 'e1',
      title: 'Standup',
      start: '2026-10-07T09:00:00+02:00',
      end: '2026-10-07T09:30:00+02:00',
      allDay: false,
      busy: true,
    })
  })

  it('maps all-day events by start.date and keeps the exclusive end date', () => {
    const ev = mapGoogleEvent({
      id: 'e2',
      summary: 'Holiday',
      start: { date: '2026-10-08' },
      end: { date: '2026-10-09' },
    })
    expect(ev).toMatchObject({ allDay: true, start: '2026-10-08', end: '2026-10-09', busy: true })
  })

  it('treats transparent (free) events as not busy', () => {
    expect(mapGoogleEvent({ ...timed, transparency: 'transparent' })?.busy).toBe(false)
    expect(mapGoogleEvent({ ...timed, transparency: 'opaque' })?.busy).toBe(true)
  })

  it('treats events the user declined as not busy', () => {
    const ev = mapGoogleEvent({
      ...timed,
      attendees: [{ responseStatus: 'accepted' }, { self: true, responseStatus: 'declined' }],
    })
    expect(ev?.busy).toBe(false)
  })

  it('ignores other attendees declining, and tentative/needsAction self responses', () => {
    expect(
      mapGoogleEvent({
        ...timed,
        attendees: [{ responseStatus: 'declined' }, { self: true, responseStatus: 'tentative' }],
      })?.busy,
    ).toBe(true)
    expect(
      mapGoogleEvent({ ...timed, attendees: [{ self: true, responseStatus: 'needsAction' }] })?.busy,
    ).toBe(true)
  })

  it('skips cancelled, working-location and malformed events', () => {
    expect(mapGoogleEvent({ ...timed, status: 'cancelled' })).toBeNull()
    expect(mapGoogleEvent({ ...timed, eventType: 'workingLocation' })).toBeNull()
    expect(mapGoogleEvent({ id: 'x', summary: 'No times' })).toBeNull()
    expect(mapGoogleEvent({ ...timed, id: undefined })).toBeNull()
  })

  it('gives untitled events a placeholder title', () => {
    expect(mapGoogleEvent({ ...timed, summary: undefined })?.title).toBe('(No title)')
  })
})

describe('listPrimaryEvents', () => {
  it('queries the primary calendar with expanded, ordered events and follows pagination', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        json({
          items: [
            {
              id: 'a',
              summary: 'One',
              start: { dateTime: '2026-10-05T10:00:00Z' },
              end: { dateTime: '2026-10-05T11:00:00Z' },
            },
          ],
          nextPageToken: 'PAGE2',
        }),
      )
      .mockResolvedValueOnce(
        json({
          items: [
            {
              id: 'b',
              status: 'cancelled',
              start: { dateTime: '2026-10-06T10:00:00Z' },
              end: { dateTime: '2026-10-06T11:00:00Z' },
            },
            { id: 'c', summary: 'Three', start: { date: '2026-10-07' }, end: { date: '2026-10-08' } },
          ],
        }),
      )
    vi.stubGlobal('fetch', fetchMock)

    const events = await listPrimaryEvents(
      'tok',
      new Date('2026-10-05T00:00:00Z'),
      new Date('2026-10-12T00:00:00Z'),
    )

    expect(events.map((e) => e.id)).toEqual(['a', 'c'])
    expect(fetchMock).toHaveBeenCalledTimes(2)
    const first = new URL(fetchMock.mock.calls[0]![0] as string)
    expect(first.origin + first.pathname).toBe(
      'https://www.googleapis.com/calendar/v3/calendars/primary/events',
    )
    expect(first.searchParams.get('singleEvents')).toBe('true')
    expect(first.searchParams.get('orderBy')).toBe('startTime')
    expect(first.searchParams.get('timeMin')).toBe('2026-10-05T00:00:00.000Z')
    expect(first.searchParams.get('timeMax')).toBe('2026-10-12T00:00:00.000Z')
    expect(first.searchParams.has('pageToken')).toBe(false)
    expect(new URL(fetchMock.mock.calls[1]![0] as string).searchParams.get('pageToken')).toBe('PAGE2')
  })

  it('invalidates the token and throws on 401', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ error: { message: 'bad' } }, 401)))
    await expect(listPrimaryEvents('tok', new Date(), new Date())).rejects.toMatchObject({ status: 401 })
    expect(invalidateToken).toHaveBeenCalledTimes(1)
  })
})

describe('calendars', () => {
  it('creates the PersonalDash calendar', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ id: 'cal123' }))
    vi.stubGlobal('fetch', fetchMock)
    await expect(createPersonalDashCalendar('tok')).resolves.toBe('cal123')
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://www.googleapis.com/calendar/v3/calendars')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string)).toEqual({ summary: 'PersonalDash' })
  })

  it('reports whether a calendar still exists', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(json({ id: 'x' })))
    await expect(calendarExists('tok', 'x')).resolves.toBe(true)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(json({}, 404)))
    await expect(calendarExists('tok', 'x')).resolves.toBe(false)
    // other errors do not trigger re-creation of the calendar
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(json({}, 403)))
    await expect(calendarExists('tok', 'x')).resolves.toBe(true)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(json({}, 401)))
    await expect(calendarExists('tok', 'x')).rejects.toBeInstanceOf(GcalApiError)
  })
})
