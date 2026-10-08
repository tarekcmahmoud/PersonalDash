import { describe, expect, it } from 'vitest'
import {
  makeChecklistItem,
  makeMilestone,
  makeProject,
  makeResource,
  makeTask,
  makeTemplate,
} from '../domain/factories'
import { DEFAULT_SETTINGS, type Settings } from '../domain/types'
import {
  checklistItemFromRow,
  checklistItemToRow,
  dependencyFromRow,
  dependencyToRow,
  milestoneFromRow,
  milestoneToRow,
  projectFromRow,
  projectToRow,
  resourceFromRow,
  resourceToRow,
  settingsFromRow,
  settingsToRow,
  taskFromRow,
  taskToRow,
  templateFromRow,
  timestampFromRow,
  templateToRow,
  weekFromRow,
  weekToRow,
} from './supabaseMappers'

describe('supabase mappers round-trip', () => {
  it('project (defaults and fully populated)', () => {
    const a = makeProject({ name: 'A' })
    expect(projectFromRow(projectToRow(a))).toEqual(a)
    const b = makeProject({
      name: 'B',
      outcome: 'Done when shipped',
      targetDate: '2026-12-01',
      dateKind: 'hard',
      status: 'on_hold',
      rank: 2.5,
      weeklyMin: 3,
      isSystem: true,
    })
    expect(projectFromRow(projectToRow(b))).toEqual(b)
    expect(projectToRow(b)).toMatchObject({ target_date: '2026-12-01', weekly_min: 3, is_system: true })
  })

  it('milestone (with and without dates)', () => {
    const a = makeMilestone({ projectId: 'p1', name: 'M' })
    expect(milestoneFromRow(milestoneToRow(a))).toEqual(a)
    const b = makeMilestone({
      projectId: 'p1',
      name: 'M2',
      position: 4,
      targetDate: '2026-11-02',
      dateKind: 'soft',
    })
    expect(milestoneFromRow(milestoneToRow(b))).toEqual(b)
  })

  it('task (inbox defaults and fully populated)', () => {
    const a = makeTask({ title: 'Inbox item' })
    expect(taskFromRow(taskToRow(a))).toEqual(a)
    const b = makeTask({
      title: 'Full',
      projectId: 'p1',
      milestoneId: 'm1',
      notes: 'n',
      doneWhen: 'd',
      size: 'XL',
      position: 7,
      status: 'waiting',
      waitingOn: 'Bob',
      followUpDate: '2026-10-20',
      weekStart: '2026-10-12',
      pinnedDay: '2026-10-14',
      slipCount: 2,
      completedAt: '2026-10-15T10:00:00.000Z',
      gcalEventId: 'evt',
      gcalDirty: true,
    })
    expect(taskFromRow(taskToRow(b))).toEqual(b)
    expect(taskToRow(b)).toMatchObject({ done_when: 'd', follow_up_date: '2026-10-20', slip_count: 2 })
  })

  it('dependency', () => {
    const d = { taskId: 't1', blockedByTaskId: 't2' }
    expect(dependencyFromRow(dependencyToRow(d))).toEqual(d)
    expect(dependencyToRow(d)).toEqual({ task_id: 't1', blocked_by_task_id: 't2' })
  })

  it('checklist item', () => {
    const c = makeChecklistItem({ taskId: 't1', text: 'step', done: true, position: 3 })
    expect(checklistItemFromRow(checklistItemToRow(c))).toEqual(c)
  })

  it('template', () => {
    const t = makeTemplate({ name: 'T', outline: '# Project\n- task' })
    expect(templateFromRow(templateToRow(t))).toEqual(t)
  })

  it('week (with and without values)', () => {
    const a = { weekStart: '2026-10-05', capacityOverride: null, reviewedAt: null }
    expect(weekFromRow(weekToRow(a))).toEqual(a)
    const b = { weekStart: '2026-10-12', capacityOverride: 12.5, reviewedAt: '2026-10-11T18:00:00.000Z' }
    expect(weekFromRow(weekToRow(b))).toEqual(b)
  })

  it('resource (defaults and fully populated)', () => {
    const a = makeResource({ projectId: 'p1', url: 'https://example.com' })
    expect(resourceFromRow(resourceToRow(a))).toEqual(a)
    const b = makeResource({
      projectId: 'p1',
      url: 'https://example.com/docs',
      title: 'Docs',
      description: 'The reference.',
      imageUrl: 'https://example.com/cover.png',
      imagePath: 'u1/abc.png',
      workstreamIds: ['m1', 'm2'],
      position: 2.5,
    })
    expect(resourceFromRow(resourceToRow(b))).toEqual(b)
    expect(resourceToRow(b)).toMatchObject({
      project_id: 'p1',
      image_path: 'u1/abc.png',
      workstream_ids: ['m1', 'm2'],
    })
  })

  it('settings (defaults and customised)', () => {
    expect(settingsFromRow(settingsToRow(DEFAULT_SETTINGS))).toEqual(DEFAULT_SETTINGS)
    const custom: Settings = {
      ...DEFAULT_SETTINGS,
      workHours: { ...DEFAULT_SETTINGS.workHours, sat: { start: '10:00', end: '12:00' }, mon: null },
      focusFactor: 0.5,
      sizeHours: { S: 2, M: 5, L: 10 },
      activeCap: 3,
      deadlineWarningDays: 7,
      calendarConnected: true,
      gcalCalendarId: 'cal@group.calendar.google.com',
    }
    expect(settingsFromRow(settingsToRow(custom))).toEqual(custom)
  })

  it('settings from a row with missing json keys falls back to defaults', () => {
    const row = {
      ...settingsToRow(DEFAULT_SETTINGS),
      work_hours: { mon: { start: '08:00', end: '12:00' } } as never,
      size_hours: { S: 3 } as never,
    }
    const s = settingsFromRow(row)
    expect(s.workHours.mon).toEqual({ start: '08:00', end: '12:00' })
    expect(s.workHours.tue).toEqual(DEFAULT_SETTINGS.workHours.tue)
    expect(s.sizeHours).toEqual({ ...DEFAULT_SETTINGS.sizeHours, S: 3 })
  })
})

describe('timestamps from Postgres', () => {
  it('normalises timestamptz output to toISOString format', () => {
    expect(timestampFromRow('2026-10-08T12:00:00.123+00:00')).toBe('2026-10-08T12:00:00.123Z')
    expect(timestampFromRow('2026-10-08T12:00:00+00:00')).toBe('2026-10-08T12:00:00.000Z')
    expect(timestampFromRow('2026-10-08T12:00:00.123456+00:00')).toBe('2026-10-08T12:00:00.123Z')
  })

  it('applies to every timestamp column', () => {
    const row = { ...taskToRow(makeTask({ title: 'T' })), created_at: '2026-10-08T12:00:00+00:00' }
    expect(taskFromRow({ ...row, completed_at: '2026-10-09T08:30:00.5+00:00' })).toMatchObject({
      createdAt: '2026-10-08T12:00:00.000Z',
      completedAt: '2026-10-09T08:30:00.500Z',
    })
    expect(
      weekFromRow({
        week_start: '2026-10-05',
        capacity_override: null,
        reviewed_at: '2026-10-08T09:00:00+00:00',
      }),
    ).toMatchObject({ reviewedAt: '2026-10-08T09:00:00.000Z' })
    const template = templateToRow(makeTemplate({ name: 'N', outline: '' }))
    expect(templateFromRow({ ...template, updated_at: '2026-10-08T12:00:00+00:00' }).updatedAt).toBe(
      '2026-10-08T12:00:00.000Z',
    )
  })
})
