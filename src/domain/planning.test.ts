import type { PlanContext } from './context'
import { makeMilestone, makeProject, makeSystemProject, makeTask } from './factories'
import { PICK_LIST_DEPTH, buildPickList, isSchedulable, tasksInWeek } from './planning'
import type { Dependency, Milestone, Project, Task } from './types'
import { DEFAULT_SETTINGS } from './types'

const WEEK = '2026-10-05'
const TODAY = '2026-10-08'

function ctxOf(
  projects: Project[],
  tasks: Task[] = [],
  extra: { milestones?: Milestone[]; dependencies?: Dependency[] } = {},
): PlanContext {
  return {
    projects,
    milestones: extra.milestones ?? [],
    tasks,
    dependencies: extra.dependencies ?? [],
    checklist: [],
    templates: [],
    weeks: [],
    resources: [],
    settings: DEFAULT_SETTINGS,
    weekStart: WEEK,
    today: TODAY,
    events: [],
  }
}

const proj = (id: string, extra: Partial<Project> = {}) =>
  makeProject({ id, name: id, targetDate: '2027-06-01', rank: 10, ...extra })

/** Tasks t1..tn in project `pid`, in order. */
const chain = (pid: string, n: number, each: (i: number) => Partial<Task> = () => ({})): Task[] =>
  Array.from({ length: n }, (_, i) =>
    makeTask({ id: `${pid}-t${i + 1}`, title: `t${i + 1}`, projectId: pid, position: i, ...each(i) }),
  )

const groupIds = (groups: { project: Project }[]) => groups.map((g) => g.project.id)

describe('isSchedulable', () => {
  it('is false for XL and done tasks', () => {
    expect(isSchedulable(makeTask({ title: 'a', size: 'XL' }))).toBe(false)
    expect(isSchedulable(makeTask({ title: 'a', status: 'done' }))).toBe(false)
    expect(isSchedulable(makeTask({ title: 'a', size: 'XL', status: 'done' }))).toBe(false)
  })
  it('is true for S/M/L todo and waiting tasks', () => {
    for (const size of ['S', 'M', 'L'] as const) {
      expect(isSchedulable(makeTask({ title: 'a', size }))).toBe(true)
    }
    expect(isSchedulable(makeTask({ title: 'a', status: 'waiting' }))).toBe(true)
  })
})

describe('tasksInWeek', () => {
  it('returns tasks planned in exactly that week, any status', () => {
    const tasks = [
      makeTask({ id: 'a', title: 'a', weekStart: WEEK }),
      makeTask({ id: 'b', title: 'b', weekStart: WEEK, status: 'done' }),
      makeTask({ id: 'c', title: 'c', weekStart: '2026-10-12' }),
      makeTask({ id: 'd', title: 'd' }),
    ]
    expect(tasksInWeek(tasks, WEEK).map((x) => x.id)).toEqual(['a', 'b'])
    expect(tasksInWeek([], WEEK)).toEqual([])
  })
})

describe('buildPickList: groups', () => {
  it('has a group per active project only, system project included', () => {
    const sys = makeSystemProject()
    const projects = [
      proj('a'),
      proj('hold', { status: 'on_hold' }),
      proj('done', { status: 'done' }),
      { ...sys, id: 'sys' },
    ]
    expect(groupIds(buildPickList(ctxOf(projects))).sort()).toEqual(['a', 'sys'])
  })

  it('returns [] with no projects, and an empty candidate list for an empty project', () => {
    expect(buildPickList(ctxOf([]))).toEqual([])
    const [g] = buildPickList(ctxOf([proj('a')]))
    expect(g!.candidates).toEqual([])
    expect(g!.hasMore).toBe(false)
    expect(g!.plannedCount).toBe(0)
  })

  it('includes health flags and plannedCount', () => {
    const tasks = chain('a', 3, (i) => (i === 0 ? { weekStart: WEEK, status: 'done' } : {}))
    const [g] = buildPickList(ctxOf([proj('a', { weeklyMin: 2 })], tasks))
    expect(g!.plannedCount).toBe(1)
    expect(g!.flags).toEqual([{ kind: 'below_min', planned: 1, min: 2 }])
  })

  it('plannedCount ignores other weeks and other projects', () => {
    const tasks = [
      ...chain('a', 2, () => ({ weekStart: '2026-10-12' })),
      ...chain('b', 1, () => ({ weekStart: WEEK })),
    ]
    const groups = buildPickList(ctxOf([proj('a'), proj('b')], tasks))
    expect(groups.find((g) => g.project.id === 'a')!.plannedCount).toBe(0)
    expect(groups.find((g) => g.project.id === 'b')!.plannedCount).toBe(1)
  })

  it('does not flag the system project as neglected or below_min', () => {
    const sys = { ...makeSystemProject(), id: 'sys', weeklyMin: 3 }
    const [g] = buildPickList(ctxOf([sys], chain('sys', 2)))
    expect(g!.flags).toEqual([])
  })
})

