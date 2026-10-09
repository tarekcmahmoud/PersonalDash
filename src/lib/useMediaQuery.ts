import { useSyncExternalStore } from 'react'

/** Whether a CSS media query matches, kept in sync as the window changes (false where there is no window). */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      const q = window.matchMedia(query)
      q.addEventListener('change', cb)
      return () => q.removeEventListener('change', cb)
    },
    () => window.matchMedia(query).matches,
    () => false,
  )
}
