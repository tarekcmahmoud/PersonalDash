import {
  makeChecklistItem,
  makeMilestone,
  makeProject,
  makeResource,
  makeTask,
  makeTemplate,
} from '../domain/factories'
import { DEFAULT_SETTINGS, type Snapshot, type WeekMeta } from '../domain/types'
import { applyChange, type Change } from './changes'

const emptySnap = (over: Partial<Snapshot> = {}): Snapshot => ({
  projects: [],
  milestones: [],
  tasks: [],
  dependencies: [],
  checklist: [],
  templates: [],
  weeks: [],
  resources: [],
  settings: structuredClone(DEFAULT_SETTINGS),
  ...over,
})

const ids = (items: { id: string }[]): string[] => items.map((i) => i.id).sort()

/**
 * Fixture graph with explicit ids:
 *   sys  (system project)      t4 (sys, no milestone)  c3 -> t4
 *   p1   (project)  m1 -> t1 (milestone m1), t2 (no milestone)   c1 -> t1
 *   p2   (project)  m2 -> t3 (milestone m2)                      c2 -> t3
 *   deps: t2 blocked by t1, t3 blocked by t2 (cross-milestone), t4 blocked by t3
 */
function fixture(): Snapshot {
  const sys = makeProject({ id: 'sys', name: 'Admin / Misc', isSystem: true, outcome: 'Ongoing' })
  const p1 = makeProject({ id: 'p1', name: 'Project one', outcome: 'Done', targetDate: '2026-12-01' })
  const p2 = makeProject({ id: 'p2', name: 'Project two', outcome: 'Done', targetDate: '2026-12-31' })
  const m1 = makeMilestone({ id: 'm1', projectId: 'p1', name: 'Alpha' })
  const m2 = makeMilestone({ id: 'm2', projectId: 'p2', name: 'Beta' })
  const t1 = makeTask({ id: 't1', projectId: 'p1', milestoneId: 'm1', title: 'Task one' })
  const t2 = makeTask({ id: 't2', projectId: 'p1', title: 'Task two' })
  const t3 = makeTask({ id: 't3', projectId: 'p2', milestoneId: 'm2', title: 'Task three' })
  const t4 = makeTask({ id: 't4', projectId: 'sys', title: 'Task four' })
  return emptySnap({
    projects: [sys, p1, p2],
    milestones: [m1, m2],
    tasks: [t1, t2, t3, t4],
    dependencies: [
      { taskId: 't2', blockedByTaskId: 't1' },
      { taskId: 't3', blockedByTaskId: 't2' },
      { taskId: 't4', blockedByTaskId: 't3' },
    ],
    checklist: [
      makeChecklistItem({ id: 'c1', taskId: 't1', text: 'one' }),
      makeChecklistItem({ id: 'c2', taskId: 't3', text: 'three' }),
      makeChecklistItem({ id: 'c3', taskId: 't4', text: 'four' }),
    ],
    templates: [makeTemplate({ id: 'tpl1', name: 'Old', outline: '# Old' })],
    weeks: [{ weekStart: '2026-10-05', capacityOverride: null, reviewedAt: null }],
  })
}

