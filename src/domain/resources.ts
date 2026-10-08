import type { Resource, Task } from './types'

/** A resource and the tasks (from the input list) it is relevant to. */
export interface RelevantResource {
  resource: Resource
  tasks: Task[]
}

const byPosition = (a: Resource, b: Resource): number =>
  a.position - b.position || (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0)

/**
 * The resources that help with `tasks`: for each task in a project, the resources linked to the task's
 * workstream (its milestone), then the project-wide ones (no linked workstream), each by position. Inbox
 * tasks have none. Each resource appears once, at the first task that needs it, listing every task it helps.
 */
export function resourcesForTasks(tasks: Task[], resources: Resource[]): RelevantResource[] {
  const result = new Map<string, RelevantResource>()
  for (const task of tasks) {
    if (task.projectId === null) continue
    const inProject = resources.filter((r) => r.projectId === task.projectId)
    const linked = task.milestoneId
      ? inProject.filter((r) => r.workstreamIds.includes(task.milestoneId!)).sort(byPosition)
      : []
    const projectWide = inProject.filter((r) => r.workstreamIds.length === 0).sort(byPosition)
    for (const resource of [...linked, ...projectWide]) {
      const entry = result.get(resource.id)
      if (entry) entry.tasks.push(task)
      else result.set(resource.id, { resource, tasks: [task] })
    }
  }
  return [...result.values()]
}
