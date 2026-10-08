import type { Services } from './services'

export type DataMode = 'memory' | 'supabase'

export function dataMode(): DataMode {
  return import.meta.env.VITE_DATA_MODE === 'supabase' ? 'supabase' : 'memory'
}

/**
 * Picks the backend from VITE_DATA_MODE ("memory" default, or "supabase"). Each backend is loaded on demand,
 * so the Supabase client isn't shipped to memory-mode builds and the demo data isn't in production ones.
 */
export async function createServices(): Promise<Services> {
  if (dataMode() === 'supabase') {
    const url = import.meta.env.VITE_SUPABASE_URL
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY
    if (!url || !key)
      throw new Error('VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set in supabase mode')
    const { createSupabaseServices } = await import('./supabaseRepo')
    return createSupabaseServices(url, key)
  }
  const [{ createMemoryAuth, createMemoryRepo }, { seedSnapshot }, { todayISO }] = await Promise.all([
    import('./memoryRepo'),
    import('./seed'),
    import('../domain/week'),
  ])
  return { repo: createMemoryRepo(seedSnapshot(todayISO())), auth: createMemoryAuth() }
}
