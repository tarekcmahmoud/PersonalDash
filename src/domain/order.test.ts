import { makeMilestone, makeTask } from './factories'
import {
  explicitBlockerIds,
  isReady,
  nextTask,
  nextTasks,
  orderedMilestones,
  orderedProjectTasks,
  projectWorkstreams,
  streamLabel,
  streamTree,
  unfinishedBlockers,
  wouldCreateCycle,
} from './order'
import type { Dependency, Milestone, Task } from './types'

const P = 'p1'

function task(id: string, extra: Partial<Task> = {}): Task {
  return makeTask({ id, title: id, projectId: P, createdAt: '2026-01-01T00:00:00+00:00', ...extra })
}

const ctxOf = (tasks: Task[], milestones: Milestone[] = [], dependencies: Dependency[] = []) => ({
  tasks,
  milestones,
  dependencies,
})

const ids = (ts: Task[]) => ts.map((t) => t.id)

describe('orderedProjectTasks', () => {
  it('returns [] for an empty project', () => {
    expect(orderedProjectTasks(P, [], [])).toEqual([])
    expect(orderedProjectTasks(P, [makeMilestone({ projectId: P, name: 'm' })], [])).toEqual([])
  })

  it('puts milestone-less tasks first, then milestones by position, tasks by position', () => {
    const m1 = makeMilestone({ id: 'm1', projectId: P, name: 'one', position: 1 })
    const m2 = makeMilestone({ id: 'm2', projectId: P, name: 'two', position: 0 })
    const tasks = [
      task('a', { milestoneId: 'm1', position: 1 }),
      task('b', { milestoneId: 'm1', position: 0 }),
      task('c', { milestoneId: 'm2', position: 5 }),
      task('d', { position: 2 }),
      task('e', { position: 1 }),
    ]
    expect(ids(orderedProjectTasks(P, [m1, m2], tasks))).toEqual(['e', 'd', 'c', 'b', 'a'])
  })

  it('includes done tasks', () => {
    const tasks = [task('a', { status: 'done' }), task('b', { position: 1 })]
    expect(ids(orderedProjectTasks(P, [], tasks))).toEqual(['a', 'b'])
  })

  it('ignores other projects and inbox tasks', () => {
    const m = makeMilestone({ id: 'mx', projectId: 'other', name: 'x' })
    const tasks = [
      task('a'),
      task('b', { projectId: 'other', milestoneId: 'mx' }),
      task('c', { projectId: null }),
    ]
    expect(ids(orderedProjectTasks(P, [m], tasks))).toEqual(['a'])
  })

  it('breaks position ties by createdAt then id', () => {
    const tasks = [
      task('z', { createdAt: '2026-01-01T00:00:00+00:00' }),
      task('b', { createdAt: '2026-01-02T00:00:00+00:00' }),
      task('a', { createdAt: '2026-01-02T00:00:00+00:00' }),
    ]
    expect(ids(orderedProjectTasks(P, [], tasks))).toEqual(['z', 'a', 'b'])
  })

  it('breaks milestone position ties by id and does not mutate its inputs', () => {
    const mB = makeMilestone({ id: 'mB', projectId: P, name: 'B', position: 0 })
    const mA = makeMilestone({ id: 'mA', projectId: P, name: 'A', position: 0 })
    const tasks = [task('t1', { milestoneId: 'mB' }), task('t2', { milestoneId: 'mA' })]
    const milestones = [mB, mA]
    expect(ids(orderedProjectTasks(P, milestones, tasks))).toEqual(['t2', 't1'])
    expect(milestones).toEqual([mB, mA])
    expect(ids(tasks)).toEqual(['t1', 't2'])
  })

  it('treats a task pointing at a foreign/unknown milestone as milestone-less', () => {
    const m = makeMilestone({ id: 'm1', projectId: P, name: 'm', position: 0 })
    const tasks = [task('a', { milestoneId: 'm1' }), task('b', { milestoneId: 'ghost', position: 9 })]
    expect(ids(orderedProjectTasks(P, [m], tasks))).toEqual(['b', 'a'])
  })
})

