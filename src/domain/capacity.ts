import type { CalendarEvent, ISODate, Settings, Task, TaskSize } from './types'

/** Hours a task of this size takes. XL → 0 (it can't be planned). */
export function sizeHours(size: TaskSize, settings: Settings): number {
  void size
  void settings
  throw new Error('not implemented')
}

/** Sum of sizeHours over tasks that are not done, plus followUpCount × S hours. */
export function plannedHours(tasks: Task[], settings: Settings, followUpCount: number): number {
  void tasks
  void settings
  void followUpCount
  throw new Error('not implemented')
}

export interface WeekCapacity {
  /** Total working hours in the week from settings.workHours. */
  workHours: number
  /** Busy, timed (non-all-day) event time that overlaps working hours, in hours (overlapping events merged). */
  meetingHours: number
  /** (workHours − meetingHours) × focusFactor, rounded to 0.5h; or the override when given. */
  capacity: number
  overridden: boolean
}

/**
 * Capacity of the week starting at weekStart. Event times are converted to local time;
 * only the parts inside each day's work window count.
 */
export function weekCapacity(
  weekStart: ISODate,
  settings: Settings,
  events: CalendarEvent[],
  override: number | null,
): WeekCapacity {
  void weekStart
  void settings
  void events
  void override
  throw new Error('not implemented')
}

/** Same computation as weekCapacity for a single date (used for the Today view). */
export function dayCapacity(date: ISODate, settings: Settings, events: CalendarEvent[]): WeekCapacity {
  void date
  void settings
  void events
  throw new Error('not implemented')
}
