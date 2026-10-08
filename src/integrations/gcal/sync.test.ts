import { afterEach, describe, expect, it, vi } from 'vitest'
import { makeProject, makeTask } from '../../domain/factories'
import type { Project, Task } from '../../domain/types'
import { planCalendarSync, reconcilePatches, runCalendarSync, type SyncOp } from './sync'

vi.mock('./auth', () => ({ invalidateToken: vi.fn() }))
import { invalidateToken } from './auth'

const project: Project = makeProject({ name: 'Website', outcome: 'Live', targetDate: '2026-12-01' })
const DAY = '2026-10-07'

const task = (p: Partial<Task> = {}): Task => makeTask({ title: 'Write copy', projectId: project.id, ...p })

describe('planCalendarSync', () => {
  it('ignores tasks that are clean and in sync', () => {
    const tasks = [
      task({ id: 'a' }), // not pinned, nothing to do
      task({ id: 'b', pinnedDay: DAY, gcalEventId: 'ev', gcalDirty: false }), // synced
    ]
    expect(planCalendarSync(tasks, [project])).toEqual([])
  })

  it('inserts a pinned task without an event, even when not marked dirty', () => {
    const t = task({ id: 'a', pinnedDay: DAY })
    expect(planCalendarSync([t], [project])).toEqual([
      { kind: 'insert', taskId: 'a', day: DAY, summary: 'Write copy', description: 'Project: Website' },
    ])
  })

  it('patches a dirty pinned task that has an event', () => {
    const t = task({ id: 'a', pinnedDay: DAY, gcalEventId: 'ev1', gcalDirty: true, title: 'Renamed' })
    expect(planCalendarSync([t], [project])).toEqual([
      {
        kind: 'patch',
        taskId: 'a',
        eventId: 'ev1',
        day: DAY,
        summary: 'Renamed',
        description: 'Project: Website',
      },
    ])
  })

  it('prefixes done tasks with a check mark', () => {
    const t = task({ pinnedDay: DAY, gcalEventId: 'ev1', gcalDirty: true, status: 'done' })
    const [op] = planCalendarSync([t], [project])
    expect(op).toMatchObject({ kind: 'patch', summary: '✓ Write copy' })
  })

  it('also marks a done, never-synced pinned task with the check mark on insert', () => {
    const t = task({ pinnedDay: DAY, status: 'done' })
    expect(planCalendarSync([t], [project])[0]).toMatchObject({ kind: 'insert', summary: '✓ Write copy' })
  })

  it('deletes the event of a task that is no longer pinned', () => {
    const t = task({ id: 'a', pinnedDay: null, gcalEventId: 'ev1', gcalDirty: true })
    expect(planCalendarSync([t], [project])).toEqual([{ kind: 'delete', taskId: 'a', eventId: 'ev1' }])
  })

  it('only clears the dirty flag when unpinned without an event', () => {
    const t = task({ id: 'a', pinnedDay: null, gcalEventId: null, gcalDirty: true })
    expect(planCalendarSync([t], [project])).toEqual([{ kind: 'clear', taskId: 'a' }])
  })

  it('describes inbox tasks and tasks of unknown projects as Inbox', () => {
    const inbox = task({ id: 'a', projectId: null, pinnedDay: DAY })
    const ghost = task({ id: 'b', projectId: 'missing', pinnedDay: DAY })
    const ops = planCalendarSync([inbox, ghost], [project])
    expect(ops.map((o) => (o.kind === 'insert' ? o.description : ''))).toEqual([
      'Project: Inbox',
      'Project: Inbox',
    ])
  })

  it('keeps input order across mixed operations', () => {
    const tasks = [
      task({ id: '1', pinnedDay: DAY }),
      task({ id: '2', gcalEventId: 'e2', gcalDirty: true }),
      task({ id: '3', gcalDirty: true }),
      task({ id: '4', pinnedDay: DAY, gcalEventId: 'e4', gcalDirty: true }),
    ]
    expect(planCalendarSync(tasks, [project]).map((o) => `${o.taskId}:${o.kind}`)).toEqual([
      '1:insert',
      '2:delete',
      '3:clear',
      '4:patch',
    ])
  })
})

