import { useSyncExternalStore } from 'react'

const QUERY = '(max-width: 767px)'

function subscribe(onChange: () => void): () => void {
  const mql = window.matchMedia(QUERY)
  mql.addEventListener('change', onChange)
  return () => mql.removeEventListener('change', onChange)
}

/**
 * True on phone-width screens. The Primer page header keeps its actions on the title row (min-width:
 * max-content), which overflows on phones, so pages move their action buttons below the header there.
 */
export function useIsNarrow(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  )
}
