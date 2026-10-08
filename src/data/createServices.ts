import { todayISO } from '../domain/week'
import { createMemoryAuth, createMemoryRepo } from './memoryRepo'
import { seedSnapshot } from './seed'
import type { Services } from './services'
import { createSupabaseServices } from './supabaseRepo'

export type DataMode = 'memory' | 'supabase'

export function dataMode(): DataMode {
  return import.meta.env.VITE_DATA_MODE === 'supabase' ? 'supabase' : 'memory'
}

/** Picks the backend from VITE_DATA_MODE ("memory" default, or "supabase"). */
export function createServices(): Services {
  if (dataMode() === 'supabase') {
    const url = import.meta.env.VITE_SUPABASE_URL
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY
    if (!url || !key)
      throw new Error('VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set in supabase mode')
    return createSupabaseServices(url, key)
  }
  return { repo: createMemoryRepo(seedSnapshot(todayISO())), auth: createMemoryAuth() }
}
