import { describe, expect, it } from 'vitest'
import { dayCapacity, plannedHours, sizeHours, weekCapacity } from './capacity'
import { makeTask } from './factories'
import { DEFAULT_SETTINGS } from './types'
import type { CalendarEvent, Settings } from './types'

// Week of Mon 2026-10-05 (local). Month index 9 = October.
const WEEK = '2026-10-05'

/** Local-time ISO string, so tests are timezone-independent. */
const at = (day: number, h: number, m = 0): string => new Date(2026, 9, day, h, m).toISOString()

let n = 0
const ev = (start: string, end: string, extra: Partial<CalendarEvent> = {}): CalendarEvent => ({
  id: `e${++n}`,
  title: 'Meeting',
  start,
  end,
  allDay: false,
  busy: true,
  ...extra,
})

describe('sizeHours', () => {
  it('maps S/M/L from settings and XL to 0', () => {
    expect(sizeHours('S', DEFAULT_SETTINGS)).toBe(1)
    expect(sizeHours('M', DEFAULT_SETTINGS)).toBe(4)
    expect(sizeHours('L', DEFAULT_SETTINGS)).toBe(8)
    expect(sizeHours('XL', DEFAULT_SETTINGS)).toBe(0)
  })

  it('respects custom settings', () => {
    const s: Settings = { ...DEFAULT_SETTINGS, sizeHours: { S: 2, M: 3, L: 5 } }
    expect(sizeHours('S', s)).toBe(2)
    expect(sizeHours('L', s)).toBe(5)
  })
})

describe('plannedHours', () => {
  it('is 0 for no tasks and no follow-ups', () => {
    expect(plannedHours([], DEFAULT_SETTINGS, 0)).toBe(0)
  })

  it('sums non-done tasks', () => {
    const tasks = [
      makeTask({ title: 'a', size: 'S' }),
      makeTask({ title: 'b', size: 'M' }),
      makeTask({ title: 'c', size: 'L', status: 'waiting' }),
    ]
    expect(plannedHours(tasks, DEFAULT_SETTINGS, 0)).toBe(13)
  })

  it('excludes done tasks', () => {
    const tasks = [makeTask({ title: 'a', size: 'L', status: 'done' }), makeTask({ title: 'b', size: 'M' })]
    expect(plannedHours(tasks, DEFAULT_SETTINGS, 0)).toBe(4)
  })

  it('counts XL as 0', () => {
    expect(plannedHours([makeTask({ title: 'a', size: 'XL' })], DEFAULT_SETTINGS, 0)).toBe(0)
  })

  it('adds follow-ups at S hours each', () => {
    const s: Settings = { ...DEFAULT_SETTINGS, sizeHours: { S: 0.5, M: 4, L: 8 } }
    expect(plannedHours([makeTask({ title: 'a', size: 'M' })], s, 3)).toBe(5.5)
    expect(plannedHours([], DEFAULT_SETTINGS, 2)).toBe(2)
  })
})

