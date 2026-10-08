import { addDays, differenceInCalendarDays, format, parseISO, startOfWeek } from 'date-fns'
import type { ISODate, Weekday } from './types'
import { WEEKDAYS } from './types'

// All dates are local calendar dates in 'YYYY-MM-DD'. Weeks run Monday–Sunday.

export const toISODate = (d: Date): ISODate => format(d, 'yyyy-MM-dd')
export const fromISODate = (s: ISODate): Date => parseISO(s)

export const todayISO = (now: Date = new Date()): ISODate => toISODate(now)

/** Monday of the week containing `date`. */
export function weekStartOf(date: ISODate | Date): ISODate {
  const d = typeof date === 'string' ? fromISODate(date) : date
  return toISODate(startOfWeek(d, { weekStartsOn: 1 }))
}

export const addDaysISO = (date: ISODate, days: number): ISODate =>
  toISODate(addDays(fromISODate(date), days))
export const addWeeksISO = (weekStart: ISODate, weeks: number): ISODate => addDaysISO(weekStart, weeks * 7)

/** Sunday of the week starting at weekStart. */
export const weekEndOf = (weekStart: ISODate): ISODate => addDaysISO(weekStart, 6)

/** The 7 dates Monday..Sunday of the week. */
export const weekDays = (weekStart: ISODate): ISODate[] => WEEKDAYS.map((_, i) => addDaysISO(weekStart, i))

export const isInWeek = (date: ISODate, weekStart: ISODate): boolean =>
  date >= weekStart && date <= weekEndOf(weekStart)

/** Weekday key of a date. */
export function weekdayOf(date: ISODate): Weekday {
  const i = (fromISODate(date).getDay() + 6) % 7 // Monday = 0
  return WEEKDAYS[i]!
}

/** Whole days from `from` to `to` (negative if `to` is earlier). */
export const daysBetween = (from: ISODate, to: ISODate): number =>
  differenceInCalendarDays(fromISODate(to), fromISODate(from))

/** e.g. "Oct 6 – 12" or "Sep 29 – Oct 5". */
export function formatWeekRange(weekStart: ISODate): string {
  const s = fromISODate(weekStart)
  const e = fromISODate(weekEndOf(weekStart))
  return s.getMonth() === e.getMonth()
    ? `${format(s, 'MMM d')} – ${format(e, 'd')}`
    : `${format(s, 'MMM d')} – ${format(e, 'MMM d')}`
}
