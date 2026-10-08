import type {
  ChecklistItem,
  Dependency,
  EntityBundle,
  ID,
  Milestone,
  Project,
  Settings,
  Snapshot,
  Task,
  Template,
  WeekMeta,
} from '../domain/types'

/**
 * Every write the app makes, as data. The UI applies a Change optimistically to its cached Snapshot
 * (applyChange) and sends the same Change to the Repo, so both backends share one write vocabulary.
 * "save*" = upsert by id (whole entities). Deletes cascade as documented.
 */
export type Change =
  | { kind: 'saveProjects'; projects: Project[] }
  /** Cascades: milestones, tasks (and their checklist + dependencies). System projects are never deleted. */
  | { kind: 'deleteProject'; id: ID }
  | { kind: 'saveMilestones'; milestones: Milestone[] }
  /** Cascades: the milestone's tasks (and their checklist + dependencies). */
  | { kind: 'deleteMilestone'; id: ID }
  | { kind: 'saveTasks'; tasks: Task[] }
  /** Cascades: checklist items, and dependencies where the task is either side. */
  | { kind: 'deleteTask'; id: ID }
  /** Replaces all explicit blockers of taskId. */
  | { kind: 'setDependencies'; taskId: ID; blockedByIds: ID[] }
  | { kind: 'saveChecklist'; items: ChecklistItem[] }
  | { kind: 'deleteChecklistItem'; id: ID }
  | { kind: 'saveTemplate'; template: Template }
  | { kind: 'deleteTemplate'; id: ID }
  /** Upsert by weekStart. */
  | { kind: 'saveWeek'; week: WeekMeta }
  | { kind: 'saveSettings'; settings: Settings }
  /** Insert new entities (outline import / new from template). */
  | { kind: 'insertBundle'; bundle: EntityBundle }

/** Replace items that share a key with an existing entry; append the rest in input order. */
function upsertBy<T>(list: readonly T[], items: readonly T[], keyOf: (item: T) => string): T[] {
  const incoming = new Map<string, T>()
  for (const item of items) incoming.set(keyOf(item), item)
  const seen = new Set<string>()
  const replaced = list.map((item) => {
    const key = keyOf(item)
    seen.add(key)
    return incoming.get(key) ?? item
  })
  const appended = [...incoming].filter(([key]) => !seen.has(key)).map(([, item]) => item)
  return [...replaced, ...appended]
}

const idsOf = (items: readonly { id: string }[]): Set<ID> => new Set(items.map((item) => item.id))

/** Removes tasks plus everything hanging off them: checklist items and dependencies on either side. */
function dropTasks(snapshot: Snapshot, taskIds: ReadonlySet<ID>): Snapshot {
  return {
    ...snapshot,
    tasks: snapshot.tasks.filter((t) => !taskIds.has(t.id)),
    checklist: snapshot.checklist.filter((c) => !taskIds.has(c.taskId)),
    dependencies: snapshot.dependencies.filter(
      (d) => !taskIds.has(d.taskId) && !taskIds.has(d.blockedByTaskId),
    ),
  }
}

/** Pure: returns a new Snapshot with the change applied (never mutates the input). */
export function applyChange(snapshot: Snapshot, change: Change): Snapshot {
  switch (change.kind) {
    case 'saveProjects':
      return { ...snapshot, projects: upsertBy(snapshot.projects, change.projects, (p) => p.id) }

    case 'deleteProject': {
      const project = snapshot.projects.find((p) => p.id === change.id)
      if (project?.isSystem) return snapshot
      const taskIds = idsOf(snapshot.tasks.filter((t) => t.projectId === change.id))
      return dropTasks(
        {
          ...snapshot,
          projects: snapshot.projects.filter((p) => p.id !== change.id),
          milestones: snapshot.milestones.filter((m) => m.projectId !== change.id),
        },
        taskIds,
      )
    }

    case 'saveMilestones':
      return {
        ...snapshot,
        milestones: upsertBy(snapshot.milestones, change.milestones, (m) => m.id),
      }

    case 'deleteMilestone': {
      const taskIds = idsOf(snapshot.tasks.filter((t) => t.milestoneId === change.id))
      return dropTasks(
        { ...snapshot, milestones: snapshot.milestones.filter((m) => m.id !== change.id) },
        taskIds,
      )
    }

    case 'saveTasks':
      return { ...snapshot, tasks: upsertBy(snapshot.tasks, change.tasks, (t) => t.id) }

    case 'deleteTask':
      return dropTasks(snapshot, new Set([change.id]))

    case 'setDependencies': {
      const others = snapshot.dependencies.filter((d) => d.taskId !== change.taskId)
      const added: Dependency[] = change.blockedByIds.map((blockedByTaskId) => ({
        taskId: change.taskId,
        blockedByTaskId,
      }))
      return { ...snapshot, dependencies: [...others, ...added] }
    }

    case 'saveChecklist':
      return { ...snapshot, checklist: upsertBy(snapshot.checklist, change.items, (c) => c.id) }

    case 'deleteChecklistItem':
      return { ...snapshot, checklist: snapshot.checklist.filter((c) => c.id !== change.id) }

    case 'saveTemplate':
      return { ...snapshot, templates: upsertBy(snapshot.templates, [change.template], (t) => t.id) }

    case 'deleteTemplate':
      return { ...snapshot, templates: snapshot.templates.filter((t) => t.id !== change.id) }

    case 'saveWeek':
      return { ...snapshot, weeks: upsertBy(snapshot.weeks, [change.week], (w) => w.weekStart) }

    case 'saveSettings':
      return { ...snapshot, settings: change.settings }

    case 'insertBundle': {
      const { bundle } = change
      return {
        ...snapshot,
        projects: [...snapshot.projects, ...bundle.projects],
        milestones: [...snapshot.milestones, ...bundle.milestones],
        tasks: [...snapshot.tasks, ...bundle.tasks],
        dependencies: [...snapshot.dependencies, ...bundle.dependencies],
        checklist: [...snapshot.checklist, ...bundle.checklist],
      }
    }

    default: {
      const _never: never = change
      return _never
    }
  }
}
