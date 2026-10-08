import {
  DEFAULT_SETTINGS,
  type ChecklistItem,
  type DateKind,
  type Dependency,
  type Milestone,
  type Project,
  type ProjectStatus,
  type Resource,
  type Settings,
  type SchedulableSize,
  type Task,
  type TaskSize,
  type TaskStatus,
  type Template,
  type WeekMeta,
  type Weekday,
  type WorkWindow,
} from '../domain/types'

// Row shapes of supabase/migrations/*.sql (without user_id, which the database fills with
// auth.uid() on insert). Dates come back as 'YYYY-MM-DD', timestamps as ISO strings, jsonb as objects.

export interface ProjectRow {
  id: string
  name: string
  outcome: string
  target_date: string | null
  date_kind: DateKind
  status: ProjectStatus
  rank: number
  weekly_min: number | null
  is_system: boolean
  created_at: string
}

export interface MilestoneRow {
  id: string
  project_id: string
  /** supabase/migrations/0006_substreams.sql */
  parent_id: string | null
  name: string
  position: number
  target_date: string | null
  date_kind: DateKind | null
}

export interface TaskRow {
  id: string
  project_id: string | null
  milestone_id: string | null
  title: string
  notes: string
  done_when: string
  size: TaskSize
  position: number
  status: TaskStatus
  waiting_on: string | null
  follow_up_date: string | null
  week_start: string | null
  pinned_day: string | null
  slip_count: number
  completed_at: string | null
  gcal_event_id: string | null
  gcal_dirty: boolean
  created_at: string
}

export interface DependencyRow {
  task_id: string
  blocked_by_task_id: string
}

export interface ChecklistItemRow {
  id: string
  task_id: string
  text: string
  done: boolean
  position: number
}

export interface TemplateRow {
  id: string
  name: string
  outline: string
  updated_at: string
}

export interface ResourceRow {
  id: string
  project_id: string
  url: string
  title: string
  description: string
  image_url: string | null
  image_path: string | null
  workstream_ids: string[]
  position: number
  created_at: string
}

export interface WeekRow {
  week_start: string
  capacity_override: number | null
  reviewed_at: string | null
}

export interface SettingsRow {
  work_hours: Record<Weekday, WorkWindow | null>
  focus_factor: number
  size_hours: Record<SchedulableSize, number>
  active_cap: number
  deadline_warning_days: number
  calendar_connected: boolean
  gcal_calendar_id: string | null
}

/**
 * Postgres returns timestamptz as '2026-10-08T12:00:00.123+00:00' (or without the fraction); the app writes
 * and compares Date.toISOString() strings ('…T12:00:00.123Z'), so normalise on the way in.
 */
export function timestampFromRow(value: string): string {
  return new Date(value).toISOString()
}

const optionalTimestampFromRow = (value: string | null): string | null =>
  value === null ? null : timestampFromRow(value)

// ---- projects ----------------------------------------------------------------------------------------

export function projectToRow(p: Project): ProjectRow {
  return {
    id: p.id,
    name: p.name,
    outcome: p.outcome,
    target_date: p.targetDate,
    date_kind: p.dateKind,
    status: p.status,
    rank: p.rank,
    weekly_min: p.weeklyMin,
    is_system: p.isSystem,
    created_at: p.createdAt,
  }
}

export function projectFromRow(r: ProjectRow): Project {
  return {
    id: r.id,
    name: r.name,
    outcome: r.outcome,
    targetDate: r.target_date,
    dateKind: r.date_kind,
    status: r.status,
    rank: r.rank,
    weeklyMin: r.weekly_min,
    isSystem: r.is_system,
    createdAt: timestampFromRow(r.created_at),
  }
}

// ---- milestones --------------------------------------------------------------------------------------

export function milestoneToRow(m: Milestone): MilestoneRow {
  return {
    id: m.id,
    project_id: m.projectId,
    parent_id: m.parentId,
    name: m.name,
    position: m.position,
    target_date: m.targetDate,
    date_kind: m.dateKind,
  }
}

export function milestoneFromRow(r: MilestoneRow): Milestone {
  return {
    id: r.id,
    projectId: r.project_id,
    parentId: r.parent_id ?? null,
    name: r.name,
    position: r.position,
    targetDate: r.target_date,
    dateKind: r.date_kind,
  }
}

// ---- tasks -------------------------------------------------------------------------------------------

