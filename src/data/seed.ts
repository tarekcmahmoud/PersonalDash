import type { Snapshot } from '../domain/types'

/**
 * Demo data for memory mode, relative to `today`: 4 active projects (one with a hard deadline within
 * 10 days, one with weeklyMin 2, one with no tasks planned this week → neglected), 1 on-hold project, the
 * system Admin/Misc project, milestones, ~30 tasks across sizes incl. one XL, one waiting task with a
 * follow-up date this week, a few done last week, some planned this week (one pinned to today), one
 * explicit dependency, a checklist, 2 Inbox tasks, 1 template, DEFAULT_SETTINGS.
 */
export function seedSnapshot(today: string): Snapshot {
  void today
  throw new Error('not implemented')
}

/** Empty snapshot: DEFAULT_SETTINGS + the system project only. */
export function emptySnapshot(): Snapshot {
  throw new Error('not implemented')
}