describe('unfinishedBlockers (no links)', () => {
  it('a task without links is never blocked, whatever comes before it', () => {
    const tasks = [task('a', { status: 'waiting' }), task('b', { position: 1 }), task('c', { position: 2 })]
    for (const t of tasks) expect(unfinishedBlockers(t, ctxOf(tasks))).toEqual([])
  })

  it('order inside a workstream is priority only', () => {
    const m1 = makeMilestone({ id: 'm1', projectId: P, name: 'Design', position: 0 })
    const tasks = [task('d1', { milestoneId: 'm1' }), task('d2', { milestoneId: 'm1', position: 1 })]
    expect(unfinishedBlockers(tasks[1]!, ctxOf(tasks, [m1]))).toEqual([])
  })

  it('a task missing from the context has no blockers', () => {
    const stray = task('stray')
    expect(unfinishedBlockers(stray, ctxOf([task('a')]))).toEqual([])
  })
})

describe('unfinishedBlockers (explicit dependencies)', () => {
  it('a task waits for exactly its linked tasks', () => {
    const tasks = [task('a'), task('b', { position: 1 }), task('c', { position: 2 })]
    const deps: Dependency[] = [{ taskId: 'c', blockedByTaskId: 'a' }]
    expect(ids(unfinishedBlockers(tasks[2]!, ctxOf(tasks, [], deps)))).toEqual(['a'])
  })

  it('a waiting blocker still blocks', () => {
    const tasks = [task('a', { status: 'waiting' }), task('b', { position: 1 })]
    const deps: Dependency[] = [{ taskId: 'b', blockedByTaskId: 'a' }]
    expect(ids(unfinishedBlockers(tasks[1]!, ctxOf(tasks, [], deps)))).toEqual(['a'])
  })

  it('a blocker that is done leaves the task unblocked', () => {
    const tasks = [task('a', { status: 'done' }), task('b', { position: 1 }), task('c', { position: 2 })]
    const deps: Dependency[] = [{ taskId: 'c', blockedByTaskId: 'a' }]
    expect(unfinishedBlockers(tasks[2]!, ctxOf(tasks, [], deps))).toEqual([])
  })

  it('supports multiple blockers and drops the finished ones', () => {
    const tasks = [
      task('a', { status: 'waiting' }),
      task('b', { position: 1, status: 'done' }),
      task('c', { position: 2 }),
      task('d', { position: 3 }),
    ]
    const deps: Dependency[] = [
      { taskId: 'd', blockedByTaskId: 'a' },
      { taskId: 'd', blockedByTaskId: 'b' },
      { taskId: 'd', blockedByTaskId: 'c' },
    ]
    expect(ids(unfinishedBlockers(tasks[3]!, ctxOf(tasks, [], deps)))).toEqual(['a', 'c'])
  })

  it('works across projects and for inbox tasks', () => {
    const blocker = task('x', { projectId: 'other' })
    const inbox = task('i', { projectId: null })
    const deps: Dependency[] = [{ taskId: 'i', blockedByTaskId: 'x' }]
    expect(ids(unfinishedBlockers(inbox, ctxOf([blocker, inbox], [], deps)))).toEqual(['x'])
  })

  it('ignores dependencies pointing at unknown tasks', () => {
    const tasks = [task('a'), task('b', { position: 1 })]
    const deps: Dependency[] = [{ taskId: 'b', blockedByTaskId: 'ghost' }]
    expect(unfinishedBlockers(tasks[1]!, ctxOf(tasks, [], deps))).toEqual([])
  })
})

