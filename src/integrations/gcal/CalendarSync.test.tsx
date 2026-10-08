import { screen, waitFor } from '@testing-library/react'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { seedSnapshot } from '../../data/seed'
import { useSnapshot } from '../../data/hooks'
import { usePlanContext } from '../../data/hooks'
import { addDaysISO, todayISO, weekStartOf } from '../../domain/week'
import { renderApp } from '../../ui/plan/testUtils'
import { CalendarSync } from './CalendarSync'

// The auth module reads its token lazily from sessionStorage, so seed a valid one before first use.
beforeAll(() => {
  vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'client-123')
  sessionStorage.setItem(
    'personaldash.gcal.token',
    JSON.stringify({ accessToken: 'tok', expiresAt: Date.now() + 3_600_000 }),
  )
})
afterAll(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  sessionStorage.clear()
})

interface Call {
  method: string
  path: string
  body: unknown
}

function stubGoogle(calls: Call[], events: unknown[] = []) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const u = new URL(url)
      const path = u.pathname.replace('/calendar/v3', '')
      const method = init?.method ?? 'GET'
      calls.push({ method, path, body: init?.body ? JSON.parse(init.body as string) : undefined })
      if (method === 'GET' && path === '/calendars/primary/events') {
        return new Response(JSON.stringify({ items: events }), { status: 200 })
      }
      if (method === 'POST' && path === '/calendars') {
        return new Response(JSON.stringify({ id: 'pd-cal' }), { status: 200 })
      }
      if (method === 'POST' && path.endsWith('/events')) {
        return new Response(JSON.stringify({ id: 'ev-1' }), { status: 200 })
      }
      return new Response('{}', { status: 200 })
    }),
  )
}

function connectedSnapshot() {
  const snapshot = seedSnapshot(todayISO())
  snapshot.settings.calendarConnected = true
  return snapshot
}

describe('CalendarSync', () => {
  it('creates the PersonalDash calendar, pushes pinned tasks and stores the ids', async () => {
    const calls: Call[] = []
    stubGoogle(calls)
    const snapshot = connectedSnapshot()
    const pinned = snapshot.tasks.find((t) => t.pinnedDay === todayISO())!
    pinned.gcalDirty = true
    pinned.gcalEventId = null

    const { repo } = renderApp(<CalendarSync />, { snapshot })

    await waitFor(
      async () => {
        const saved = await repo.loadSnapshot()
        expect(saved.settings.gcalCalendarId).toBe('pd-cal')
        const task = saved.tasks.find((t) => t.id === pinned.id)!
        expect(task.gcalEventId).toBe('ev-1')
        expect(task.gcalDirty).toBe(false)
      },
      { timeout: 6000 },
    )

    const insert = calls.find((c) => c.method === 'POST' && c.path === '/calendars/pd-cal/events')!
    expect(insert.body).toMatchObject({
      summary: pinned.title,
      start: { date: todayISO() },
      end: { date: addDaysISO(todayISO(), 1) },
    })
    expect(calls.filter((c) => c.method === 'POST' && c.path === '/calendars')).toHaveLength(1)
  }, 10_000)

  it('deletes the event when a task was unpinned, and does nothing when everything is in sync', async () => {
    const calls: Call[] = []
    stubGoogle(calls)
    const snapshot = connectedSnapshot()
    snapshot.settings.gcalCalendarId = 'pd-cal'
    const pinned = snapshot.tasks.find((t) => t.pinnedDay === todayISO())!
    pinned.pinnedDay = null
    pinned.gcalEventId = 'old-event'
    pinned.gcalDirty = true

    const { repo } = renderApp(<CalendarSync />, { snapshot })

    await waitFor(
      async () => {
        const task = (await repo.loadSnapshot()).tasks.find((t) => t.id === pinned.id)!
        expect(task.gcalEventId).toBeNull()
        expect(task.gcalDirty).toBe(false)
      },
      { timeout: 6000 },
    )
    expect(calls.some((c) => c.method === 'DELETE' && c.path === '/calendars/pd-cal/events/old-event')).toBe(
      true,
    )
    expect(calls.some((c) => c.method === 'POST')).toBe(false)
  }, 10_000)
})

describe('useCalendarEvents', () => {
  function Probe() {
    const ctx = usePlanContext()
    const { data } = useSnapshot()
    return (
      <p data-testid="events">
        {data ? ctx?.events.map((e) => `${e.title}:${e.busy ? 'busy' : 'free'}`).join(',') || 'none' : '…'}
      </p>
    )
  }

  it('feeds connected calendar events into the plan context', async () => {
    const calls: Call[] = []
    const day = weekStartOf(todayISO())
    stubGoogle(calls, [
      {
        id: 'm1',
        summary: 'Planning',
        start: { dateTime: `${day}T10:00:00Z` },
        end: { dateTime: `${day}T11:00:00Z` },
      },
      {
        id: 'm2',
        summary: 'Lunch',
        transparency: 'transparent',
        start: { dateTime: `${day}T12:00:00Z` },
        end: { dateTime: `${day}T13:00:00Z` },
      },
    ])
    renderApp(<Probe />, { snapshot: connectedSnapshot() })
    await waitFor(() => expect(screen.getByTestId('events')).toHaveTextContent('Planning:busy,Lunch:free'))
    const list = calls.find((c) => c.path === '/calendars/primary/events')
    expect(list).toBeDefined()
  })

  it('returns no events and makes no request while the calendar is not connected', async () => {
    const calls: Call[] = []
    stubGoogle(calls)
    renderApp(<Probe />) // seed settings: calendarConnected = false
    await waitFor(() => expect(screen.getByTestId('events')).toHaveTextContent('none'))
    expect(calls).toEqual([])
  })
})
