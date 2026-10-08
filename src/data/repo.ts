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
  /**
   * Store an uploaded image (resource cards). Returns its storage path, saved as Resource.imagePath.
   * Rejects for non-images or files over 5 MB.
   */
  uploadImage(file: File): Promise<string>
  /** A displayable URL for a stored image path. May be short-lived (e.g. a signed URL) — don't persist it. */
  imageUrl(path: string): Promise<string>
  /** Delete a stored image (best effort; missing paths are not an error). */
  deleteImage(path: string): Promise<void>
}