// ---------------------------------------------------------------------------------------------

interface Call {
  method: string
  url: string
  body: unknown
}

function mockFetch(handler: (call: Call) => { status?: number; json?: unknown }) {
  const calls: Call[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const call: Call = {
        method: init?.method ?? 'GET',
        url,
        body: init?.body ? JSON.parse(init.body as string) : undefined,
      }
      calls.push(call)
      const { status = 200, json = {} } = handler(call)
      return new Response(status === 204 ? null : JSON.stringify(json), { status })
    }),
  )
  return calls
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.mocked(invalidateToken).mockClear()
})

const CAL = 'cal@group.calendar.google.com'
const CAL_URL = 'https://www.googleapis.com/calendar/v3/calendars/cal%40group.calendar.google.com/events'

describe('runCalendarSync', () => {
  it('inserts an all-day event ending the next day and returns the new id', async () => {
    const calls = mockFetch(() => ({ json: { id: 'new1' } }))
    const ops: SyncOp[] = [
      {
        kind: 'insert',
        taskId: 'a',
        day: '2026-10-31',
        summary: 'Write copy',
        description: 'Project: Website',
      },
    ]
    const res = await runCalendarSync(ops, 'tok', CAL)
    expect(res.patches).toEqual([{ taskId: 'a', patch: { gcalEventId: 'new1', gcalDirty: false } }])
    expect(res.errors).toEqual([])
    expect(calls).toHaveLength(1)
    expect(calls[0]).toMatchObject({ method: 'POST', url: CAL_URL })
    expect(calls[0]!.body).toMatchObject({
      summary: 'Write copy',
      description: 'Project: Website',
      start: { date: '2026-10-31' },
      end: { date: '2026-11-01' },
    })
    const headers = vi.mocked(fetch).mock.calls[0]![1]!.headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer tok')
  })

  it('patches an existing event', async () => {
    const calls = mockFetch(() => ({ json: {} }))
    const res = await runCalendarSync(
      [{ kind: 'patch', taskId: 'a', eventId: 'ev1', day: DAY, summary: '✓ x', description: 'Project: P' }],
      'tok',
      CAL,
    )
    expect(calls[0]).toMatchObject({ method: 'PATCH', url: `${CAL_URL}/ev1` })
    expect(res.patches).toEqual([{ taskId: 'a', patch: { gcalEventId: 'ev1', gcalDirty: false } }])
  })

  it('re-inserts when patching an event that is gone (404 and 410)', async () => {
    for (const status of [404, 410]) {
      const calls = mockFetch((c) => (c.method === 'PATCH' ? { status } : { json: { id: 'fresh' } }))
      const res = await runCalendarSync(
        [{ kind: 'patch', taskId: 'a', eventId: 'gone', day: DAY, summary: 's', description: 'd' }],
        'tok',
        CAL,
      )
      expect(calls.map((c) => c.method)).toEqual(['PATCH', 'POST'])
      expect(res.patches).toEqual([{ taskId: 'a', patch: { gcalEventId: 'fresh', gcalDirty: false } }])
    }
  })

  it('deletes events and treats already-deleted ones as success', async () => {
    const calls = mockFetch((c) => (c.url.endsWith('/gone') ? { status: 410 } : { status: 204 }))
    const res = await runCalendarSync(
      [
        { kind: 'delete', taskId: 'a', eventId: 'ev1' },
        { kind: 'delete', taskId: 'b', eventId: 'gone' },
      ],
      'tok',
      CAL,
    )
    expect(calls.map((c) => c.method)).toEqual(['DELETE', 'DELETE'])
    expect(res.errors).toEqual([])
    expect(res.patches).toEqual([
      { taskId: 'a', patch: { gcalEventId: null, gcalDirty: false } },
      { taskId: 'b', patch: { gcalEventId: null, gcalDirty: false } },
    ])
  })

  it('clear operations make no request', async () => {
    const calls = mockFetch(() => ({}))
    const res = await runCalendarSync([{ kind: 'clear', taskId: 'a' }], 'tok', CAL)
    expect(calls).toHaveLength(0)
    expect(res.patches).toEqual([{ taskId: 'a', patch: { gcalEventId: null, gcalDirty: false } }])
  })

  it('records a failure, keeps going, and leaves the failed task unpatched', async () => {
    mockFetch((c) =>
      (c.body as { summary?: string } | undefined)?.summary === 'bad'
        ? { status: 500, json: { error: { message: 'boom' } } }
        : { json: { id: 'ok-id' } },
    )
    const res = await runCalendarSync(
      [
        { kind: 'insert', taskId: 'a', day: DAY, summary: 'bad', description: '' },
        { kind: 'insert', taskId: 'b', day: DAY, summary: 'good', description: '' },
      ],
      'tok',
      CAL,
    )
    expect(res.patches.map((p) => p.taskId)).toEqual(['b'])
    expect(res.errors).toEqual([{ taskId: 'a', message: 'Google Calendar error 500: boom' }])
    expect(res.unauthorized).toBe(false)
  })

  it('aborts on 401 and invalidates the token', async () => {
    const calls = mockFetch(() => ({ status: 401, json: { error: { message: 'Invalid Credentials' } } }))
    const res = await runCalendarSync(
      [
        { kind: 'insert', taskId: 'a', day: DAY, summary: 's', description: '' },
        { kind: 'insert', taskId: 'b', day: DAY, summary: 's', description: '' },
      ],
      'tok',
      CAL,
    )
    expect(calls).toHaveLength(1)
    expect(res.unauthorized).toBe(true)
    expect(res.patches).toEqual([])
    expect(invalidateToken).toHaveBeenCalledTimes(1)
  })

  it('reports network failures instead of throwing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    const res = await runCalendarSync(
      [{ kind: 'insert', taskId: 'a', day: DAY, summary: 's', description: '' }],
      'tok',
      CAL,
    )
    expect(res.patches).toEqual([])
    expect(res.errors[0]!.message).toMatch(/network/i)
  })
})

