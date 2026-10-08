import { useSyncExternalStore } from 'react'

/** Layout breakpoint (Primer "large"): two columns from here up. */
export const WIDE_QUERY = '(min-width: 1012px)'

function subscribe(onChange: () => void): () => void {
  const mql = window.matchMedia(WIDE_QUERY)
  mql.addEventListener('change', onChange)
  return () => mql.removeEventListener('change', onChange)
}

/** True on screens wide enough for the two-column Today layout. */
export function useIsWide(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(WIDE_QUERY).matches,
    () => false,
  )
}
