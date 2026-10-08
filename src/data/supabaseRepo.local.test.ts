/**
 * Runs supabaseRepo against a real PostgREST + Postgres with supabase/migrations applied (see
 * supabase/local/README.md). Skipped unless SUPABASE_LOCAL_URL points at that stack.
 */
import { createClient } from '@supabase/supabase-js'
import { beforeAll, describe, expect, it } from 'vitest'
import { makeChecklistItem, makeMilestone, makeProject, makeTask } from '../domain/factories'
import type { Snapshot, Task } from '../domain/types'
import { applyChange, type Change } from './changes'
import type { Repo } from './repo'
import { seedSnapshot } from './seed'
import { createSupabaseAuth, createSupabaseRepo } from './supabaseRepo'

const env = import.meta.env as Record<string, string | undefined>
const URL = env.SUPABASE_LOCAL_URL
const JWT_SECRET = env.SUPABASE_LOCAL_JWT_SECRET ?? 'super-secret-jwt-token-with-at-least-32-characters-long'

const base64url = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

/** An anon-role JWT signed with the stack's secret (what Supabase calls the anon key). */
async function anonKey(): Promise<string> {
  const enc = new TextEncoder()
  const part = (o: object): string => base64url(enc.encode(JSON.stringify(o)))
  const body = `${part({ alg: 'HS256', typ: 'JWT' })}.${part({ role: 'anon', iss: 'supabase', exp: 4102444800 })}`
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(JWT_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  return `${body}.${base64url(new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(body))))}`
}

async function signedInRepo(email: string): Promise<Repo> {
  const client = createClient(URL!, await anonKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  await createSupabaseAuth(client).signIn(email, 'pw')
  return createSupabaseRepo(client)
}

/** Order-independent view of a snapshot, for comparing the database against applyChange. */
function sorted(s: Snapshot): Snapshot {
  const byId = <T extends { id: string }>(xs: T[]): T[] => [...xs].sort((a, b) => a.id.localeCompare(b.id))
  return {
    ...s,
    projects: byId(s.projects),
    milestones: byId(s.milestones),
    tasks: byId(s.tasks),
    checklist: byId(s.checklist),
    templates: byId(s.templates),
    resources: byId(s.resources).map((r) => ({ ...r, workstreamIds: [...r.workstreamIds].sort() })),
    dependencies: [...s.dependencies].sort((a, b) =>
      `${a.taskId}${a.blockedByTaskId}`.localeCompare(`${b.taskId}${b.blockedByTaskId}`),
    ),
    weeks: [...s.weeks].sort((a, b) => a.weekStart.localeCompare(b.weekStart)),
  }
}

describe.skipIf(!URL)('supabaseRepo against a local Supabase stack', () => {
  let a: Repo
  let expected: Snapshot

  /** Applies a change to the database and to the expected snapshot, then checks they still agree. */
  async function step(change: Change): Promise<void> {
    await a.apply(change)
    expected = applyChange(expected, change)
    expect(sorted(await a.loadSnapshot())).toEqual(sorted(expected))
  }

  beforeAll(async () => {
    a = await signedInRepo('a@x.com')
  })

  it('creates default settings and exactly one system project on first load', async () => {
    const [first, concurrent] = await Promise.all([a.loadSnapshot(), a.loadSnapshot()])
    const again = await a.loadSnapshot()
    for (const s of [first, concurrent, again]) expect(s.projects.filter((p) => p.isSystem)).toHaveLength(1)
    expect(again.projects.find((p) => p.isSystem)!.id).toBe(first.projects.find((p) => p.isSystem)!.id)
    expect(again.settings).toEqual(first.settings)
    expected = again
  })

  it('round-trips the demo data', async () => {
    const seed = seedSnapshot('2026-10-08')
    const seedSystem = seed.projects.find((p) => p.isSystem)!
    const system = expected.projects.find((p) => p.isSystem)!
    const tasks = seed.tasks.map((t) => (t.projectId === seedSystem.id ? { ...t, projectId: system.id } : t))
    await step({
      kind: 'insertBundle',
      bundle: {
        projects: seed.projects.filter((p) => !p.isSystem),
        milestones: seed.milestones,
        tasks,
        dependencies: seed.dependencies,
        checklist: seed.checklist,
      },
    })
    for (const template of seed.templates) await step({ kind: 'saveTemplate', template })
    await step({ kind: 'saveResources', resources: seed.resources })
    await step({
      kind: 'saveWeek',
      week: { weekStart: '2026-10-05', capacityOverride: 12.5, reviewedAt: null },
    })
    await step({
      kind: 'saveWeek',
      week: { weekStart: '2026-10-05', capacityOverride: null, reviewedAt: '2026-10-08T09:30:00.000Z' },
    })
    await step({
      kind: 'saveSettings',
      settings: { ...expected.settings, focusFactor: 0.5, gcalCalendarId: 'cal@group.calendar.google.com' },
    })
  })

  it('applies updates, dependency changes and cascading deletes', async () => {
    const [t1, t2, t3] = expected.tasks.filter((t) => t.projectId && t.status === 'todo') as [
      Task,
      Task,
      Task,
    ]
    await step({
      kind: 'saveTasks',
      tasks: [{ ...t1, title: 'Renamed', completedAt: '2026-10-08T10:00:00.000Z' }],
    })
    await step({ kind: 'setDependencies', taskId: t1.id, blockedByIds: [t2.id, t3.id] })
    await step({ kind: 'setDependencies', taskId: t1.id, blockedByIds: [t3.id] })
    await step({ kind: 'setDependencies', taskId: t1.id, blockedByIds: [] })

    const item = makeChecklistItem({ taskId: t2.id, text: 'Check' })
    await step({ kind: 'saveChecklist', items: [item] })
    await step({ kind: 'saveChecklist', items: [{ ...item, done: true }] })
    await step({ kind: 'deleteChecklistItem', id: item.id })
    await step({ kind: 'deleteTask', id: t2.id })

    const linked = expected.resources.find((r) => r.workstreamIds.length > 0)!
    await step({ kind: 'deleteMilestone', id: linked.workstreamIds[0]! })
    await step({ kind: 'deleteResource', id: expected.resources[0]!.id })
    await step({ kind: 'deleteTemplate', id: expected.templates[0]!.id })
    await step({ kind: 'deleteProject', id: linked.projectId })

    // A workstream with substreams: add one more, then delete the workstream (substreams and tasks cascade).
    const parent = expected.milestones.find((m) => m.name === 'Design and ordering')!
    const extra = makeMilestone({
      projectId: parent.projectId,
      parentId: parent.id,
      name: 'Lighting',
      position: 2,
    })
    await step({ kind: 'saveMilestones', milestones: [extra] })
    await step({ kind: 'deleteMilestone', id: parent.id })
  })

  it('creates new entities with client-side ids and timestamps', async () => {
    const project = makeProject({ name: 'New' })
    const milestone = makeMilestone({ projectId: project.id, name: 'Stream' })
    await step({ kind: 'saveProjects', projects: [project] })
    await step({ kind: 'saveMilestones', milestones: [milestone] })
    await step({
      kind: 'saveTasks',
      tasks: [
        makeTask({ title: 'Inbox item' }),
        makeTask({ title: 'In stream', projectId: project.id, milestoneId: milestone.id }),
      ],
    })
  })

  it('refuses to delete the system project', async () => {
    const system = expected.projects.find((p) => p.isSystem)!
    await expect(a.apply({ kind: 'deleteProject', id: system.id })).rejects.toThrow(/system project/)
  })

  it('loads more rows than one page', async () => {
    const many: Task[] = Array.from({ length: 2100 }, (_, i) => makeTask({ title: `Bulk ${i}` }))
    await a.apply({ kind: 'saveTasks', tasks: many })
    expected = applyChange(expected, { kind: 'saveTasks', tasks: many })
    expect((await a.loadSnapshot()).tasks).toHaveLength(expected.tasks.length)
  })

  it("keeps each user's rows private", async () => {
    const b = await signedInRepo('b@x.com')
    const theirs = await b.loadSnapshot()
    const ids = new Set(expected.tasks.map((t) => t.id))
    expect(theirs.tasks.filter((t) => ids.has(t.id))).toHaveLength(0)
    expect(theirs.projects.filter((p) => p.isSystem)).toHaveLength(1)

    const victim = expected.tasks[0]!
    await expect(b.apply({ kind: 'saveTasks', tasks: [{ ...victim, title: 'Hijacked' }] })).rejects.toThrow()
    await b.apply({ kind: 'deleteTask', id: victim.id })
    const mine = await a.loadSnapshot()
    expect(mine.tasks.find((t) => t.id === victim.id)?.title).toBe(victim.title)
  })
})
