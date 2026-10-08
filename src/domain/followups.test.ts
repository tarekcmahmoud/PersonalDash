import { describe, expect, it } from 'vitest'
import { makeTask } from './factories'
import { followUpsForWeek, receiveWaiting, snoozeFollowUp } from './followups'

const WEEK = '2026-10-05' // Mon .. Sun 2026-10-11
const NEXT_WEEK = '2026-10-12'
const PREV_WEEK = '2026-09-28'
const TODAY = '2026-10-08'

const waiting = (title: string, followUpDate: string | null, waitingOn: string | null = 'Sam') =>
  makeTask({ title, status: 'waiting', followUpDate, waitingOn })

describe('followUpsForWeek', () => {
  it('includes waiting tasks with a date in the week, with label', () => {
    const t = waiting('Contract', '2026-10-07', 'Legal')
    const items = followUpsForWeek([t], WEEK, TODAY)
    expect(items).toEqual([
      { task: t, kind: 'waiting', date: '2026-10-07', overdue: false, label: 'Follow up: Legal re Contract' },
    ])
  })

  it('includes the Monday and Sunday boundaries', () => {
    const items = followUpsForWeek([waiting('a', '2026-10-05'), waiting('b', '2026-10-11')], WEEK, TODAY)
    expect(items.map((i) => i.task.title)).toEqual(['a', 'b'])
    expect(items.every((i) => !i.overdue)).toBe(true)
  })

  it('includes overdue items in the current week and flags them', () => {
    const items = followUpsForWeek([waiting('old', '2026-09-20')], WEEK, TODAY)
    expect(items).toHaveLength(1)
    expect(items[0]!.overdue).toBe(true)
    expect(items[0]!.date).toBe('2026-09-20')
  })

  it('excludes overdue items when the week is not the current one', () => {
    const t = waiting('old', '2026-09-20')
    expect(followUpsForWeek([t], NEXT_WEEK, TODAY)).toEqual([])
    expect(followUpsForWeek([t], PREV_WEEK, TODAY)).toEqual([])
  })

  it('for a past week, includes items in that week but not overdue ones from before it', () => {
    const items = followUpsForWeek(
      [waiting('in', '2026-09-30'), waiting('before', '2026-09-10')],
      PREV_WEEK,
      TODAY,
    )
    expect(items.map((i) => i.task.title)).toEqual(['in'])
  })

  it('excludes future follow-ups', () => {
    expect(followUpsForWeek([waiting('later', '2026-10-12')], WEEK, TODAY)).toEqual([])
  })

  it('does not show current-week items when viewing the next week', () => {
    const items = followUpsForWeek([waiting('this week', '2026-10-08')], NEXT_WEEK, TODAY)
    expect(items).toEqual([])
  })

  it('includes items dated before the end of a future week only if within it (no overdue)', () => {
    const items = followUpsForWeek([waiting('nw', '2026-10-13')], NEXT_WEEK, TODAY)
    expect(items.map((i) => i.task.title)).toEqual(['nw'])
    expect(items[0]!.overdue).toBe(false)
  })

  it('excludes non-waiting tasks', () => {
    const todo = makeTask({ title: 'todo', status: 'todo', followUpDate: '2026-10-07' })
    const done = makeTask({ title: 'done', status: 'done', followUpDate: '2026-10-07' })
    expect(followUpsForWeek([todo, done], WEEK, TODAY)).toEqual([])
  })

  it('excludes waiting tasks without a follow-up date', () => {
    expect(followUpsForWeek([waiting('nodate', null)], WEEK, TODAY)).toEqual([])
  })

  it('sorts by date ascending (overdue first), stable for ties', () => {
    const items = followUpsForWeek(
      [
        waiting('fri', '2026-10-09'),
        waiting('overdue', '2026-09-30'),
        waiting('tue-1', '2026-10-06'),
        waiting('tue-2', '2026-10-06'),
        waiting('mon', '2026-10-05'),
      ],
      WEEK,
      TODAY,
    )
    expect(items.map((i) => i.task.title)).toEqual(['overdue', 'mon', 'tue-1', 'tue-2', 'fri'])
  })

  it('uses the "re" label without a name when waitingOn is null, empty or blank', () => {
    const items = followUpsForWeek(
      [waiting('A', '2026-10-06', null), waiting('B', '2026-10-06', ''), waiting('C', '2026-10-06', '   ')],
      WEEK,
      TODAY,
    )
    expect(items.map((i) => i.label)).toEqual(['Follow up re A', 'Follow up re B', 'Follow up re C'])
  })

  it('does not mutate the input array', () => {
    const tasks = [waiting('b', '2026-10-08'), waiting('a', '2026-10-06')]
    followUpsForWeek(tasks, WEEK, TODAY)
    expect(tasks.map((t) => t.title)).toEqual(['b', 'a'])
  })
})

describe('snoozeFollowUp', () => {
  it('only changes the follow-up date', () => {
    const t = waiting('x', '2026-10-06')
    expect(snoozeFollowUp(t, '2026-10-20')).toEqual({ followUpDate: '2026-10-20' })
  })
})

describe('receiveWaiting', () => {
  it('returns to todo and clears waiting fields', () => {
    const t = waiting('x', '2026-10-06', 'Sam')
    expect(receiveWaiting(t)).toEqual({ status: 'todo', waitingOn: null, followUpDate: null })
  })
})