describe('weekCapacity', () => {
  it('default settings, no events: 45h work → 31.5h capacity', () => {
    expect(weekCapacity(WEEK, DEFAULT_SETTINGS, [], null)).toEqual({
      workHours: 45,
      meetingHours: 0,
      capacity: 31.5,
      overridden: false,
    })
  })

  it('subtracts a busy meeting inside the window', () => {
    const r = weekCapacity(WEEK, DEFAULT_SETTINGS, [ev(at(6, 10), at(6, 12))], null)
    expect(r.meetingHours).toBe(2)
    expect(r.workHours).toBe(45)
    expect(r.capacity).toBe(30) // 43 * 0.7 = 30.1 → 30
  })

  it('rounds to the nearest 0.5h', () => {
    // 45 - 1 = 44 * 0.7 = 30.8 → 31
    expect(weekCapacity(WEEK, DEFAULT_SETTINGS, [ev(at(6, 10), at(6, 11))], null).capacity).toBe(31)
    // 45 - 4 = 41 * 0.7 = 28.7 → 28.5
    expect(weekCapacity(WEEK, DEFAULT_SETTINGS, [ev(at(6, 9), at(6, 13))], null).capacity).toBe(28.5)
  })

  it('merges overlapping events (no double counting)', () => {
    const r = weekCapacity(
      WEEK,
      DEFAULT_SETTINGS,
      [ev(at(6, 10), at(6, 12)), ev(at(6, 11), at(6, 13)), ev(at(6, 10, 30), at(6, 11))],
      null,
    )
    expect(r.meetingHours).toBe(3)
  })

  it('merges identical and nested events, and counts touching events once each', () => {
    const r = weekCapacity(
      WEEK,
      DEFAULT_SETTINGS,
      [
        ev(at(6, 10), at(6, 12)),
        ev(at(6, 10), at(6, 12)),
        ev(at(6, 12), at(6, 13)),
        ev(at(6, 14), at(6, 14, 30)),
      ],
      null,
    )
    expect(r.meetingHours).toBe(3.5)
  })

  it('clips events overlapping the window edges', () => {
    const r = weekCapacity(WEEK, DEFAULT_SETTINGS, [ev(at(6, 8), at(6, 10)), ev(at(6, 17), at(6, 19))], null)
    expect(r.meetingHours).toBe(2) // 09-10 and 17-18
  })

  it('ignores events fully outside work windows', () => {
    const r = weekCapacity(WEEK, DEFAULT_SETTINGS, [ev(at(6, 7), at(6, 9)), ev(at(6, 18), at(6, 20))], null)
    expect(r.meetingHours).toBe(0)
    expect(r.capacity).toBe(31.5)
  })

  it('ignores weekend events when the day has no work window', () => {
    const r = weekCapacity(
      WEEK,
      DEFAULT_SETTINGS,
      [ev(at(10, 10), at(10, 12)), ev(at(11, 9), at(11, 17))],
      null,
    )
    expect(r.meetingHours).toBe(0)
    expect(r.workHours).toBe(45)
  })

  it('ignores all-day events', () => {
    const r = weekCapacity(WEEK, DEFAULT_SETTINGS, [ev('2026-10-06', '2026-10-07', { allDay: true })], null)
    expect(r.meetingHours).toBe(0)
  })

  it('ignores all-day flagged events even with datetime strings', () => {
    const r = weekCapacity(WEEK, DEFAULT_SETTINGS, [ev(at(6, 9), at(6, 18), { allDay: true })], null)
    expect(r.meetingHours).toBe(0)
  })

  it('ignores busy:false events', () => {
    const r = weekCapacity(WEEK, DEFAULT_SETTINGS, [ev(at(6, 10), at(6, 12), { busy: false })], null)
    expect(r.meetingHours).toBe(0)
  })

  it('ignores events outside the week', () => {
    const r = weekCapacity(
      WEEK,
      DEFAULT_SETTINGS,
      [ev(at(4, 10), at(4, 12)), ev(at(12, 10), at(12, 12))],
      null,
    )
    expect(r.meetingHours).toBe(0)
  })

  it('ignores zero-length and inverted events', () => {
    const r = weekCapacity(WEEK, DEFAULT_SETTINGS, [ev(at(6, 10), at(6, 10)), ev(at(6, 12), at(6, 11))], null)
    expect(r.meetingHours).toBe(0)
  })

  it('clips a multi-day event per day to each work window', () => {
    // Tue 15:00 → Thu 10:00: Tue 15-18 (3) + Wed 9-18 (9) + Thu 9-10 (1) = 13
    const r = weekCapacity(WEEK, DEFAULT_SETTINGS, [ev(at(6, 15), at(8, 10))], null)
    expect(r.meetingHours).toBe(13)
    expect(r.capacity).toBe(22.5) // 32 * 0.7 = 22.4 → 22.5
  })

  it('handles an event spanning midnight into a weekend day', () => {
    // Fri 16:00 → Sat 02:00: only Fri 16-18 counts
    const r = weekCapacity(WEEK, DEFAULT_SETTINGS, [ev(at(9, 16), at(10, 2))], null)
    expect(r.meetingHours).toBe(2)
  })

  it('handles an event spanning midnight from the previous week', () => {
    // Sun 2026-10-04 22:00 → Mon 10:00: only Mon 9-10 counts
    const r = weekCapacity(WEEK, DEFAULT_SETTINGS, [ev(at(4, 22), at(5, 10))], null)
    expect(r.meetingHours).toBe(1)
  })

  it('merges a multi-day event with overlapping same-day events', () => {
    const r = weekCapacity(WEEK, DEFAULT_SETTINGS, [ev(at(6, 15), at(8, 10)), ev(at(7, 10), at(7, 12))], null)
    expect(r.meetingHours).toBe(13)
  })

  it('uses override instead of computed capacity but still reports hours', () => {
    const r = weekCapacity(WEEK, DEFAULT_SETTINGS, [ev(at(6, 10), at(6, 12))], 20)
    expect(r).toEqual({ workHours: 45, meetingHours: 2, capacity: 20, overridden: true })
  })

  it('treats an override of 0 as an override', () => {
    const r = weekCapacity(WEEK, DEFAULT_SETTINGS, [], 0)
    expect(r.capacity).toBe(0)
    expect(r.overridden).toBe(true)
  })

  it('respects custom work windows and focus factor', () => {
    const s: Settings = {
      ...DEFAULT_SETTINGS,
      focusFactor: 0.5,
      workHours: {
        ...DEFAULT_SETTINGS.workHours,
        sat: { start: '10:00', end: '14:30' },
        fri: null,
      },
    }
    // Mon-Thu 36h + Sat 4.5h = 40.5h
    const r = weekCapacity(WEEK, s, [ev(at(10, 12), at(10, 16))], null)
    expect(r.workHours).toBe(40.5)
    expect(r.meetingHours).toBe(2.5)
    expect(r.capacity).toBe(19) // 38 * 0.5
  })

  it('never goes negative', () => {
    const s: Settings = { ...DEFAULT_SETTINGS, focusFactor: 1 }
    const r = weekCapacity(WEEK, s, [ev(at(5, 0), at(11, 23))], null)
    expect(r.meetingHours).toBe(45)
    expect(r.capacity).toBe(0)
  })

  it('is 0 when no day has a work window', () => {
    const s: Settings = {
      ...DEFAULT_SETTINGS,
      workHours: { mon: null, tue: null, wed: null, thu: null, fri: null, sat: null, sun: null },
    }
    expect(weekCapacity(WEEK, s, [ev(at(6, 10), at(6, 12))], null)).toEqual({
      workHours: 0,
      meetingHours: 0,
      capacity: 0,
      overridden: false,
    })
  })
})