describe('isReady / nextTask', () => {
  it('isReady requires status todo and no unfinished blockers', () => {
    const tasks = [
      task('a'),
      task('b', { position: 1 }),
      task('c', { position: 2, status: 'waiting' }),
      task('d', { position: 3, status: 'done' }),
    ]
    const ctx = ctxOf(tasks, [], [{ taskId: 'b', blockedByTaskId: 'a' }])
    expect(isReady(tasks[0]!, ctx)).toBe(true)
    expect(isReady(tasks[1]!, ctx)).toBe(false) // waits for a
    expect(isReady(tasks[2]!, ctx)).toBe(false) // not todo
    expect(isReady(tasks[3]!, ctx)).toBe(false) // done
  })

  it('isReady is true once the blocker is done', () => {
    const tasks = [task('a', { status: 'done' }), task('b', { position: 1 })]
    expect(isReady(tasks[1]!, ctxOf(tasks, [], [{ taskId: 'b', blockedByTaskId: 'a' }]))).toBe(true)
  })

  it('nextTask returns the first ready task in workflow order', () => {
    const tasks = [task('a', { status: 'done' }), task('b', { position: 1 }), task('c', { position: 2 })]
    expect(nextTask(P, ctxOf(tasks))?.id).toBe('b')
  })

  it('nextTask skips blocked todos and finds a later ready one', () => {
    const tasks = [task('a', { status: 'waiting' }), task('b', { position: 1 }), task('c', { position: 2 })]
    const chain: Dependency[] = [
      { taskId: 'b', blockedByTaskId: 'a' },
      { taskId: 'c', blockedByTaskId: 'b' },
    ]
    expect(nextTask(P, ctxOf(tasks, [], chain))).toBeNull() // b waits for waiting a, c waits for b
    // Without links, b can start any time.
    expect(nextTask(P, ctxOf(tasks))?.id).toBe('b')
  })

  it('nextTask is null for empty, all-done, or unknown projects', () => {
    expect(nextTask(P, ctxOf([]))).toBeNull()
    expect(nextTask(P, ctxOf([task('a', { status: 'done' })]))).toBeNull()
    expect(nextTask('nope', ctxOf([task('a')]))).toBeNull()
  })

  it('nextTask honours milestone order', () => {
    const m = makeMilestone({ id: 'm1', projectId: P, name: 'm', position: 0 })
    const tasks = [
      task('inMs', { milestoneId: 'm1', position: 0 }),
      task('loose', { position: 99, status: 'done' }),
    ]
    expect(nextTask(P, ctxOf(tasks, [m]))?.id).toBe('inMs')
  })
})

describe('explicitBlockerIds / wouldCreateCycle', () => {
  const deps: Dependency[] = [
    { taskId: 'b', blockedByTaskId: 'a' },
    { taskId: 'c', blockedByTaskId: 'b' },
    { taskId: 'c', blockedByTaskId: 'z' },
  ]

  it('lists explicit blockers', () => {
    expect(explicitBlockerIds('c', deps)).toEqual(['b', 'z'])
    expect(explicitBlockerIds('a', deps)).toEqual([])
  })

  it('a self-dependency is a cycle', () => {
    expect(wouldCreateCycle('a', 'a', [])).toBe(true)
  })

  it('detects a direct cycle', () => {
    expect(wouldCreateCycle('a', 'b', deps)).toBe(true) // b already depends on a
  })

  it('detects a transitive cycle', () => {
    expect(wouldCreateCycle('a', 'c', deps)).toBe(true) // c -> b -> a
  })

  it('allows acyclic additions', () => {
    expect(wouldCreateCycle('a', 'z', deps)).toBe(false)
    expect(wouldCreateCycle('z', 'a', deps)).toBe(false)
    expect(wouldCreateCycle('b', 'z', deps)).toBe(false)
  })

  it('allows diamond shapes and an already existing edge', () => {
    const diamond: Dependency[] = [
      { taskId: 'b', blockedByTaskId: 'a' },
      { taskId: 'c', blockedByTaskId: 'a' },
      { taskId: 'd', blockedByTaskId: 'b' },
    ]
    expect(wouldCreateCycle('d', 'c', diamond)).toBe(false)
    expect(wouldCreateCycle('d', 'b', diamond)).toBe(false)
  })

  it('terminates on pre-existing cycles unrelated to the new edge', () => {
    const cyc: Dependency[] = [
      { taskId: 'x', blockedByTaskId: 'y' },
      { taskId: 'y', blockedByTaskId: 'x' },
    ]
    expect(wouldCreateCycle('a', 'x', cyc)).toBe(false)
  })

  it('works with an empty graph', () => {
    expect(wouldCreateCycle('a', 'b', [])).toBe(false)
  })
})

