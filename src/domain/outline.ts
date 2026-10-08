import type { DateKind, EntityBundle, ISODate, Project, Snapshot, TaskSize } from './types'

// Parser/serializer for the outline format specified in docs/outline-format.md.

export interface OutlineChecklistItem {
  text: string
  done: boolean
}

export interface OutlineTask {
  title: string
  size: TaskSize
  /** Without the leading '#'. */
  key: string | null
  /** Keys (without '#') of explicit blockers. */
  after: string[]
  doneWhen: string
  notes: string
  checklist: OutlineChecklistItem[]
  /** 1-based source line; absent for docs built in code. Ignored by the serializer. */
  line?: number
}

export interface OutlineMilestone {
  name: string
  targetDate: ISODate | null
  dateKind: DateKind | null
  tasks: OutlineTask[]
  line?: number
}

export interface OutlineDoc {
  name: string
  outcome: string
  targetDate: ISODate | null
  dateKind: DateKind
  weeklyMin: number | null
  /** Tasks before the first milestone. */
  tasks: OutlineTask[]
  milestones: OutlineMilestone[]
}

export interface OutlineIssue {
  /** 1-based line number (0 = whole document). */
  line: number
  message: string
  severity: 'error' | 'warning'
}

export interface ParseResult {
  /** null when there is at least one error. */
  doc: OutlineDoc | null
  issues: OutlineIssue[]
}

export function parseOutline(text: string): ParseResult {
  void text
  throw new Error('not implemented')
}

/** Canonical text. parseOutline(serializeOutline(d)).doc equals d (ignoring `line`). */
export function serializeOutline(doc: OutlineDoc): string {
  void doc
  throw new Error('not implemented')
}

export interface DocToBundleOptions {
  /** Rank for the new project (caller passes max existing rank + 1). */
  rank: number
  /** Field overrides for the new project (e.g. name/outcome/target chosen in the "new from template" form). */
  project?: Partial<Pick<Project, 'name' | 'outcome' | 'targetDate' | 'dateKind' | 'weeklyMin' | 'status'>>
}

/**
 * New entities for a project created from a doc: one Project, its Milestones (position = order),
 * Tasks (position = order within group, status todo), Dependencies from `after`, ChecklistItems.
 * Uses the factories in ./factories (fresh ids).
 */
export function docToBundle(doc: OutlineDoc, opts: DocToBundleOptions): EntityBundle {
  void doc
  void opts
  throw new Error('not implemented')
}

/**
 * Doc describing an existing project (used for "save as template"). Includes every task regardless of
 * status, in workflow order. Tasks referenced by explicit dependencies get generated keys (t1, t2, …).
 * Checklist items keep their done flag; milestone order follows position.
 */
export function projectToDoc(
  projectId: string,
  snapshot: Pick<Snapshot, 'projects' | 'milestones' | 'tasks' | 'dependencies' | 'checklist'>,
): OutlineDoc {
  void projectId
  void snapshot
  throw new Error('not implemented')
}
