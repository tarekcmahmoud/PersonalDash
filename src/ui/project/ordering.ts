import type { ID, Milestone, Resource, Task, TaskSize } from '../../domain/types'
import { orderedProjectTasks } from '../../domain/order'

export interface TaskGroupData {
  /** null = the project's milestone-less group. */
  milestone: Milestone | null
  /** All tasks of the group (done included) in workflow order. */
  tasks: Task[]
}

/** Workflow groups of a project: milestone-less tasks first, then every milestone by position. */
export function projectGroups(projectId: ID, milestones: Milestone[], tasks: Task[]): TaskGroupData[] {
  const sortedMilestones = milestones
    .filter((m) => m.projectId === projectId)
    .sort((a, b) => a.position - b.position || (a.id < b.id ? -1 : 1))
  const known = new Set(sortedMilestones.map((m) => m.id))
  const ordered = orderedProjectTasks(projectId, milestones, tasks)
  return [
    { milestone: null, tasks: ordered.filter((t) => t.milestoneId === null || !known.has(t.milestoneId)) },
    ...sortedMilestones.map((m) => ({ milestone: m, tasks: ordered.filter((t) => t.milestoneId === m.id) })),
  ]
}

/** Tasks of one group (a project's milestone, its milestone-less group, or the Inbox) by position. */
export function groupTasks(tasks: Task[], projectId: ID | null, milestoneId: ID | null): Task[] {
  return tasks
    .filter((t) => t.projectId === projectId && t.milestoneId === milestoneId)
    .sort((a, b) => a.position - b.position)
}

/** Position that puts a new task at the end of a group. */
export function endPosition(tasks: Task[], projectId: ID | null, milestoneId: ID | null): number {
  const group = groupTasks(tasks, projectId, milestoneId)
  return group.length === 0 ? 0 : Math.max(...group.map((t) => t.position)) + 1
}

/**
 * After the open tasks of a group were reordered, return the tasks whose position changes. Done tasks keep
 * their slots in the group; the open tasks fill the remaining slots in their new order.
 */
export function renumberGroup(full: Task[], openInNewOrder: Task[]): Task[] {
  const openIds = new Set(openInNewOrder.map((t) => t.id))
  const queue = [...openInNewOrder]
  const result = full.map((t) => (openIds.has(t.id) ? queue.shift()! : t))
  const before = new Map(full.map((t) => [t.id, t.position]))
  return result.map((t, i) => ({ ...t, position: i })).filter((t) => t.position !== before.get(t.id))
}

/**
 * Moves an open `task` into another group (`milestoneId`; `target` = that group's tasks in order, done included),
 * before the open task `beforeId`, or after the last open task when it is null or not in the group. Returns the
 * tasks to save: the moved task (new milestoneId and position) and the target tasks whose position changed. The
 * group it left keeps its gaps, which ordering ignores.
 */
export function moveIntoGroup(
  target: Task[],
  task: Task,
  milestoneId: ID | null,
  beforeId: ID | null,
): Task[] {
  const moved = { ...task, milestoneId }
  const others = target.filter((t) => t.id !== task.id)
  const open = others.filter((t) => t.status !== 'done')
  const at = beforeId === null ? -1 : open.findIndex((t) => t.id === beforeId)
  const openInNewOrder = at === -1 ? [...open, moved] : [...open.slice(0, at), moved, ...open.slice(at)]
  const changed = renumberGroup([...others, moved], openInNewOrder)
  // Not in `changed` means its new slot equals its old position; it still moves group.
  return changed.some((t) => t.id === task.id) ? changed : [...changed, moved]
}

/** Items with `position = index`, only those whose position changed. */
export function renumber<T extends { id: ID; position: number }>(items: T[]): T[] {
  return items.map((item, i) => ({ ...item, position: i })).filter((_item, i) => items[i]!.position !== i)
}

export interface Subtask {
  title: string
  size: TaskSize
}

/** One subtask per line; an optional trailing [S]/[M]/[L] sets the size (default M). */
export function parseSubtasks(text: string): Subtask[] {
  const result: Subtask[] = []
  for (const raw of text.split('\n')) {
    let line = raw.trim().replace(/^[-*•]\s+/, '')
    let size: TaskSize = 'M'
    const tag = /\s*\[(S|M|L)\]\s*$/i.exec(line)
    if (tag) {
      size = tag[1]!.toUpperCase() as TaskSize
      line = line.slice(0, tag.index).trim()
    }
    if (line) result.push({ title: line, size })
  }
  return result
}

/** Resources of a project in grid order. */
export function sortedResources(resources: Resource[], projectId: ID): Resource[] {
  return resources
    .filter((r) => r.projectId === projectId)
    .sort((a, b) => a.position - b.position || (a.createdAt < b.createdAt ? -1 : 1))
}
