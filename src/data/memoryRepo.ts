import type { Snapshot } from '../domain/types'
import type { AuthService } from './auth'
import type { Repo } from './repo'

/**
 * In-memory Repo for development without a backend, unit tests and e2e.
 * Starts from `initial` (or seedSnapshot() when omitted); state resets on page reload.
 * Optional `latencyMs` delays every call (to exercise loading states).
 */
export function createMemoryRepo(initial?: Snapshot, opts?: { latencyMs?: number }): Repo {
  void initial
  void opts
  throw new Error('not implemented')
}

/** Always signed in as { id: 'local', email: 'you@local' }; signOut/signIn are no-ops that notify listeners. */
export function createMemoryAuth(): AuthService {
  throw new Error('not implemented')
}
