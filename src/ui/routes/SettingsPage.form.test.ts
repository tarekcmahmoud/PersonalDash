import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, type Settings } from '../../domain/types'
import { draftFromSettings, fmtHours, parseDraft } from './SettingsPage.form'

const base: Settings = structuredClone(DEFAULT_SETTINGS)

describe('settings form', () => {
  it('round-trips the default settings', () => {
    const { settings, valid, errors } = parseDraft(draftFromSettings(base), base)
    expect(valid).toBe(true)
    expect(errors).toEqual({})
    expect(settings).toEqual(base)
  })

  it('represents the focus factor as a percentage', () => {
    expect(draftFromSettings(base).focusPct).toBe('70')
    const d = draftFromSettings(base)
    d.focusPct = '85'
    expect(parseDraft(d, base).settings.focusFactor).toBeCloseTo(0.85)
  })

  it('keeps calendar fields from the base settings', () => {
    const connected = { ...base, calendarConnected: true, gcalCalendarId: 'cal' }
    const { settings } = parseDraft(draftFromSettings(connected), connected)
    expect(settings).toMatchObject({ calendarConnected: true, gcalCalendarId: 'cal' })
  })

  it('turns days off and on', () => {
    const d = draftFromSettings(base)
    d.days.mon.on = false
    d.days.sat = { on: true, start: '10:00', end: '14:00' }
    const { settings } = parseDraft(d, base)
    expect(settings.workHours.mon).toBeNull()
    expect(settings.workHours.sat).toEqual({ start: '10:00', end: '14:00' })
  })

  it('rejects an end time that is not after the start time', () => {
    const d = draftFromSettings(base)
    d.days.tue.end = '09:00'
    d.days.wed.end = '08:00'
    const { errors, valid, settings } = parseDraft(d, base)
    expect(valid).toBe(false)
    expect(errors['day.tue']).toMatch(/after/)
    expect(errors['day.wed']).toMatch(/after/)
    expect(settings.workHours.tue).toEqual(base.workHours.tue) // falls back to the saved value
  })

  it('ignores the times of days that are off', () => {
    const d = draftFromSettings(base)
    d.days.sun = { on: false, start: '18:00', end: '09:00' }
    expect(parseDraft(d, base).valid).toBe(true)
  })

  it('rejects empty or malformed times', () => {
    const d = draftFromSettings(base)
    d.days.mon.start = ''
    expect(parseDraft(d, base).errors['day.mon']).toBeDefined()
  })

  it.each(['9', '101', '', 'abc'])('rejects focus factor %j', (value) => {
    const d = draftFromSettings(base)
    d.focusPct = value
    expect(parseDraft(d, base).errors.focus).toBeDefined()
  })

  it.each(['10', '100', '55.5'])('accepts focus factor %j', (value) => {
    const d = draftFromSettings(base)
    d.focusPct = value
    expect(parseDraft(d, base).errors.focus).toBeUndefined()
  })

  it('validates task sizes', () => {
    const d = draftFromSettings(base)
    d.sizeHours = { S: '0', M: '2.5', L: '-1' }
    const { errors, settings } = parseDraft(d, base)
    expect(errors['size.S']).toBeDefined()
    expect(errors['size.M']).toBeUndefined()
    expect(errors['size.L']).toBeDefined()
    expect(settings.sizeHours.M).toBe(2.5)
  })

  it('validates the project cap and deadline warning as whole numbers', () => {
    const d = draftFromSettings(base)
    d.activeCap = '2.5'
    d.deadlineDays = '0'
    const { errors } = parseDraft(d, base)
    expect(errors.activeCap).toBeDefined()
    expect(errors.deadlineDays).toBeDefined()
    d.activeCap = '3'
    d.deadlineDays = '30'
    const ok = parseDraft(d, base)
    expect(ok.valid).toBe(true)
    expect(ok.settings).toMatchObject({ activeCap: 3, deadlineWarningDays: 30 })
  })

  it('formats hours with at most one decimal', () => {
    expect([45, 6, 27.5, 0.25, 31.5].map(fmtHours)).toEqual(['45', '6', '27.5', '0.3', '31.5'])
  })
})