describe('buildPickList: candidates', () => {
  it('takes the next PICK_LIST_DEPTH todo tasks in workflow order and sets hasMore', () => {
    const tasks = chain('a', 5)
    const [g] = buildPickList(ctxOf([proj('a')], tasks))
    expect(PICK_LIST_DEPTH).toBe(3)
    expect(g!.candidates.map((c) => c.task.id)).toEqual(['a-t1', 'a-t2', 'a-t3'])
    expect(g!.hasMore).toBe(true)
  })

  it('hasMore is false when exactly depth todo tasks exist', () => {
    const [g] = buildPickList(ctxOf([proj('a')], chain('a', 3)))
    expect(g!.candidates).toHaveLength(3)
    expect(g!.hasMore).toBe(false)
  })

  it('skips done and waiting tasks (only todo become candidates) and hasMore counts todos only', () => {
    const tasks = chain('a', 6, (i) => ({ status: i === 0 ? 'done' : i === 1 ? 'waiting' : 'todo' }))
    const [g] = buildPickList(ctxOf([proj('a')], tasks))
    expect(g!.candidates.map((c) => c.task.id)).toEqual(['a-t3', 'a-t4', 'a-t5'])
    expect(g!.hasMore).toBe(true)
    const tasks2 = chain('a', 5, (i) => ({ status: i < 2 ? 'done' : 'todo' }))
    const [g2] = buildPickList(ctxOf([proj('a')], tasks2))
    expect(g2!.candidates).toHaveLength(3)
    expect(g2!.hasMore).toBe(false)
  })

  it('follows milestone workflow order', () => {
    const m = makeMilestone({ id: 'm1', projectId: 'a', name: 'm', position: 0 })
    const tasks = [
      makeTask({ id: 'inMs', title: 'x', projectId: 'a', milestoneId: 'm1' }),
      makeTask({ id: 'loose', title: 'y', projectId: 'a', position: 50 }),
    ]
    const [g] = buildPickList(ctxOf([proj('a')], tasks, { milestones: [m] }))
    expect(g!.candidates.map((c) => c.task.id)).toEqual(['loose', 'inMs'])
  })

  it('depth override applies per project, including smaller and larger values', () => {
    const tasks = [...chain('a', 8), ...chain('b', 8)]
    const groups = buildPickList(ctxOf([proj('a', { rank: 1 }), proj('b', { rank: 2 })], tasks), {
      a: 6,
      b: 1,
    })
    const a = groups.find((g) => g.project.id === 'a')!
    const b = groups.find((g) => g.project.id === 'b')!
    expect(a.candidates).toHaveLength(6)
    expect(a.hasMore).toBe(true)
    expect(b.candidates).toHaveLength(1)
    expect(b.hasMore).toBe(true)
  })

  it('depth override large enough clears hasMore; unspecified projects use the default', () => {
    const tasks = [...chain('a', 5), ...chain('b', 5)]
    const groups = buildPickList(ctxOf([proj('a', { rank: 1 }), proj('b', { rank: 2 })], tasks), { a: 10 })
    expect(groups[0]!.candidates).toHaveLength(5)
    expect(groups[0]!.hasMore).toBe(false)
    expect(groups[1]!.candidates).toHaveLength(PICK_LIST_DEPTH)
  })
})

