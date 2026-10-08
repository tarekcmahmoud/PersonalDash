import { describe, expect, it } from 'vitest'
import { makeProject, makeSystemProject, makeTask } from './factories'
import {
  CHRONIC_SLIP_THRESHOLD,
  carryOver,
  completeTask,
  isChronicSlipper,
  reopenTask,
  returnToProject,
  weekRetro,
} from './review'

const WEEK = '2026-10-05' // Mon 2026-10-05 .. Sun 2026-10-11
const NEXT = '2026-10-12'

/** Local-time ISO datetime (month is 1-based here). */
const local = (m: number, d: number, h = 12, min = 0, s = 0, ms = 0): string =>
  new Date(2026, m - 1, d, h, min, s, ms).toISOString()

const doneAt = (title: string, projectId: string | null, completedAt: string) =>
  makeTask({ title, projectId, status: 'done', completedAt })

describe('weekRetro', () => {
  const pA = makeProject({ name: 'A', rank: 10 })
  const pB = makeProject({ name: 'B', rank: 20 })
  const pC = makeProject({ name: 'C', rank: 5 })

  it('returns an empty retro for no tasks', () => {
    const r = weekRetro({ projects: [], tasks: [] }, WEEK)
    expect(r).toEqual({ weekStart: WEEK, doneByProject: [], leftovers: [], untouched: [], totalDone: 0 })
  })

  it('treats the week as Mon 00:00 – Sun 23:59:59 local', () => {
    const tasks = [
      doneAt('before', pA.id, local(10, 4, 23, 59, 59, 999)),
      doneAt('monStart', pA.id, local(10, 5, 0, 0, 0)),
      doneAt('sunEnd', pA.id, local(10, 11, 23, 59, 59)),
      doneAt('after', pA.id, local(10, 12, 0, 0, 0)),
    ]
    const r = weekRetro({ projects: [pA], tasks }, WEEK)
    expect(r.totalDone).toBe(2)
    expect(r.doneByProject[0]!.tasks.map((t) => t.title)).toEqual(['monStart', 'sunEnd'])
  })

  it('ignores tasks without completedAt', () => {
    const t = makeTask({ title: 'x', projectId: pA.id, status: 'done', completedAt: null })
    expect(weekRetro({ projects: [pA], tasks: [t] }, WEEK).totalDone).toBe(0)
  })

  it('groups by project ordered by rank, Inbox last, only non-empty groups', () => {
    const tasks = [
      doneAt('inbox', null, local(10, 6)),
      doneAt('b1', pB.id, local(10, 6)),
      doneAt('a1', pA.id, local(10, 7)),
      doneAt('b2', pB.id, local(10, 8)),
      doneAt('a2', pA.id, local(10, 6)),
    ]
    const r = weekRetro({ projects: [pA, pB, pC], tasks }, WEEK)
    expect(r.doneByProject.map((g) => g.projectId)).toEqual([pA.id, pB.id, null])
    expect(r.doneByProject[0]!.tasks.map((t) => t.title)).toEqual(['a2', 'a1']) // by completion time
    expect(r.doneByProject[1]!.tasks.map((t) => t.title)).toEqual(['b1', 'b2'])
    expect(r.doneByProject[2]!.tasks.map((t) => t.title)).toEqual(['inbox'])
    expect(r.totalDone).toBe(5)
  })

  it('puts the system project by its rank (after normal projects) and Inbox after it', () => {
    const sys = makeSystemProject()
    const tasks = [
      doneAt('inbox', null, local(10, 6)),
      doneAt('sys', sys.id, local(10, 6)),
      doneAt('a', pA.id, local(10, 6)),
    ]
    const r = weekRetro({ projects: [sys, pA], tasks }, WEEK)
    expect(r.doneByProject.map((g) => g.projectId)).toEqual([pA.id, sys.id, null])
  })

  it('leftovers are tasks planned in the week that are not done', () => {
    const todo = makeTask({ title: 'todo', projectId: pA.id, weekStart: WEEK })
    const waiting = makeTask({ title: 'waiting', projectId: pA.id, weekStart: WEEK, status: 'waiting' })
    const done = makeTask({
      title: 'done',
      projectId: pA.id,
      weekStart: WEEK,
      status: 'done',
      completedAt: local(10, 6),
    })
    const other = makeTask({ title: 'other', projectId: pA.id, weekStart: NEXT })
    const unplanned = makeTask({ title: 'unplanned', projectId: pA.id })
    const r = weekRetro({ projects: [pA], tasks: [todo, waiting, done, other, unplanned] }, WEEK)
    expect(r.leftovers.map((t) => t.title)).toEqual(['todo', 'waiting'])
  })

  it('untouched = active non-system projects with nothing completed, ordered by rank', () => {
    const sys = makeSystemProject()
    const hold = makeProject({ name: 'hold', status: 'on_hold', rank: 1 })
    const finished = makeProject({ name: 'fin', status: 'done', rank: 2 })
    const tasks = [doneAt('a', pA.id, local(10, 6)), doneAt('old', pC.id, local(10, 1))]
    const r = weekRetro({ projects: [pB, sys, hold, finished, pA, pC], tasks }, WEEK)
    expect(r.untouched.map((p) => p.name)).toEqual(['C', 'B'])
  })

  it('a project with done tasks only in other weeks is untouched', () => {
    const tasks = [doneAt('later', pA.id, local(10, 13))]
    expect(weekRetro({ projects: [pA], tasks }, WEEK).untouched).toEqual([pA])
  })

  it('does not mutate the context', () => {
    const projects = [pB, pA]
    const tasks = [doneAt('b', pB.id, local(10, 6)), doneAt('a', pA.id, local(10, 6))]
    weekRetro({ projects, tasks }, WEEK)
    expect(projects.map((p) => p.name)).toEqual(['B', 'A'])
    expect(tasks.map((t) => t.title)).toEqual(['b', 'a'])
  })
})