describe('workstreams', () => {
  const m1 = makeMilestone({ id: 'm1', projectId: P, name: 'Design', position: 1 })
  const m2 = makeMilestone({ id: 'm2', projectId: P, name: 'Build', position: 0 })
  const empty = makeMilestone({ id: 'm3', projectId: P, name: 'Launch', position: 2 })

  it('groups tasks by stream: loose first, then streams by position (empty ones included)', () => {
    const tasks = [task('loose'), task('d1', { milestoneId: 'm1' }), task('b1', { milestoneId: 'm2' })]
    const streams = projectWorkstreams(P, ctxOf(tasks, [m1, m2, empty]))
    expect(streams.map((w) => [w.id, ids(w.tasks)])).toEqual([
      [null, ['loose']],
      ['m2', ['b1']],
      ['m1', ['d1']],
      ['m3', []],
    ])
    expect(projectWorkstreams(P, ctxOf([task('d1', { milestoneId: 'm1' })], [m1]))[0]!.id).toBe('m1')
  })

  it('has one next step per stream', () => {
    const tasks = [
      task('d1', { milestoneId: 'm1', status: 'done' }),
      task('d2', { milestoneId: 'm1', position: 1 }),
      task('b1', { milestoneId: 'm2', status: 'waiting' }),
      task('b2', { milestoneId: 'm2', position: 1 }),
    ]
    const deps: Dependency[] = [{ taskId: 'b2', blockedByTaskId: 'b1' }]
    const ctx = ctxOf(tasks, [m1, m2], deps)
    // Build's b2 waits for the waiting b1, so only Design has a next step.
    expect(ids(nextTasks(P, ctx))).toEqual(['d2'])
    const ctx2 = ctxOf([...tasks, task('loose')], [m1, m2], deps)
    expect(ids(nextTasks(P, ctx2))).toEqual(['loose', 'd2'])
    expect(nextTask(P, ctx2)?.id).toBe('loose')
  })
})

describe('substreams', () => {
  const brand = makeMilestone({ id: 'brand', projectId: P, name: 'Brand', position: 0 })
  const build = makeMilestone({ id: 'build', projectId: P, name: 'Build', position: 1 })
  const social = makeMilestone({ id: 'social', projectId: P, parentId: 'brand', name: 'Social', position: 1 })
  const web = makeMilestone({ id: 'web', projectId: P, parentId: 'brand', name: 'Website', position: 0 })
  const all = [social, build, web, brand]

  it('nests substreams under their workstream, each level by position', () => {
    expect(streamTree(P, all).map((n) => [n.milestone.id, n.substreams.map((s) => s.id)])).toEqual([
      ['brand', ['web', 'social']],
      ['build', []],
    ])
    expect(orderedMilestones(P, all).map((m) => m.id)).toEqual(['brand', 'web', 'social', 'build'])
    expect(streamLabel(web, all)).toBe('Brand › Website')
    expect(streamLabel(brand, all)).toBe('Brand')
  })

  it('treats a milestone with a missing or nested parent as a workstream', () => {
    const orphan = makeMilestone({ id: 'orphan', projectId: P, parentId: 'gone', name: 'O', position: 2 })
    const deep = makeMilestone({ id: 'deep', projectId: P, parentId: 'web', name: 'D', position: 3 })
    expect(streamTree(P, [...all, orphan, deep]).map((n) => n.milestone.id)).toEqual([
      'brand',
      'build',
      'orphan',
      'deep',
    ])
  })

  it("orders tasks: a workstream's own tasks, then its substreams'; each substream has its own next step", () => {
    const tasks = [
      task('w1', { milestoneId: 'web' }),
      task('b1', { milestoneId: 'brand' }),
      task('s1', { milestoneId: 'social' }),
      task('w2', { milestoneId: 'web', position: 1 }),
      task('x1', { milestoneId: 'build' }),
    ]
    expect(ids(orderedProjectTasks(P, all, tasks))).toEqual(['b1', 'w1', 'w2', 's1', 'x1'])
    expect(projectWorkstreams(P, ctxOf(tasks, all)).map((w) => w.id)).toEqual([
      'brand',
      'web',
      'social',
      'build',
    ])
    expect(ids(nextTasks(P, ctxOf(tasks, all)))).toEqual(['b1', 'w1', 's1', 'x1'])
  })
})
