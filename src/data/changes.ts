import type {
  ChecklistItem,
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

/** Pure: returns a new Snapshot with the change applied (never mutates the input). */
export function applyChange(snapshot: Snapshot, change: Change): Snapshot {
  void snapshot
  void change
  throw new Error('not implemented')
}
