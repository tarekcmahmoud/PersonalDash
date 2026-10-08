import type { PlanContext } from './context'
import { makeProject, makeSystemProject, makeTask } from './factories'
import { activeProjectCount, isOverActiveCap, projectHealth } from './health'
import type { Project, Task } from './types'
import { DEFAULT_SETTINGS } from './types'

const WEEK = '2026-10-05'
const TODAY = '2026-10-08'

function ctxOf(projects: Project[], tasks: Task[] = [], settings = DEFAULT_SETTINGS): PlanContext {
  return {
    projects,
    milestones: [],
    tasks,
    dependencies: [],
    checklist: [],
    templates: [],
    weeks: [],
    resources: [],
    people: [],
    settings,
    weekStart: WEEK,
    today: TODAY,
    events: [],
  }
}

const proj = (extra: Partial<Project> = {}) =>
  makeProject({ id: 'p1', name: 'P', targetDate: '2027-06-01', ...extra })
const t = (extra: Partial<Task> = {}) => makeTask({ title: 't', projectId: 'p1', ...extra })
const kinds = (flags: { kind: string }[]) => flags.map((f) => f.kind)

describe('projectHealth', () => {
  it('returns [] for on_hold and done projects', () => {
    for (const status of ['on_hold', 'done'] as const) {
      const p = proj({ status, targetDate: '2026-01-01', weeklyMin: 3 })
      expect(projectHealth(p, ctxOf([p]))).toEqual([])
    }
  })

  it('flags a project with no tasks as neglected and no_next_step', () => {
    const p = proj()
    expect(kinds(projectHealth(p, ctxOf([p])))).toEqual(['neglected', 'no_next_step'])
  })

  it('is healthy with a planned todo task', () => {
    const p = proj()
    const tasks = [t({ weekStart: WEEK })]
    expect(projectHealth(p, ctxOf([p], tasks))).toEqual([])
  })

  it('counts planned tasks of any status (todo, waiting, done) as not neglected', () => {
    const p = proj()
    for (const status of ['todo', 'waiting', 'done'] as const) {
      const tasks = [t({ weekStart: WEEK, status }), t({ status: 'todo' })]
      expect(kinds(projectHealth(p, ctxOf([p], tasks)))).not.toContain('neglected')
    }
  })

  it('tasks planned in another week, or of another project, do not count', () => {
    const p = proj()
    const tasks = [
      t({ weekStart: '2026-09-28' }),
      t({ weekStart: '2026-10-12' }),
      t({ projectId: 'other', weekStart: WEEK }),
      t({ projectId: null, weekStart: WEEK }),
    ]
    expect(kinds(projectHealth(p, ctxOf([p], tasks)))).toEqual(['neglected'])
  })

  it('no_next_step is false while a todo or waiting task exists, true when only done tasks remain', () => {
    const p = proj()
    const planned = t({ weekStart: WEEK, status: 'done' })
    expect(kinds(projectHealth(p, ctxOf([p], [planned])))).toEqual(['no_next_step'])
    expect(projectHealth(p, ctxOf([p], [planned, t({ status: 'waiting' })]))).toEqual([])
    expect(projectHealth(p, ctxOf([p], [planned, t({ status: 'todo' })]))).toEqual([])
  })

  it('below_min applies when weeklyMin is set and planned count is lower', () => {
    const p = proj({ weeklyMin: 2 })
    const tasks = [t({ weekStart: WEEK }), t()]
    expect(projectHealth(p, ctxOf([p], tasks))).toEqual([{ kind: 'below_min', planned: 1, min: 2 }])
  })

  it('returns both neglected and below_min when nothing is planned', () => {
    const p = proj({ weeklyMin: 2 })
    expect(projectHealth(p, ctxOf([p], [t()]))).toEqual([
      { kind: 'neglected' },
      { kind: 'below_min', planned: 0, min: 2 },
    ])
  })

  it('does not flag below_min once the minimum is met or when weeklyMin is null', () => {
    const p = proj({ weeklyMin: 2 })
    const tasks = [t({ weekStart: WEEK }), t({ weekStart: WEEK })]
    expect(projectHealth(p, ctxOf([p], tasks))).toEqual([])
    const noMin = proj({ weeklyMin: null })
    expect(kinds(projectHealth(noMin, ctxOf([noMin], [t({ weekStart: WEEK })])))).toEqual([])
  })

  it('weeklyMin 0 never triggers below_min', () => {
    const p = proj({ weeklyMin: 0 })
    expect(kinds(projectHealth(p, ctxOf([p], [t()])))).toEqual(['neglected'])
  })

  describe('deadlines', () => {
    const planned = [t({ weekStart: WEEK })]

    it('deadline_soon within the warning window, inclusive at both ends', () => {
      const today = proj({ targetDate: TODAY, dateKind: 'hard' })
      expect(projectHealth(today, ctxOf([today], planned))).toEqual([
        { kind: 'deadline_soon', date: TODAY, dateKind: 'hard', daysLeft: 0 },
      ])
      const edge = proj({ targetDate: '2026-10-22', dateKind: 'soft' }) // exactly 14 days
      expect(projectHealth(edge, ctxOf([edge], planned))).toEqual([
        { kind: 'deadline_soon', date: '2026-10-22', dateKind: 'soft', daysLeft: 14 },
      ])
    })

    it('no deadline flag just beyond the window', () => {
      const p = proj({ targetDate: '2026-10-23' })
      expect(projectHealth(p, ctxOf([p], planned))).toEqual([])
    })

    it('uses settings.deadlineWarningDays', () => {
      const p = proj({ targetDate: '2026-10-18' }) // 10 days
      const narrow = { ...DEFAULT_SETTINGS, deadlineWarningDays: 7 }
      expect(projectHealth(p, ctxOf([p], planned, narrow))).toEqual([])
      const wide = { ...DEFAULT_SETTINGS, deadlineWarningDays: 10 }
      expect(kinds(projectHealth(p, ctxOf([p], planned, wide)))).toEqual(['deadline_soon'])
    })

    it('overdue when targetDate is before today', () => {
      const p = proj({ targetDate: '2026-10-05', dateKind: 'hard' })
      expect(projectHealth(p, ctxOf([p], planned))).toEqual([
        { kind: 'overdue', date: '2026-10-05', dateKind: 'hard', daysOver: 3 },
      ])
      const yesterday = proj({ targetDate: '2026-10-07' })
      expect(projectHealth(yesterday, ctxOf([yesterday], planned))).toEqual([
        { kind: 'overdue', date: '2026-10-07', dateKind: 'soft', daysOver: 1 },
      ])
    })

    it('never emits both overdue and deadline_soon; no flag without targetDate', () => {
      const none = proj({ targetDate: null })
      expect(projectHealth(none, ctxOf([none], planned))).toEqual([])
    })

    it('combines deadline flag with others in a stable order', () => {
      const p = proj({ targetDate: '2026-10-01', weeklyMin: 1 })
      expect(kinds(projectHealth(p, ctxOf([p])))).toEqual([
        'neglected',
        'below_min',
        'overdue',
        'no_next_step',
      ])
    })
  })

  describe('system project', () => {
    it('is never neglected or below_min and never has no_next_step', () => {
      const s = makeSystemProject()
      expect(projectHealth(s, ctxOf([s]))).toEqual([])
      const withMin = { ...s, weeklyMin: 5 }
      expect(projectHealth(withMin, ctxOf([withMin]))).toEqual([])
    })

    it('can still get deadline flags if it has a targetDate', () => {
      const s = { ...makeSystemProject(), targetDate: '2026-10-01' }
      expect(kinds(projectHealth(s, ctxOf([s])))).toEqual(['overdue'])
    })

    it('has no flags when on_hold', () => {
      const s = { ...makeSystemProject(), status: 'on_hold' as const }
      expect(projectHealth(s, ctxOf([s]))).toEqual([])
    })
  })
})

describe('activeProjectCount / isOverActiveCap', () => {
  const make = (n: number, extra: Partial<Project> = {}) =>
    Array.from({ length: n }, (_, i) => makeProject({ name: `p${i}`, ...extra }))

  it('counts only active, non-system projects', () => {
    const projects = [
      ...make(2),
      ...make(3, { status: 'on_hold' }),
      ...make(1, { status: 'done' }),
      makeSystemProject(),
    ]
    expect(activeProjectCount(projects)).toBe(2)
    expect(activeProjectCount([])).toBe(0)
  })

  it('is over the cap only when strictly greater', () => {
    const settings = { ...DEFAULT_SETTINGS, activeCap: 3 }
    expect(isOverActiveCap({ projects: make(3), settings })).toBe(false)
    expect(isOverActiveCap({ projects: make(4), settings })).toBe(true)
    expect(isOverActiveCap({ projects: [...make(3), makeSystemProject()], settings })).toBe(false)
    expect(isOverActiveCap({ projects: [...make(3), ...make(5, { status: 'on_hold' })], settings })).toBe(
      false,
    )
  })
})