describe('applyChange', () => {
  describe('upserts', () => {
    it('saveProjects replaces an existing project by id and appends new ones', () => {
      const s = fixture()
      const renamed = { ...s.projects[1]!, name: 'Renamed' }
      const created = makeProject({ id: 'p3', name: 'New' })
      const next = applyChange(s, { kind: 'saveProjects', projects: [renamed, created] })
      expect(next.projects.map((p) => [p.id, p.name])).toEqual([
        ['sys', 'Admin / Misc'],
        ['p1', 'Renamed'],
        ['p2', 'Project two'],
        ['p3', 'New'],
      ])
    })

    it('saveMilestones replaces by id and appends new milestones', () => {
      const s = fixture()
      const next = applyChange(s, {
        kind: 'saveMilestones',
        milestones: [
          { ...s.milestones[0]!, name: 'Alpha v2' },
          makeMilestone({ id: 'm3', projectId: 'p2', name: 'Gamma' }),
        ],
      })
      expect(next.milestones.map((m) => [m.id, m.name])).toEqual([
        ['m1', 'Alpha v2'],
        ['m2', 'Beta'],
        ['m3', 'Gamma'],
      ])
    })

    it('saveTasks replaces by id and appends new tasks', () => {
      const s = fixture()
      const next = applyChange(s, {
        kind: 'saveTasks',
        tasks: [
          { ...s.tasks[0]!, title: 'Task one, edited', status: 'done' },
          makeTask({ id: 't9', projectId: 'p2', title: 'Brand new' }),
        ],
      })
      expect(next.tasks.map((t) => [t.id, t.title])).toEqual([
        ['t1', 'Task one, edited'],
        ['t2', 'Task two'],
        ['t3', 'Task three'],
        ['t4', 'Task four'],
        ['t9', 'Brand new'],
      ])
      expect(next.tasks[0]!.status).toBe('done')
    })

    it('saveChecklist replaces by id and appends new items', () => {
      const s = fixture()
      const next = applyChange(s, {
        kind: 'saveChecklist',
        items: [
          { ...s.checklist[0]!, done: true },
          makeChecklistItem({ id: 'c9', taskId: 't2', text: 'new' }),
        ],
      })
      expect(next.checklist.map((c) => [c.id, c.done])).toEqual([
        ['c1', true],
        ['c2', false],
        ['c3', false],
        ['c9', false],
      ])
    })

    it('saveTemplate replaces by id', () => {
      const s = fixture()
      const next = applyChange(s, {
        kind: 'saveTemplate',
        template: makeTemplate({ id: 'tpl1', name: 'Renamed', outline: '# Renamed' }),
      })
      expect(next.templates).toHaveLength(1)
      expect(next.templates[0]).toMatchObject({ id: 'tpl1', name: 'Renamed' })
    })

    it('saveWeek upserts by weekStart', () => {
      const s = fixture()
      const updated: WeekMeta = { weekStart: '2026-10-05', capacityOverride: 12, reviewedAt: null }
      const added: WeekMeta = { weekStart: '2026-10-12', capacityOverride: null, reviewedAt: null }
      const next = applyChange(s, { kind: 'saveWeek', week: updated })
      expect(next.weeks).toEqual([updated])
      const next2 = applyChange(next, { kind: 'saveWeek', week: added })
      expect(next2.weeks.map((w) => w.weekStart)).toEqual(['2026-10-05', '2026-10-12'])
    })

    it('saveSettings replaces the settings', () => {
      const s = fixture()
      const settings = { ...s.settings, focusFactor: 0.5, activeCap: 3 }
      const next = applyChange(s, { kind: 'saveSettings', settings })
      expect(next.settings).toEqual(settings)
      expect(next.projects).toBe(s.projects)
    })
  })

  describe('deletes', () => {
    it('deleteProject cascades to milestones, tasks, checklist and dependencies', () => {
      const s = fixture()
      const next = applyChange(s, { kind: 'deleteProject', id: 'p1' })
      expect(ids(next.projects)).toEqual(['p2', 'sys'])
      expect(ids(next.milestones)).toEqual(['m2'])
      expect(ids(next.tasks)).toEqual(['t3', 't4'])
      expect(next.checklist.map((c) => c.id).sort()).toEqual(['c2', 'c3'])
      // t2 -> t1 and t3 -> t2 both touch deleted tasks; t4 -> t3 survives.
      expect(next.dependencies).toEqual([{ taskId: 't4', blockedByTaskId: 't3' }])
    })

    it('deleteProject leaves a system project untouched', () => {
      const s = fixture()
      const before = structuredClone(s)
      const next = applyChange(s, { kind: 'deleteProject', id: 'sys' })
      expect(next).toBe(s)
      expect(next).toEqual(before)
    })

    it('deleteMilestone removes the milestone, its tasks, checklist and dependencies', () => {
      const s = fixture()
      const next = applyChange(s, { kind: 'deleteMilestone', id: 'm2' })
      expect(ids(next.milestones)).toEqual(['m1'])
      expect(ids(next.tasks)).toEqual(['t1', 't2', 't4'])
      expect(next.checklist.map((c) => c.id).sort()).toEqual(['c1', 'c3'])
      expect(next.dependencies).toEqual([{ taskId: 't2', blockedByTaskId: 't1' }])
      expect(ids(next.projects)).toEqual(['p1', 'p2', 'sys'])
    })

    it("deleteMilestone takes the workstream's substreams and their tasks with it", () => {
      const s = fixture()
      const sub = makeMilestone({
        id: 'm2-sub',
        projectId: s.milestones[1]!.projectId,
        parentId: 'm2',
        name: 'Sub',
      })
      const subTask = makeTask({
        id: 't-sub',
        title: 'In sub',
        projectId: sub.projectId,
        milestoneId: 'm2-sub',
      })
      const withSub = {
        ...s,
        milestones: [...s.milestones, sub],
        tasks: [...s.tasks, subTask],
        resources: [
          makeResource({ projectId: sub.projectId, url: 'https://a.test', workstreamIds: ['m2-sub'] }),
        ],
      }
      const next = applyChange(withSub, { kind: 'deleteMilestone', id: 'm2' })
      expect(ids(next.milestones)).toEqual(['m1'])
      expect(next.tasks.some((t) => t.id === 't-sub')).toBe(false)
      expect(next.resources[0]!.workstreamIds).toEqual([])
      // Deleting only the substream keeps the workstream.
      const onlySub = applyChange(withSub, { kind: 'deleteMilestone', id: 'm2-sub' })
      expect(ids(onlySub.milestones)).toEqual(['m1', 'm2'])
    })

    it('deleteTask removes the task, its checklist and dependencies on either side', () => {
      const s = fixture()
      const next = applyChange(s, { kind: 'deleteTask', id: 't2' })
      expect(ids(next.tasks)).toEqual(['t1', 't3', 't4'])
      expect(next.checklist.map((c) => c.id).sort()).toEqual(['c1', 'c2', 'c3'])
      // t2 was both blocked-by-t1 (taskId side) and blocking t3 (blockedBy side): both gone.
      expect(next.dependencies).toEqual([{ taskId: 't4', blockedByTaskId: 't3' }])
    })

    it('deleteChecklistItem removes only that item', () => {
      const s = fixture()
      const next = applyChange(s, { kind: 'deleteChecklistItem', id: 'c2' })
      expect(next.checklist.map((c) => c.id)).toEqual(['c1', 'c3'])
      expect(ids(next.tasks)).toEqual(ids(s.tasks))
    })

    it('deleteTemplate removes the template by id', () => {
      const s = fixture()
      expect(applyChange(s, { kind: 'deleteTemplate', id: 'tpl1' }).templates).toEqual([])
      expect(applyChange(s, { kind: 'deleteTemplate', id: 'nope' }).templates).toHaveLength(1)
    })
  })

  describe('dependencies', () => {
    it('setDependencies replaces all blockers of the task and keeps other tasks links', () => {
      const s = fixture()
      const next = applyChange(s, { kind: 'setDependencies', taskId: 't3', blockedByIds: ['t1', 't4'] })
      expect(next.dependencies).toEqual([
        { taskId: 't2', blockedByTaskId: 't1' },
        { taskId: 't4', blockedByTaskId: 't3' },
        { taskId: 't3', blockedByTaskId: 't1' },
        { taskId: 't3', blockedByTaskId: 't4' },
      ])
    })

    it('setDependencies with an empty list clears the blockers of the task', () => {
      const s = fixture()
      const next = applyChange(s, { kind: 'setDependencies', taskId: 't2', blockedByIds: [] })
      expect(next.dependencies).toEqual([
        { taskId: 't3', blockedByTaskId: 't2' },
        { taskId: 't4', blockedByTaskId: 't3' },
      ])
    })
  })

  describe('insertBundle', () => {
    it('appends every entity from the bundle', () => {
      const s = fixture()
      const change: Change = {
        kind: 'insertBundle',
        bundle: {
          projects: [makeProject({ id: 'p3', name: 'Imported' })],
          milestones: [makeMilestone({ id: 'm3', projectId: 'p3', name: 'Start' })],
          tasks: [makeTask({ id: 't5', projectId: 'p3', milestoneId: 'm3', title: 'Imported task' })],
          dependencies: [{ taskId: 't5', blockedByTaskId: 't1' }],
          checklist: [makeChecklistItem({ id: 'c5', taskId: 't5', text: 'step' })],
        },
      }
      const next = applyChange(s, change)
      expect(ids(next.projects)).toEqual(['p1', 'p2', 'p3', 'sys'])
      expect(ids(next.milestones)).toEqual(['m1', 'm2', 'm3'])
      expect(ids(next.tasks)).toEqual(['t1', 't2', 't3', 't4', 't5'])
      expect(next.dependencies).toHaveLength(4)
      expect(next.dependencies).toContainEqual({ taskId: 't5', blockedByTaskId: 't1' })
      expect(next.checklist.map((c) => c.id).sort()).toEqual(['c1', 'c2', 'c3', 'c5'])
    })
  })

  it('never mutates the input snapshot', () => {
    const s = fixture()
    const before = structuredClone(s)
    const changes: Change[] = [
      { kind: 'saveProjects', projects: [{ ...s.projects[1]!, name: 'X' }] },
      { kind: 'deleteProject', id: 'p1' },
      { kind: 'deleteMilestone', id: 'm1' },
      { kind: 'deleteTask', id: 't3' },
      { kind: 'setDependencies', taskId: 't2', blockedByIds: [] },
      { kind: 'saveTasks', tasks: [{ ...s.tasks[0]!, title: 'changed' }] },
      { kind: 'saveSettings', settings: { ...s.settings, focusFactor: 0.1 } },
      { kind: 'deleteTemplate', id: 'tpl1' },
    ]
    for (const change of changes) applyChange(s, change)
    expect(s).toEqual(before)
    expect(s.tasks[0]!.title).toBe('Task one')
  })
})

