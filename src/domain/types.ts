// Core domain model. Pure data — no I/O. All IDs are client-generated UUIDs so writes can be optimistic.

export type ID = string
/** Calendar date, 'YYYY-MM-DD' (local). */
export type ISODate = string
/** Timestamp, full ISO 8601 with offset. */
export type ISODateTime = string

export type ProjectStatus = 'active' | 'on_hold' | 'done'
/** hard = external deadline; soft = self-set target. */
export type DateKind = 'hard' | 'soft'
/** XL means "too big or unclear": such a task cannot be scheduled until it is split. */
export type TaskSize = 'S' | 'M' | 'L' | 'XL'
export type SchedulableSize = Exclude<TaskSize, 'XL'>
export type TaskStatus = 'todo' | 'waiting' | 'done'

export interface Project {
  id: ID
  name: string
  /** Objective outcome: "Done when …". Required for non-system projects. */
  outcome: string
  /** Objective target date. Required for non-system projects (null only for the system Admin/Misc project). */
  targetDate: ISODate | null
  dateKind: DateKind
  status: ProjectStatus
  /** Manual priority among projects; lower = higher priority. Unique per user, not necessarily contiguous. */
  rank: number
  /** Optional minimum number of tasks to plan per week. */
  weeklyMin: number | null
  /** The permanent Admin/Misc project: never flagged as neglected, cannot be deleted. */
  isSystem: boolean
  createdAt: ISODateTime
}

export interface Milestone {
  id: ID
  projectId: ID
  name: string
  /** Order within the project; lower first. */
  position: number
  targetDate: ISODate | null
  dateKind: DateKind | null
}

export interface Task {
  id: ID
  /** null = Inbox (not yet filed into a project). */
  projectId: ID | null
  /** null = not in a milestone. Within a project, milestone-less tasks come before all milestones. */
  milestoneId: ID | null
  title: string
  notes: string
  /** Optional definition of done. */
  doneWhen: string
  size: TaskSize
  /** Order within its milestone (or within the project's milestone-less group); lower first. */
  position: number
  status: TaskStatus
  /** Who/what we are waiting on (status = 'waiting'). */
  waitingOn: string | null
  /** When to follow up on a waiting task. */
  followUpDate: ISODate | null
  /** Monday of the week this task is planned in; null = not planned. */
  weekStart: ISODate | null
  /** Optional day (within weekStart's week) the task is pinned to. */
  pinnedDay: ISODate | null
  /** Number of times the task was planned for a week and not finished. */
  slipCount: number
  completedAt: ISODateTime | null
  /** Google Calendar event id for a pinned task, once pushed. */
  gcalEventId: string | null
  /** true when the pinned-task calendar event needs (re)syncing. */
  gcalDirty: boolean
  createdAt: ISODateTime
}

export interface ChecklistItem {
  id: ID
  taskId: ID
  text: string
  done: boolean
  position: number
}

/** taskId cannot start until blockedByTaskId is done. Explicit links replace the implicit "previous task" rule. */
export interface Dependency {
  taskId: ID
  blockedByTaskId: ID
}

export interface Template {
  id: ID
  name: string
  /** Breakdown in the outline format (see src/domain/outline.ts / docs/outline-format.md). */
  outline: string
  updatedAt: ISODateTime
}

export interface WeekMeta {
  /** Monday, 'YYYY-MM-DD'. */
  weekStart: ISODate
  /** Manual capacity in hours, overriding the computed one. */
  capacityOverride: number | null
  /** Set when the weekly review for the week *ending before* weekStart was completed. */
  reviewedAt: ISODateTime | null
}

export type Weekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'
export const WEEKDAYS: readonly Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

/** 'HH:MM' 24h local time. */
export type ClockTime = string
export interface WorkWindow {
  start: ClockTime
  end: ClockTime
}

export interface Settings {
  /** null = not a working day. */
  workHours: Record<Weekday, WorkWindow | null>
  /** Fraction of non-meeting working time available for planned work, 0..1. */
  focusFactor: number
  sizeHours: Record<SchedulableSize, number>
  /** Soft warning when more projects than this are active (system project excluded). */
  activeCap: number
  /** A target date within this many days counts as "deadline approaching". */
  deadlineWarningDays: number
  /** Whether Google Calendar is connected (tokens are never stored here). */
  calendarConnected: boolean
  /** Id of the dedicated "PersonalDash" Google calendar, once created. */
  gcalCalendarId: string | null
}

export const DEFAULT_SETTINGS: Settings = {
  workHours: {
    mon: { start: '09:00', end: '18:00' },
    tue: { start: '09:00', end: '18:00' },
    wed: { start: '09:00', end: '18:00' },
    thu: { start: '09:00', end: '18:00' },
    fri: { start: '09:00', end: '18:00' },
    sat: null,
    sun: null,
  },
  focusFactor: 0.7,
  sizeHours: { S: 1, M: 4, L: 8 },
  activeCap: 6,
  deadlineWarningDays: 14,
  calendarConnected: false,
  gcalCalendarId: null,
}

/** A calendar event as the app sees it (from Google Calendar, read-only). */
export interface CalendarEvent {
  id: string
  title: string
  /** For timed events: ISO datetime. For all-day events: 'YYYY-MM-DD'. */
  start: string
  /** Exclusive end; same format as start. */
  end: string
  allDay: boolean
  /** false for events marked "free"/transparent or declined — they don't consume capacity. */
  busy: boolean
}

/** Everything the app holds for the signed-in user. Data volumes are small, so the UI works off one snapshot. */
export interface Snapshot {
  projects: Project[]
  milestones: Milestone[]
  tasks: Task[]
  dependencies: Dependency[]
  checklist: ChecklistItem[]
  templates: Template[]
  weeks: WeekMeta[]
  settings: Settings
}

/** A set of new entities created together (e.g. an outline import). */
export interface EntityBundle {
  projects: Project[]
  milestones: Milestone[]
  tasks: Task[]
  dependencies: Dependency[]
  checklist: ChecklistItem[]
}