export function taskToRow(t: Task): TaskRow {
  return {
    id: t.id,
    project_id: t.projectId,
    milestone_id: t.milestoneId,
    title: t.title,
    notes: t.notes,
    done_when: t.doneWhen,
    size: t.size,
    position: t.position,
    status: t.status,
    waiting_on: t.waitingOn,
    follow_up_date: t.followUpDate,
    week_start: t.weekStart,
    pinned_day: t.pinnedDay,
    slip_count: t.slipCount,
    completed_at: t.completedAt,
    gcal_event_id: t.gcalEventId,
    gcal_dirty: t.gcalDirty,
    created_at: t.createdAt,
  }
}

export function taskFromRow(r: TaskRow): Task {
  return {
    id: r.id,
    projectId: r.project_id,
    milestoneId: r.milestone_id,
    title: r.title,
    notes: r.notes,
    doneWhen: r.done_when,
    size: r.size,
    position: r.position,
    status: r.status,
    waitingOn: r.waiting_on,
    followUpDate: r.follow_up_date,
    weekStart: r.week_start,
    pinnedDay: r.pinned_day,
    slipCount: r.slip_count,
    completedAt: optionalTimestampFromRow(r.completed_at),
    gcalEventId: r.gcal_event_id,
    gcalDirty: r.gcal_dirty,
    createdAt: timestampFromRow(r.created_at),
  }
}

// ---- dependencies ------------------------------------------------------------------------------------

export function dependencyToRow(d: Dependency): DependencyRow {
  return { task_id: d.taskId, blocked_by_task_id: d.blockedByTaskId }
}

export function dependencyFromRow(r: DependencyRow): Dependency {
  return { taskId: r.task_id, blockedByTaskId: r.blocked_by_task_id }
}

// ---- checklist ---------------------------------------------------------------------------------------

export function checklistItemToRow(c: ChecklistItem): ChecklistItemRow {
  return { id: c.id, task_id: c.taskId, text: c.text, done: c.done, position: c.position }
}

export function checklistItemFromRow(r: ChecklistItemRow): ChecklistItem {
  return { id: r.id, taskId: r.task_id, text: r.text, done: r.done, position: r.position }
}

// ---- templates ---------------------------------------------------------------------------------------

export function templateToRow(t: Template): TemplateRow {
  return { id: t.id, name: t.name, outline: t.outline, updated_at: t.updatedAt }
}

export function templateFromRow(r: TemplateRow): Template {
  return { id: r.id, name: r.name, outline: r.outline, updatedAt: timestampFromRow(r.updated_at) }
}

// ---- resources ---------------------------------------------------------------------------------------

export function resourceToRow(r: Resource): ResourceRow {
  return {
    id: r.id,
    project_id: r.projectId,
    url: r.url,
    title: r.title,
    description: r.description,
    image_url: r.imageUrl,
    image_path: r.imagePath,
    workstream_ids: r.workstreamIds,
    position: r.position,
    created_at: r.createdAt,
  }
}

export function resourceFromRow(r: ResourceRow): Resource {
  return {
    id: r.id,
    projectId: r.project_id,
    url: r.url,
    title: r.title,
    description: r.description,
    imageUrl: r.image_url,
    imagePath: r.image_path,
    workstreamIds: r.workstream_ids ?? [],
    position: r.position,
    createdAt: timestampFromRow(r.created_at),
  }
}

// ---- weeks -------------------------------------------------------------------------------------------

export function weekToRow(w: WeekMeta): WeekRow {
  return { week_start: w.weekStart, capacity_override: w.capacityOverride, reviewed_at: w.reviewedAt }
}

export function weekFromRow(r: WeekRow): WeekMeta {
  return {
    weekStart: r.week_start,
    capacityOverride: r.capacity_override,
    reviewedAt: optionalTimestampFromRow(r.reviewed_at),
  }
}

// ---- settings ----------------------------------------------------------------------------------------

export function settingsToRow(s: Settings): SettingsRow {
  return {
    work_hours: s.workHours,
    focus_factor: s.focusFactor,
    size_hours: s.sizeHours,
    active_cap: s.activeCap,
    deadline_warning_days: s.deadlineWarningDays,
    calendar_connected: s.calendarConnected,
    gcal_calendar_id: s.gcalCalendarId,
  }
}

/** jsonb columns are filled from the defaults for any missing key, so older rows keep loading. */
export function settingsFromRow(r: SettingsRow): Settings {
  return {
    workHours: { ...DEFAULT_SETTINGS.workHours, ...r.work_hours },
    focusFactor: r.focus_factor,
    sizeHours: { ...DEFAULT_SETTINGS.sizeHours, ...r.size_hours },
    activeCap: r.active_cap,
    deadlineWarningDays: r.deadline_warning_days,
    calendarConnected: r.calendar_connected,
    gcalCalendarId: r.gcal_calendar_id,
  }
}
