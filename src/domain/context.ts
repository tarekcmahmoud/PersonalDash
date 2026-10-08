import type { CalendarEvent, ISODate, Snapshot } from './types'

/** Input to the planning/health/review computations. */
export interface PlanContext extends Snapshot {
  /** Monday of the week being viewed/planned. */
  weekStart: ISODate
  /** Today's local date. */
  today: ISODate
  /** Calendar events overlapping the week (empty when the calendar is not connected). */
  events: CalendarEvent[]
}
