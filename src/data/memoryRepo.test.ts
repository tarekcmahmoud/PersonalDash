import { makeProject, makeTask } from '../domain/factories'
import { DEFAULT_SETTINGS, type Snapshot } from '../domain/types'
import { createMemoryAuth, createMemoryRepo } from './memoryRepo'
import { emptySnapshot } from './seed'

const withProject = (): Snapshot => {
  const s = emptySnapshot()
  return { ...s, projects: [...s.projects, makeProject({ id: 'p1', name: 'Alpha', outcome: 'Done' })] }
}

describe('createMemoryRepo', () => {
  it('starts from the seeded demo data when no initial snapshot is given', async () => {
    const snap = await createMemoryRepo().loadSnapshot()
    expect(snap.projects.length).toBeGreaterThan(1)
    expect(snap.projects.filter((p) => p.isSystem)).toHaveLength(1)
  })

  it('loadSnapshot returns a copy: mutating it does not affect the repo', async () => {
    const repo = createMemoryRepo(withProject())
    const first = await repo.loadSnapshot()
    first.projects.push(makeProject({ name: 'Sneaky' }))
    first.projects[1]!.name = 'Renamed locally'
    first.settings.focusFactor = 0.1

    const second = await repo.loadSnapshot()
    expect(second.projects.map((p) => p.name)).toEqual(['Admin / Misc', 'Alpha'])
    expect(second.settings).toEqual(DEFAULT_SETTINGS)
  })

  it('apply persists changes for later loads', async () => {
    const repo = createMemoryRepo(emptySnapshot())
    const project = makeProject({ id: 'p1', name: 'Alpha', outcome: 'Done' })
    const task = makeTask({ id: 't1', projectId: 'p1', title: 'First' })

    await repo.apply({ kind: 'saveProjects', projects: [project] })
    await repo.apply({ kind: 'saveTasks', tasks: [task] })

    const snap = await repo.loadSnapshot()
    expect(snap.projects.map((p) => p.id)).toEqual(expect.arrayContaining(['p1']))
    expect(snap.tasks.map((t) => t.title)).toEqual(['First'])

    await repo.apply({ kind: 'deleteProject', id: 'p1' })
    const after = await repo.loadSnapshot()
    expect(after.projects.map((p) => p.id)).not.toContain('p1')
    expect(after.tasks).toEqual([])
  })

  it('works with a latency configured', async () => {
    const repo = createMemoryRepo(emptySnapshot(), { latencyMs: 5 })
    await repo.apply({ kind: 'saveProjects', projects: [makeProject({ name: 'Slow', outcome: 'x' })] })
    const snap = await repo.loadSnapshot()
    expect(snap.projects.map((p) => p.name)).toContain('Slow')
  })
})

describe('createMemoryAuth', () => {
  it('starts signed in as the local user', async () => {
    const auth = createMemoryAuth()
    expect(await auth.currentUser()).toEqual({ id: 'local', email: 'you@local' })
  })

  it('signOut clears the user and notifies listeners; signIn restores it', async () => {
    const auth = createMemoryAuth()
    const seen: (string | null)[] = []
    auth.onChange((user) => seen.push(user?.id ?? null))

    await auth.signOut()
    expect(await auth.currentUser()).toBeNull()
    expect(seen).toEqual([null])

    await auth.signIn('you@local', 'anything')
    expect(await auth.currentUser()).toEqual({ id: 'local', email: 'you@local' })
    expect(seen).toEqual([null, 'local'])
  })

  it('passes the user to listeners on sign-in and sign-out', async () => {
    const auth = createMemoryAuth()
    const cb = vi.fn()
    auth.onChange(cb)
    await auth.signOut()
    expect(cb).toHaveBeenLastCalledWith(null)
    await auth.signIn('a', 'b')
    expect(cb).toHaveBeenLastCalledWith({ id: 'local', email: 'you@local' })
  })

  it('unsubscribe stops notifications', async () => {
    const auth = createMemoryAuth()
    const cb = vi.fn()
    const unsubscribe = auth.onChange(cb)
    unsubscribe()
    await auth.signOut()
    await auth.signIn('a', 'b')
    expect(cb).not.toHaveBeenCalled()
  })
})
