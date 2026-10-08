import { useSyncExternalStore } from 'react'

// Dark mode follows the OS setting: the `.dark` class on <html> drives the Tailwind/shadcn tokens.
const query = () => window.matchMedia('(prefers-color-scheme: dark)')

export function syncColorScheme(): void {
  const apply = () => document.documentElement.classList.toggle('dark', query().matches)
  apply()
  query().addEventListener('change', apply)
}

export function useColorScheme(): 'light' | 'dark' {
  return useSyncExternalStore(
    (cb) => {
      const q = query()
      q.addEventListener('change', cb)
      return () => q.removeEventListener('change', cb)
    },
    () => (query().matches ? 'dark' : 'light'),
    () => 'light',
  )
}
