import type { Snapshot } from '../domain/types'
import { todayISO } from '../domain/week'
import { applyChange } from './changes'
import type { AuthService, AuthUser } from './auth'
import type { Repo } from './repo'
import { seedSnapshot } from './seed'

/**
 * In-memory Repo for development without a backend, unit tests and e2e.
 * Starts from `initial` (or seedSnapshot() when omitted); state resets on page reload.
 * Optional `latencyMs` delays every call (to exercise loading states).
 */
export function createMemoryRepo(initial?: Snapshot, opts?: { latencyMs?: number }): Repo {
  let state = initial ?? seedSnapshot(todayISO())
  const latencyMs = opts?.latencyMs ?? 0
  const images = new Map<string, string>()

  const delay = async (): Promise<void> => {
    if (latencyMs > 0) await new Promise((resolve) => setTimeout(resolve, latencyMs))
  }

  return {
    async loadSnapshot() {
      await delay()
      return structuredClone(state)
    },
    async apply(change) {
      await delay()
      state = applyChange(state, change)
    },
    // Images live in this browser session only (object URLs), like the rest of memory mode.
    async uploadImage(file) {
      await delay()
      checkImage(file)
      const path = `memory/${crypto.randomUUID()}-${file.name}`
      images.set(path, URL.createObjectURL(file))
      return path
    },
    async imageUrl(path) {
      const url = images.get(path)
      if (!url) throw new Error(`No stored image at ${path}`)
      return url
    },
    async deleteImage(path) {
      const url = images.get(path)
      if (url) URL.revokeObjectURL(url)
      images.delete(path)
    },
  }
}

/** Upload rules shared by every backend: images only, at most 5 MB. */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024
export function checkImage(file: File): void {
  if (!file.type.startsWith('image/')) throw new Error('Only image files can be uploaded.')
  if (file.size > MAX_IMAGE_BYTES) throw new Error('Images must be 5 MB or smaller.')
}

/**
 * Memory auth for the in-memory backend. Starts signed in as { id: 'local', email: 'you@local' }.
 * signOut/signIn flip the signed-in flag and notify listeners; credentials are not checked.
 */
export function createMemoryAuth(): AuthService {
  const user: AuthUser = { id: 'local', email: 'you@local' }
  let signedIn = true
  const listeners = new Set<(user: AuthUser | null) => void>()

  const notify = (): void => {
    const current = signedIn ? { ...user } : null
    for (const cb of [...listeners]) cb(current)
  }

  return {
    async currentUser() {
      return signedIn ? { ...user } : null
    },
    async signIn(_email, _password) {
      signedIn = true
      notify()
    },
    async signOut() {
      signedIn = false
      notify()
    },
    onChange(cb) {
      listeners.add(cb)
      return () => {
        listeners.delete(cb)
      }
    },
  }
}
