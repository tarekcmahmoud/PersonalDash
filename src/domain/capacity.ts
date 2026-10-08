import type { CalendarEvent, ISODate, Settings, Task, TaskSize } from './types'
import { fromISODate, weekDays, weekdayOf } from './week'

/** Hours a task of this size takes. XL → 0 (it can't be planned). */
export function sizeHours(size: TaskSize, settings: Settings): number {
  if (size === 'XL') return 0
  return settings.sizeHours[size]
}

/** Sum of sizeHours over tasks that are not done, plus followUpCount × S hours. */
export function plannedHours(tasks: Task[], settings: Settings, followUpCount: number): number {
  let total = followUpCount * settings.sizeHours.S
  for (const t of tasks) {
    if (t.status !== 'done') total += sizeHours(t.size, settings)
  }
  return total
}

export interface WeekCapacity {
  /** Total working hours in the week from settings.workHours. */
  workHours: number
  /** Busy, timed (non-all-day) event time that overlaps working hours, in hours (overlapping events merged). */
  meetingHours: number
  /** (workHours − meetingHours) × focusFactor, rounded to 0.5h; or the override when given. */
  capacity: number
  overridden: boolean
}

const MS_PER_HOUR = 3_600_000

/** Local Date for a calendar date plus an 'HH:MM' clock time. */
function localAt(date: ISODate, clock: string): Date {
  const [h, m] = clock.split(':').map(Number)
  const d = fromISODate(date)
  d.setHours(h ?? 0, m ?? 0, 0, 0)
  return d
}

interface DayTotals {
  work: number
  meetings: number
}

/** Working hours and merged busy-meeting hours for one date. */
function dayTotals(date: ISODate, settings: Settings, events: CalendarEvent[]): DayTotals {
  const window = settings.workHours[weekdayOf(date)]
  if (!window) return { work: 0, meetings: 0 }
  const winStart = localAt(date, window.start).getTime()
  const winEnd = localAt(date, window.end).getTime()
  if (winEnd <= winStart) return { work: 0, meetings: 0 }

  const spans: [number, number][] = []
  for (const ev of events) {
    if (ev.allDay || !ev.busy) continue
    const s = Math.max(new Date(ev.start).getTime(), winStart)
    const e = Math.min(new Date(ev.end).getTime(), winEnd)
    if (Number.isNaN(s) || Number.isNaN(e) || e <= s) continue
    spans.push([s, e])
  }
  spans.sort((a, b) => a[0] - b[0])

  let busy = 0
  let curStart = 0
  let curEnd = -Infinity
  for (const [s, e] of spans) {
    if (s > curEnd) {
      if (curEnd > -Infinity) busy += curEnd - curStart
      curStart = s
      curEnd = e
    } else if (e > curEnd) {
      curEnd = e
    }
  }
  if (curEnd > -Infinity) busy += curEnd - curStart

  return { work: (winEnd - winStart) / MS_PER_HOUR, meetings: busy / MS_PER_HOUR }
}

const roundHalf = (h: number): number => Math.round(h * 2) / 2

function compute(
  dates: ISODate[],
  settings: Settings,
  events: CalendarEvent[],
  override: number | null,
): WeekCapacity {
  let workHours = 0
  let meetingHours = 0
  for (const d of dates) {
    const t = dayTotals(d, settings, events)
    workHours += t.work
    meetingHours += t.meetings
  }
  if (override !== null) return { workHours, meetingHours, capacity: override, overridden: true }
  const capacity = roundHalf(Math.max(0, workHours - meetingHours) * settings.focusFactor)
  return { workHours, meetingHours, capacity, overridden: false }
}

/**
 * Capacity of the week starting at weekStart. Event times are converted to local time;
 * only the parts inside each day's work window count.
 */
export function weekCapacity(
  weekStart: ISODate,
  settings: Settings,
  events: CalendarEvent[],
  override: number | null,
): WeekCapacity {
  return compute(weekDays(weekStart), settings, events, override)
}

/** Same computation as weekCapacity for a single date (used for the Today view). */
export function dayCapacity(date: ISODate, settings: Settings, events: CalendarEvent[]): WeekCapacity {
  return compute([date], settings, events, null)
}
