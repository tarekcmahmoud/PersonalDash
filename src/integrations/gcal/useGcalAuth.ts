import { useSyncExternalStore } from 'react'
import { getAuthState, subscribeAuth, type GcalAuthState } from './auth'

/** Reactive view of the Google token state (configured / token present / busy / last error). */
export function useGcalAuth(): GcalAuthState {
  return useSyncExternalStore(subscribeAuth, getAuthState, getAuthState)
}