describe('buildPickList: selectability', () => {
  it('first task is selectable; later ones are blocked by their predecessor', () => {
    const [g] = buildPickList(ctxOf([proj('a')], chain('a', 3)))
    const [c1, c2, c3] = g!.candidates
    expect(c1).toMatchObject({ planned: false, selectable: true, reason: null, blockedBy: [] })
    expect(c2).toMatchObject({ planned: false, selectable: false, reason: 'blocked' })
    expect(c2!.blockedBy.map((b) => b.id)).toEqual(['a-t1'])
    expect(c3!.blockedBy.map((b) => b.id)).toEqual(['a-t2'])
  })

  it('a done predecessor leaves the next task selectable', () => {
    const tasks = chain('a', 3, (i) => (i === 0 ? { status: 'done' } : {}))
    const [g] = buildPickList(ctxOf([proj('a')], tasks))
    expect(g!.candidates[0]).toMatchObject({ selectable: true, reason: null })
    expect(g!.candidates[1]).toMatchObject({ selectable: false, reason: 'blocked' })
  })

  it('a waiting predecessor still blocks', () => {
    const tasks = chain('a', 2, (i) => (i === 0 ? { status: 'waiting' } : {}))
    const [g] = buildPickList(ctxOf([proj('a')], tasks))
    expect(g!.candidates).toHaveLength(1)
    expect(g!.candidates[0]).toMatchObject({ selectable: false, reason: 'blocked' })
    expect(g!.candidates[0]!.blockedBy.map((b) => b.id)).toEqual(['a-t1'])
  })

  it('a blocker planned in the same week makes the candidate selectable', () => {
    const tasks = chain('a', 3, (i) => (i === 0 ? { weekStart: WEEK } : {}))
    const [g] = buildPickList(ctxOf([proj('a')], tasks))
    const [c1, c2, c3] = g!.candidates
    expect(c1).toMatchObject({ planned: true })
    expect(c2).toMatchObject({ planned: false, selectable: true, reason: null, blockedBy: [] })
    expect(c3).toMatchObject({ selectable: false, reason: 'blocked' }) // t2 is not planned
  })

  it('a blocker planned in a different week still blocks', () => {
    const tasks = chain('a', 2, (i) => (i === 0 ? { weekStart: '2026-10-12' } : {}))
    const [g] = buildPickList(ctxOf([proj('a')], tasks))
    expect(g!.candidates[1]).toMatchObject({ selectable: false, reason: 'blocked' })
  })

  it('only blockers not planned this week are reported in blockedBy', () => {
    const tasks = [
      makeTask({ id: 'x', title: 'x', projectId: 'a', position: 0, weekStart: WEEK }),
      makeTask({ id: 'y', title: 'y', projectId: 'a', position: 1 }),
      makeTask({ id: 'z', title: 'z', projectId: 'a', position: 2 }),
    ]
    const deps: Dependency[] = [
      { taskId: 'z', blockedByTaskId: 'x' },
      { taskId: 'z', blockedByTaskId: 'y' },
    ]
    const [g] = buildPickList(ctxOf([proj('a')], tasks, { dependencies: deps }))
    const z = g!.candidates.find((c) => c.task.id === 'z')!
    expect(z.blockedBy.map((b) => b.id)).toEqual(['y'])
    expect(z).toMatchObject({ selectable: false, reason: 'blocked' })
  })

  it('explicit dependencies replace the implicit rule', () => {
    const tasks = chain('a', 3)
    const deps: Dependency[] = [{ taskId: 'a-t3', blockedByTaskId: 'a-t1' }]
    const [g] = buildPickList(ctxOf([proj('a')], tasks, { dependencies: deps }))
    expect(g!.candidates[2]!.blockedBy.map((b) => b.id)).toEqual(['a-t1'])
    // And a finished explicit blocker frees the task even though t2 is open.
    const done = tasks.map((t) => (t.id === 'a-t1' ? { ...t, status: 'done' as const } : t))
    const [g2] = buildPickList(ctxOf([proj('a')], done, { dependencies: deps }))
    expect(g2!.candidates.find((c) => c.task.id === 'a-t3')).toMatchObject({ selectable: true, reason: null })
  })

  it('XL tasks are not selectable, reason xl', () => {
    const tasks = chain('a', 1, () => ({ size: 'XL' }))
    const [g] = buildPickList(ctxOf([proj('a')], tasks))
    expect(g!.candidates[0]).toMatchObject({ selectable: false, reason: 'xl', blockedBy: [] })
  })

  it('XL takes precedence over blocked', () => {
    const tasks = chain('a', 2, (i) => (i === 1 ? { size: 'XL' } : {}))
    const [g] = buildPickList(ctxOf([proj('a')], tasks))
    expect(g!.candidates[1]!.blockedBy).toHaveLength(1)
    expect(g!.candidates[1]).toMatchObject({ selectable: false, reason: 'xl' })
  })

  it('XL stays unselectable even if its blocker is planned this week', () => {
    const tasks = chain('a', 2, (i) => (i === 0 ? { weekStart: WEEK } : { size: 'XL' }))
    const [g] = buildPickList(ctxOf([proj('a')], tasks))
    expect(g!.candidates[1]).toMatchObject({ selectable: false, reason: 'xl', blockedBy: [] })
  })

  it('an already planned task is shown planned regardless of XL or blockers', () => {
    const tasks = chain('a', 3, (i) => (i === 2 ? { size: 'XL', weekStart: WEEK } : {}))
    const [g] = buildPickList(ctxOf([proj('a')], tasks))
    expect(g!.candidates[2]).toMatchObject({ planned: true, selectable: true, reason: null })
    const blocked = chain('a', 2, (i) => (i === 1 ? { weekStart: WEEK } : {}))
    const [g2] = buildPickList(ctxOf([proj('a')], blocked))
    expect(g2!.candidates[1]).toMatchObject({ planned: true, selectable: true, reason: null })
  })

  it('inbox tasks never appear in project groups', () => {
    const inbox = makeTask({ id: 'inbox', title: 'i', projectId: null })
    const [g] = buildPickList(ctxOf([proj('a')], [inbox, ...chain('a', 1)]))
    expect(g!.candidates.map((c) => c.task.id)).toEqual(['a-t1'])
  })

  it('system project tasks work like any other', () => {
    const sys = { ...makeSystemProject(), id: 'sys' }
    const [g] = buildPickList(ctxOf([sys], chain('sys', 2)))
    expect(g!.candidates[0]).toMatchObject({ selectable: true })
    expect(g!.candidates[1]).toMatchObject({ selectable: false, reason: 'blocked' })
  })
})