describe('dayCapacity', () => {
  it('computes a plain working day', () => {
    expect(dayCapacity('2026-10-06', DEFAULT_SETTINGS, [])).toEqual({
      workHours: 9,
      meetingHours: 0,
      capacity: 6.5, // 6.3 → 6.5
      overridden: false,
    })
  })

  it('subtracts merged meetings on that day only', () => {
    const r = dayCapacity('2026-10-06', DEFAULT_SETTINGS, [
      ev(at(6, 10), at(6, 12)),
      ev(at(6, 11), at(6, 13)),
      ev(at(7, 10), at(7, 15)),
    ])
    expect(r.workHours).toBe(9)
    expect(r.meetingHours).toBe(3)
    expect(r.capacity).toBe(4) // 6 * 0.7 = 4.2 → 4
  })

  it('clips to the day for multi-day events', () => {
    const r = dayCapacity('2026-10-07', DEFAULT_SETTINGS, [ev(at(6, 15), at(8, 10))])
    expect(r.meetingHours).toBe(9)
    expect(r.capacity).toBe(0)
  })

  it('is zero on a non-working day', () => {
    expect(dayCapacity('2026-10-10', DEFAULT_SETTINGS, [ev(at(10, 10), at(10, 12))])).toEqual({
      workHours: 0,
      meetingHours: 0,
      capacity: 0,
      overridden: false,
    })
  })

  it('ignores all-day and free events', () => {
    const r = dayCapacity('2026-10-06', DEFAULT_SETTINGS, [
      ev('2026-10-06', '2026-10-07', { allDay: true }),
      ev(at(6, 10), at(6, 12), { busy: false }),
    ])
    expect(r.meetingHours).toBe(0)
  })

  it('sum of day capacities is consistent with work and meeting hours', () => {
    const events = [ev(at(5, 9), at(5, 11)), ev(at(7, 13), at(7, 15))]
    const days = ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09']
    const total = days.reduce((a, d) => a + dayCapacity(d, DEFAULT_SETTINGS, events).meetingHours, 0)
    expect(total).toBe(weekCapacity(WEEK, DEFAULT_SETTINGS, events, null).meetingHours)
  })
})
