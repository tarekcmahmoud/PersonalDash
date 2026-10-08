import { useSyncExternalStore } from 'react'

// Tiny observable shared by <CalendarSync/> (which runs syncs) and the Settings page ("Sync now", status).

export interface SyncStatus {
  running: boolean
  /** Epoch ms of the last run that finished without errors. */
  lastSyncedAt: number | null
  error: string | null
  /** Bumped by requestSync(); CalendarSync runs immediately when it changes. */
  nonce: number
}

let status: SyncStatus = { running: false, lastSyncedAt: null, error: null, nonce: 0 }
const listeners = new Set<() => void>()

function publish(next: SyncStatus): void {
  status = next
  for (const l of [...listeners]) l()
}

export function getSyncStatus(): SyncStatus {
  return status
}

export function setSyncStatus(patch: Partial<Omit<SyncStatus, 'nonce'>>): void {
  publish({ ...status, ...patch })
}

/** Ask CalendarSync to sync right now (skips the debounce) and refresh the displayed events. */
export function requestSync(): void {
  publish({ ...status, nonce: status.nonce + 1 })
}

export function subscribeSync(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(subscribeSync, getSyncStatus, getSyncStatus)
}
