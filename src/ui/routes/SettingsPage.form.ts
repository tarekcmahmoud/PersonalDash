import type { SchedulableSize, Settings, Weekday, WorkWindow } from '../../domain/types'
import { WEEKDAYS } from '../../domain/types'

/** Editable (string-typed) copy of the settings the form owns. Calendar fields are not part of it. */
export interface SettingsDraft {
  days: Record<Weekday, { on: boolean; start: string; end: string }>
  /** Percent, 10–100. */
  focusPct: string
  sizeHours: Record<SchedulableSize, string>
  activeCap: string
  deadlineDays: string
}

export type DraftErrors = Partial<Record<string, string>>

export const SIZE_KEYS: readonly SchedulableSize[] = ['S', 'M', 'L']
const DEFAULT_WINDOW: WorkWindow = { start: '09:00', end: '18:00' }

const fmtNum = (n: number): string => String(Math.round(n * 1000) / 1000)

export function draftFromSettings(s: Settings): SettingsDraft {
  const days = {} as SettingsDraft['days']
  for (const d of WEEKDAYS) {
    const w = s.workHours[d]
    days[d] = { on: w !== null, start: (w ?? DEFAULT_WINDOW).start, end: (w ?? DEFAULT_WINDOW).end }
  }
  return {
    days,
    focusPct: fmtNum(s.focusFactor * 100),
    sizeHours: { S: fmtNum(s.sizeHours.S), M: fmtNum(s.sizeHours.M), L: fmtNum(s.sizeHours.L) },
    activeCap: String(s.activeCap),
    deadlineDays: String(s.deadlineWarningDays),
  }
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/

function parseNumber(raw: string): number | null {
  if (raw.trim() === '') return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

/**
 * Validate the draft against `base` and produce the settings to save. Invalid fields keep their value from
 * `base` (so the result is always usable, e.g. for the live capacity example) and get an entry in `errors`.
 * Error keys: `day.mon`, `focus`, `size.S`, `activeCap`, `deadlineDays`.
 */
export function parseDraft(
  draft: SettingsDraft,
  base: Settings,
): { settings: Settings; errors: DraftErrors; valid: boolean } {
  const errors: DraftErrors = {}
  const next: Settings = { ...base }

  const workHours = { ...base.workHours }
  for (const d of WEEKDAYS) {
    const day = draft.days[d]
    if (!day.on) {
      workHours[d] = null
      continue
    }
    if (!TIME.test(day.start) || !TIME.test(day.end)) {
      errors[`day.${d}`] = 'Enter a start and an end time.'
    } else if (day.end <= day.start) {
      errors[`day.${d}`] = 'End time must be after the start time.'
    } else {
      workHours[d] = { start: day.start, end: day.end }
    }
  }
  next.workHours = workHours

  const pct = parseNumber(draft.focusPct)
  if (pct === null || pct < 10 || pct > 100) errors.focus = 'Enter a percentage from 10 to 100.'
  else next.focusFactor = pct / 100

  const sizeHours = { ...base.sizeHours }
  for (const k of SIZE_KEYS) {
    const h = parseNumber(draft.sizeHours[k])
    if (h === null || h <= 0 || h > 80) errors[`size.${k}`] = 'Enter hours greater than 0 (at most 80).'
    else sizeHours[k] = h
  }
  next.sizeHours = sizeHours

  const cap = parseNumber(draft.activeCap)
  if (cap === null || !Number.isInteger(cap) || cap < 1 || cap > 50) {
    errors.activeCap = 'Enter a whole number from 1 to 50.'
  } else next.activeCap = cap

  const dl = parseNumber(draft.deadlineDays)
  if (dl === null || !Number.isInteger(dl) || dl < 1 || dl > 365) {
    errors.deadlineDays = 'Enter a whole number of days from 1 to 365.'
  } else next.deadlineWarningDays = dl

  return { settings: next, errors, valid: Object.keys(errors).length === 0 }
}

/** Format hours with at most one decimal: 27.5, 6, 0.3. */
export const fmtHours = (h: number): string => String(Math.round(h * 10) / 10)
