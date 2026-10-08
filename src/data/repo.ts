import type { Snapshot } from '../domain/types'
import type { Change } from './changes'

/** Persistence for the signed-in user. Implementations: memoryRepo (dev/tests/e2e), supabaseRepo. */
export interface Repo {
  /**
   * Everything for the current user. A brand-new user gets DEFAULT_SETTINGS and the system
   * Admin/Misc project created on first load.
   */
  loadSnapshot(): Promise<Snapshot>
  /** Persist one change. Rejects on failure (the UI then rolls back its optimistic update). */
  apply(change: Change): Promise<void>
}