describe('carryOver', () => {
  it('moves to the next week, clears the pin, bumps slipCount', () => {
    const t = makeTask({ title: 'x', weekStart: WEEK, pinnedDay: '2026-10-07', slipCount: 1 })
    expect(carryOver(t, NEXT)).toEqual({ weekStart: NEXT, pinnedDay: null, slipCount: 2, gcalDirty: false })
  })

  it('marks gcalDirty when the task has a calendar event', () => {
    const t = makeTask({ title: 'x', weekStart: WEEK, pinnedDay: '2026-10-07', gcalEventId: 'g1' })
    expect(carryOver(t, NEXT).gcalDirty).toBe(true)
  })

  it('keeps an existing gcalDirty flag', () => {
    expect(carryOver(makeTask({ title: 'x', gcalDirty: true }), NEXT).gcalDirty).toBe(true)
  })
})

describe('returnToProject', () => {
  it('unplans the task and bumps slipCount', () => {
    const t = makeTask({ title: 'x', weekStart: WEEK, pinnedDay: '2026-10-07', slipCount: 0 })
    expect(returnToProject(t)).toEqual({ weekStart: null, pinnedDay: null, slipCount: 1, gcalDirty: false })
  })

  it('marks gcalDirty when the task has a calendar event', () => {
    expect(returnToProject(makeTask({ title: 'x', gcalEventId: 'g1' })).gcalDirty).toBe(true)
  })

  it('keeps an existing gcalDirty flag', () => {
    expect(returnToProject(makeTask({ title: 'x', gcalDirty: true })).gcalDirty).toBe(true)
  })
})

describe('isChronicSlipper', () => {
  it('is true at or above the threshold', () => {
    expect(CHRONIC_SLIP_THRESHOLD).toBe(2)
    expect(isChronicSlipper(makeTask({ title: 'x', slipCount: 1 }))).toBe(false)
    expect(isChronicSlipper(makeTask({ title: 'x', slipCount: 2 }))).toBe(true)
    expect(isChronicSlipper(makeTask({ title: 'x', slipCount: 5 }))).toBe(true)
  })
})

describe('completeTask / reopenTask', () => {
  const now = '2026-10-08T10:00:00.000Z'

  it('completes a task', () => {
    expect(completeTask(makeTask({ title: 'x' }), now)).toEqual({
      status: 'done',
      completedAt: now,
      gcalDirty: false,
    })
  })

  it('completing a task with a calendar event marks it dirty', () => {
    expect(completeTask(makeTask({ title: 'x', gcalEventId: 'g1' }), now).gcalDirty).toBe(true)
  })

  it('completing keeps an existing dirty flag', () => {
    expect(completeTask(makeTask({ title: 'x', gcalDirty: true }), now).gcalDirty).toBe(true)
  })

  it('reopens a task', () => {
    const t = makeTask({ title: 'x', status: 'done', completedAt: now })
    expect(reopenTask(t)).toEqual({ status: 'todo', completedAt: null, gcalDirty: false })
  })

  it('reopening a task with a calendar event marks it dirty', () => {
    expect(reopenTask(makeTask({ title: 'x', status: 'done', gcalEventId: 'g1' })).gcalDirty).toBe(true)
  })

  it('reopening keeps an existing dirty flag', () => {
    expect(reopenTask(makeTask({ title: 'x', status: 'done', gcalDirty: true })).gcalDirty).toBe(true)
  })
})