describe('buildPickList: ordering', () => {
  it('orders by rank ascending by default', () => {
    const projects = [proj('c', { rank: 3 }), proj('a', { rank: 1 }), proj('b', { rank: 2 })]
    expect(groupIds(buildPickList(ctxOf(projects)))).toEqual(['a', 'b', 'c'])
  })

  it('is stable for equal ranks (keeps input order)', () => {
    const projects = [proj('x', { rank: 5 }), proj('y', { rank: 5 }), proj('z', { rank: 5 })]
    expect(groupIds(buildPickList(ctxOf(projects)))).toEqual(['x', 'y', 'z'])
  })

  it('puts the system project last by its high rank', () => {
    const projects = [{ ...makeSystemProject(), id: 'sys' }, proj('a', { rank: 1 })]
    expect(groupIds(buildPickList(ctxOf(projects)))).toEqual(['a', 'sys'])
  })

  it('puts below_min projects first', () => {
    const projects = [
      proj('a', { rank: 1 }),
      proj('b', { rank: 2, weeklyMin: 2 }),
      proj('c', { rank: 3, weeklyMin: 1 }),
    ]
    const tasks = [...chain('a', 1, () => ({ weekStart: WEEK })), ...chain('b', 1), ...chain('c', 1)]
    expect(groupIds(buildPickList(ctxOf(projects, tasks)))).toEqual(['b', 'c', 'a'])
  })

  it('a project that met its minimum is not promoted', () => {
    const projects = [proj('a', { rank: 1 }), proj('b', { rank: 2, weeklyMin: 1 })]
    const tasks = [...chain('a', 1), ...chain('b', 1, () => ({ weekStart: WEEK }))]
    expect(groupIds(buildPickList(ctxOf(projects, tasks)))).toEqual(['a', 'b'])
  })

  it('puts hard deadlines within the warning window (soonest first) before the rest', () => {
    const projects = [
      proj('rank1', { rank: 1 }),
      proj('far', { rank: 2, dateKind: 'hard', targetDate: '2026-12-31' }),
      proj('late', { rank: 3, dateKind: 'hard', targetDate: '2026-10-20' }),
      proj('soon', { rank: 4, dateKind: 'hard', targetDate: '2026-10-10' }),
    ]
    expect(groupIds(buildPickList(ctxOf(projects)))).toEqual(['soon', 'late', 'rank1', 'far'])
  })

  it('treats overdue hard deadlines as urgent and sorts them first among urgent ones', () => {
    const projects = [
      proj('soon', { rank: 1, dateKind: 'hard', targetDate: '2026-10-10' }),
      proj('overdue', { rank: 2, dateKind: 'hard', targetDate: '2026-09-01' }),
      proj('plain', { rank: 0 }),
    ]
    expect(groupIds(buildPickList(ctxOf(projects)))).toEqual(['overdue', 'soon', 'plain'])
  })

  it('treats the window as inclusive (14 days) and soft dates as non-urgent', () => {
    const projects = [
      proj('plain', { rank: 1 }),
      proj('edge', { rank: 2, dateKind: 'hard', targetDate: '2026-10-22' }),
      proj('beyond', { rank: 0, dateKind: 'hard', targetDate: '2026-10-23' }),
      proj('soft', { rank: 0.5, dateKind: 'soft', targetDate: '2026-10-09' }),
    ]
    expect(groupIds(buildPickList(ctxOf(projects)))).toEqual(['edge', 'beyond', 'soft', 'plain'])
  })

  it('breaks equal urgent dates by rank', () => {
    const projects = [
      proj('b', { rank: 2, dateKind: 'hard', targetDate: '2026-10-15' }),
      proj('a', { rank: 1, dateKind: 'hard', targetDate: '2026-10-15' }),
    ]
    expect(groupIds(buildPickList(ctxOf(projects)))).toEqual(['a', 'b'])
  })

  it('below_min goes before deadline-urgent projects', () => {
    const projects = [
      proj('urgent', { rank: 1, dateKind: 'hard', targetDate: '2026-10-09' }),
      proj('min', { rank: 9, weeklyMin: 1 }),
    ]
    const tasks = chain('urgent', 1, () => ({ weekStart: WEEK }))
    expect(groupIds(buildPickList(ctxOf(projects, tasks)))).toEqual(['min', 'urgent'])
  })

  it('orders several below_min projects by deadline urgency, then rank', () => {
    const projects = [
      proj('m1', { rank: 1, weeklyMin: 1 }),
      proj('m2', { rank: 2, weeklyMin: 1, dateKind: 'hard', targetDate: '2026-10-12' }),
      proj('m3', { rank: 0, weeklyMin: 1 }),
    ]
    expect(groupIds(buildPickList(ctxOf(projects)))).toEqual(['m2', 'm3', 'm1'])
  })

  it('does not mutate ctx.projects order', () => {
    const projects = [proj('c', { rank: 3 }), proj('a', { rank: 1 })]
    buildPickList(ctxOf(projects))
    expect(projects.map((p) => p.id)).toEqual(['c', 'a'])
  })
})

describe('buildPickList across parallel workstreams', () => {
  it('interleaves streams so each stream’s next step comes first', async () => {
    const { makeMilestone, makeProject, makeTask } = await import('./factories')
    const project = makeProject({ id: 'p', name: 'P', rank: 1 })
    const a = makeMilestone({ id: 'a', projectId: 'p', name: 'A', position: 0 })
    const b = makeMilestone({ id: 'b', projectId: 'p', name: 'B', position: 1 })
    const t = (id: string, milestoneId: string, position: number) =>
      makeTask({ id, title: id, projectId: 'p', milestoneId, position, size: 'S' })
    const tasks = [t('a1', 'a', 0), t('a2', 'a', 1), t('a3', 'a', 2), t('b1', 'b', 0), t('b2', 'b', 1)]
    const [group] = buildPickList(ctxOf([project], tasks, { milestones: [a, b] }), { p: 4 })
    expect(group!.candidates.map((c) => c.task.id)).toEqual(['a1', 'b1', 'a2', 'b2'])
    expect(group!.candidates.find((c) => c.task.id === 'b1')!.selectable).toBe(true)
    expect(group!.hasMore).toBe(true)
  })
})