describe('reconcilePatches', () => {
  const insertOp = (t: Task): SyncOp => planCalendarSync([t], [project])[0]!
  const result = (taskId: string, id: string | null = 'ev') => ({
    patches: [{ taskId, patch: { gcalEventId: id, gcalDirty: false } }],
    errors: [],
    unauthorized: false,
  })

  it('passes patches through when the task did not change meanwhile', () => {
    const t = task({ id: 'a', pinnedDay: DAY })
    expect(reconcilePatches(result('a'), [insertOp(t)], [t], [project])).toEqual(result('a').patches)
  })

  it('keeps the task dirty when it was renamed during the run', () => {
    const t = task({ id: 'a', pinnedDay: DAY })
    const renamed = { ...t, title: 'Newer', gcalDirty: true }
    const [p] = reconcilePatches(result('a'), [insertOp(t)], [renamed], [project])
    expect(p!.patch).toEqual({ gcalEventId: 'ev', gcalDirty: true })
  })

  it('keeps the task dirty when it was unpinned while its event was being created', () => {
    const t = task({ id: 'a', pinnedDay: DAY })
    const unpinned = { ...t, pinnedDay: null, gcalDirty: true }
    const [p] = reconcilePatches(result('a'), [insertOp(t)], [unpinned], [project])
    expect(p!.patch.gcalDirty).toBe(true)
    expect(p!.patch.gcalEventId).toBe('ev')
  })

  it('keeps the task dirty when it was re-pinned while its event was being deleted', () => {
    const t = task({ id: 'a', pinnedDay: null, gcalEventId: 'ev', gcalDirty: true })
    const repinned = { ...t, pinnedDay: DAY }
    const [p] = reconcilePatches(result('a', null), [insertOp(t)], [repinned], [project])
    expect(p!.patch).toEqual({ gcalEventId: null, gcalDirty: true })
  })

  it('drops patches for tasks that no longer exist', () => {
    const t = task({ id: 'a', pinnedDay: DAY })
    expect(reconcilePatches(result('a'), [insertOp(t)], [], [project])).toEqual([])
  })
})
