import { describe, expect, it } from 'vitest'
import { makeResource, makeTask } from './factories'
import { resourcesForTasks } from './resources'

describe('resourcesForTasks', () => {
  const project = 'p1'
  const design = 'm-design'
  const build = 'm-build'
  const brand = makeResource({
    projectId: project,
    url: 'https://a.test',
    position: 1,
    workstreamIds: [design],
  })
  const mood = makeResource({
    projectId: project,
    url: 'https://b.test',
    position: 0,
    workstreamIds: [design, build],
  })
  const hosting = makeResource({
    projectId: project,
    url: 'https://c.test',
    position: 2,
    workstreamIds: [build],
  })
  const folder = makeResource({ projectId: project, url: 'https://d.test', position: 3, workstreamIds: [] })
  const other = makeResource({ projectId: 'p2', url: 'https://e.test', workstreamIds: [] })
  const all = [brand, mood, hosting, folder, other]

  it("returns the task's workstream resources by position, then the project-wide ones", () => {
    const task = makeTask({ title: 'Design homepage', projectId: project, milestoneId: design })
    expect(resourcesForTasks([task], all).map((r) => r.resource)).toEqual([mood, brand, folder])
  })

  it('gives a task outside any workstream only the project-wide resources', () => {
    const task = makeTask({ title: 'Loose', projectId: project })
    expect(resourcesForTasks([task], all).map((r) => r.resource)).toEqual([folder])
  })

  it('gives Inbox tasks nothing', () => {
    expect(resourcesForTasks([makeTask({ title: 'Inbox' })], all)).toEqual([])
  })

  it('lists a shared resource once, with every task it helps, in task order', () => {
    const a = makeTask({ title: 'A', projectId: project, milestoneId: design })
    const b = makeTask({ title: 'B', projectId: project, milestoneId: build })
    const result = resourcesForTasks([a, b], all)
    expect(result.map((r) => r.resource)).toEqual([mood, brand, folder, hosting])
    expect(result.find((r) => r.resource === mood)!.tasks).toEqual([a, b])
    expect(result.find((r) => r.resource === hosting)!.tasks).toEqual([b])
  })
})
