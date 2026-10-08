import type { Services } from './services'

/**
 * Supabase-backed Repo + AuthService (email/password). Maps camelCase domain fields to the snake_case
 * columns of supabase/migrations/0001_init.sql. Every row carries user_id = the signed-in user; RLS enforces it.
 */
export function createSupabaseServices(url: string, anonKey: string): Services {
  void url
  void anonKey
  throw new Error('not implemented')
}