describe('resources', () => {
  it('saves, deletes, and cascades with projects and workstreams', async () => {
    const { makeResource } = await import('../domain/factories')
    const project = makeProject({ name: 'P' })
    const ws1 = makeMilestone({ projectId: project.id, name: 'Design' })
    const ws2 = makeMilestone({ projectId: project.id, name: 'Build' })
    const r1 = makeResource({
      projectId: project.id,
      url: 'https://a.example',
      workstreamIds: [ws1.id, ws2.id],
    })
    const r2 = makeResource({ projectId: project.id, url: 'https://b.example' })
    let s = emptySnap({ projects: [project], milestones: [ws1, ws2] })

    s = applyChange(s, { kind: 'saveResources', resources: [r1, r2] })
    expect(s.resources.map((r) => r.url)).toEqual(['https://a.example', 'https://b.example'])
    s = applyChange(s, { kind: 'saveResources', resources: [{ ...r2, title: 'B' }] })
    expect(s.resources.find((r) => r.id === r2.id)?.title).toBe('B')

    // Deleting a workstream unlinks it from resources (the resource stays).
    s = applyChange(s, { kind: 'deleteMilestone', id: ws1.id })
    expect(s.resources.find((r) => r.id === r1.id)?.workstreamIds).toEqual([ws2.id])

    s = applyChange(s, { kind: 'deleteResource', id: r2.id })
    expect(s.resources.map((r) => r.id)).toEqual([r1.id])

    // Deleting the project removes its resources.
    s = applyChange(s, { kind: 'deleteProject', id: project.id })
    expect(s.resources).toEqual([])
  })
})
