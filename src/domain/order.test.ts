import { makeMilestone, makeTask } from './factories'
import {
  explicitBlockerIds,
  isReady,
  nextTask,
  orderedProjectTasks,
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

describe('unfinishedBlockers (implicit rule)', () => {
  it('first task has no blockers', () => {
    const tasks = [task('a'), task('b', { position: 1 })]
    expect(unfinishedBlockers(tasks[0]!, ctxOf(tasks))).toEqual([])
  })

  it('a task is blocked by the task immediately before it', () => {
    const tasks = [task('a'), task('b', { position: 1 }), task('c', { position: 2 })]
    expect(ids(unfinishedBlockers(tasks[1]!, ctxOf(tasks)))).toEqual(['a'])
    expect(ids(unfinishedBlockers(tasks[2]!, ctxOf(tasks)))).toEqual(['b'])
  })

  it('a done predecessor does not block', () => {
    const tasks = [task('a', { status: 'done' }), task('b', { position: 1 })]
    expect(unfinishedBlockers(tasks[1]!, ctxOf(tasks))).toEqual([])
  })

  it('a waiting predecessor still blocks', () => {
    const tasks = [task('a', { status: 'waiting' }), task('b', { position: 1 })]
    expect(ids(unfinishedBlockers(tasks[1]!, ctxOf(tasks)))).toEqual(['a'])
  })

  it('predecessor is only the immediate one, regardless of its status', () => {
    // a (todo) -> b (done) -> c : c's only candidate predecessor is b, which is done.
    const tasks = [task('a'), task('b', { position: 1, status: 'done' }), task('c', { position: 2 })]
    expect(unfinishedBlockers(tasks[2]!, ctxOf(tasks))).toEqual([])
  })

  it('the predecessor crosses milestone boundaries', () => {
    const m = makeMilestone({ id: 'm1', projectId: P, name: 'm', position: 0 })
    const tasks = [task('loose'), task('inMs', { milestoneId: 'm1' })]
    expect(ids(unfinishedBlockers(tasks[1]!, ctxOf(tasks, [m])))).toEqual(['loose'])
  })

  it('inbox tasks have no implicit predecessor', () => {
    const a = task('a', { projectId: null })
    const b = task('b', { projectId: null, position: 1 })
    expect(unfinishedBlockers(b, ctxOf([a, b]))).toEqual([])
  })

  it('a task missing from the context has no blockers', () => {
    const stray = task('stray')
    expect(unfinishedBlockers(stray, ctxOf([task('a')]))).toEqual([])
  })
})

describe('unfinishedBlockers (explicit dependencies)', () => {
  it('explicit links replace the implicit rule', () => {
    const tasks = [task('a'), task('b', { position: 1 }), task('c', { position: 2 })]
    const deps: Dependency[] = [{ taskId: 'c', blockedByTaskId: 'a' }]
    // c is NOT blocked by b any more, only by a.
    expect(ids(unfinishedBlockers(tasks[2]!, ctxOf(tasks, [], deps)))).toEqual(['a'])
  })

  it('an explicit blocker that is done leaves the task unblocked (no fallback to implicit)', () => {
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
    const ctx = ctxOf(tasks)
    expect(isReady(tasks[0]!, ctx)).toBe(true)
    expect(isReady(tasks[1]!, ctx)).toBe(false) // blocked by a
    expect(isReady(tasks[2]!, ctx)).toBe(false) // not todo
    expect(isReady(tasks[3]!, ctx)).toBe(false) // done
  })

  it('isReady is true once the predecessor is done', () => {
    const tasks = [task('a', { status: 'done' }), task('b', { position: 1 })]
    expect(isReady(tasks[1]!, ctxOf(tasks))).toBe(true)
  })

  it('nextTask returns the first ready task in workflow order', () => {
    const tasks = [task('a', { status: 'done' }), task('b', { position: 1 }), task('c', { position: 2 })]
    expect(nextTask(P, ctxOf(tasks))?.id).toBe('b')
  })

  it('nextTask skips a blocked todo and finds a later ready one via explicit deps', () => {
    const tasks = [task('a', { status: 'waiting' }), task('b', { position: 1 }), task('c', { position: 2 })]
    expect(nextTask(P, ctxOf(tasks))).toBeNull() // b blocked by waiting a, c blocked by b
    const deps: Dependency[] = [{ taskId: 'c', blockedByTaskId: 'x-done' }]
    const withDone = [...tasks, task('x-done', { projectId: 'other', status: 'done' })]
    expect(nextTask(P, ctxOf(withDone, [], deps))?.id).toBe('c')
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
