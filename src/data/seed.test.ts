import { DEFAULT_SETTINGS } from '../domain/types'
import { addWeeksISO, weekStartOf } from '../domain/week'
import { emptySnapshot, seedSnapshot } from './seed'

const TODAY = '2026-10-08'

describe('seedSnapshot', () => {
  const s = seedSnapshot(TODAY)
  const ws = weekStartOf(TODAY)

  it('has six projects, exactly one of them the system project', () => {
    expect(s.projects).toHaveLength(6)
    expect(s.projects.filter((p) => p.isSystem)).toHaveLength(1)
  })

  it('gives every non-system project an outcome and a target date', () => {
    for (const p of s.projects.filter((p) => !p.isSystem)) {
      expect(p.outcome.trim()).not.toBe('')
      expect(p.targetDate).not.toBeNull()
    }
  })

  it('has unique ids across entities', () => {
    const all = [...s.projects, ...s.milestones, ...s.tasks, ...s.checklist, ...s.templates].map((e) => e.id)
    expect(new Set(all).size).toBe(all.length)
  })

  it('references only existing entities', () => {
    const projectIds = new Set(s.projects.map((p) => p.id))
    const milestones = new Map(s.milestones.map((m) => [m.id, m]))
    const taskIds = new Set(s.tasks.map((t) => t.id))

    for (const m of s.milestones) expect(projectIds.has(m.projectId)).toBe(true)
    for (const t of s.tasks) {
      if (t.projectId !== null) expect(projectIds.has(t.projectId)).toBe(true)
      if (t.milestoneId !== null) {
        const milestone = milestones.get(t.milestoneId)
        expect(milestone).toBeDefined()
        expect(milestone?.projectId).toBe(t.projectId)
      }
    }
    for (const c of s.checklist) expect(taskIds.has(c.taskId)).toBe(true)
    for (const d of s.dependencies) {
      expect(taskIds.has(d.taskId)).toBe(true)
      expect(taskIds.has(d.blockedByTaskId)).toBe(true)
    }
  })

  it('has a task pinned to today and an XL task', () => {
    expect(s.tasks.some((t) => t.pinnedDay === TODAY)).toBe(true)
    expect(s.tasks.some((t) => t.size === 'XL')).toBe(true)
  })

  it('has exactly two Inbox tasks', () => {
    expect(s.tasks.filter((t) => t.projectId === null)).toHaveLength(2)
  })

  it('has a neglected project (nothing planned this week) and one below its weekly minimum', () => {
    const plannedIn = (projectId: string) =>
      s.tasks.filter((t) => t.projectId === projectId && t.weekStart === ws).length
    const active = s.projects.filter((p) => !p.isSystem && p.status === 'active')
    expect(active.some((p) => plannedIn(p.id) === 0)).toBe(true)
    const board = s.projects.find((p) => p.name === 'Quarterly board report')
    expect(board?.weeklyMin).toBe(2)
    expect(plannedIn(board!.id)).toBeLessThan(board!.weeklyMin!)
  })

  it('has one explicit dependency: the designer review waits for the job post', () => {
    expect(s.dependencies).toHaveLength(1)
    const [dep] = s.dependencies
    const byTitle = (title: string) => s.tasks.find((t) => t.title === title)
    expect(dep).toEqual({
      taskId: byTitle('Review applications and shortlist')?.id,
      blockedByTaskId: byTitle('Publish job post')?.id,
    })
  })

  it('has a waiting task with a follow-up date inside this week', () => {
    const waiting = s.tasks.filter((t) => t.status === 'waiting')
    expect(waiting).toHaveLength(1)
    expect(waiting[0]!.waitingOn).toBe('Finance team')
    expect(waiting[0]!.followUpDate! >= ws && waiting[0]!.followUpDate! <= addWeeksISO(ws, 1)).toBe(true)
  })

  it('has done tasks completed last week and tasks planned this week', () => {
    const done = s.tasks.filter((t) => t.status === 'done')
    expect(done.length).toBeGreaterThanOrEqual(3)
    for (const t of done) {
      expect(t.completedAt).not.toBeNull()
      expect(t.completedAt! >= addWeeksISO(ws, -1) && t.completedAt! < ws).toBe(true)
    }
    expect(s.tasks.some((t) => t.weekStart === ws)).toBe(true)
  })

  it('includes a checklist, a template and default settings, with no weeks', () => {
    expect(s.checklist.length).toBeGreaterThanOrEqual(3)
    expect(s.templates).toHaveLength(1)
    expect(s.templates[0]!.name).toBe('Client engagement')
    expect(s.templates[0]!.outline.startsWith('# Client engagement')).toBe(true)
    expect(s.settings).toEqual(DEFAULT_SETTINGS)
    expect(s.weeks).toEqual([])
  })

  it('returns a fresh snapshot each call', () => {
    const a = seedSnapshot(TODAY)
    const b = seedSnapshot(TODAY)
    expect(a.settings).not.toBe(b.settings)
    expect(a.projects[0]!.id).not.toBe(b.projects[0]!.id)
  })
})

describe('emptySnapshot', () => {
  it('has only the system project and default settings', () => {
    const s = emptySnapshot()
    expect(s.projects).toHaveLength(1)
    expect(s.projects[0]!.isSystem).toBe(true)
    expect(s.milestones).toEqual([])
    expect(s.tasks).toEqual([])
    expect(s.dependencies).toEqual([])
    expect(s.checklist).toEqual([])
    expect(s.templates).toEqual([])
    expect(s.weeks).toEqual([])
    expect(s.settings).toEqual(DEFAULT_SETTINGS)
    expect(s.settings).not.toBe(DEFAULT_SETTINGS)
  })
})
