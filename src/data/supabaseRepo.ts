import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'
import { makeSystemProject } from '../domain/factories'
import {
  DEFAULT_SETTINGS,
  type EntityBundle,
  type ID,
  type Project,
  type Settings,
  type Snapshot,
} from '../domain/types'
import type { AuthService, AuthUser } from './auth'
import type { Change } from './changes'
import type { Repo } from './repo'
import type { Services } from './services'
import {
  checklistItemFromRow,
  checklistItemToRow,
  dependencyFromRow,
  dependencyToRow,
  milestoneFromRow,
  milestoneToRow,
  projectFromRow,
  projectToRow,
  settingsFromRow,
  settingsToRow,
  taskFromRow,
  taskToRow,
  templateFromRow,
  templateToRow,
  weekFromRow,
  weekToRow,
  type ChecklistItemRow,
  type DependencyRow,
  type MilestoneRow,
  type ProjectRow,
  type SettingsRow,
  type TaskRow,
  type TemplateRow,
  type WeekRow,
} from './supabaseMappers'

/** PostgREST returns at most this many rows per request (Supabase default max-rows). */
const PAGE_SIZE = 1000
/** Postgres unique_violation. */
const UNIQUE_VIOLATION = '23505'

interface DbError {
  message: string
  code?: string
}

function fail(context: string, error: DbError): never {
  throw new Error(`Supabase: ${context} failed: ${error.message}`)
}

function toAuthUser(user: User | null | undefined): AuthUser | null {
  return user ? { id: user.id, email: user.email ?? '' } : null
}

/**
 * Supabase-backed Repo + AuthService (email/password). Maps camelCase domain fields to the snake_case
 * columns of supabase/migrations/*.sql. Every row carries user_id = the signed-in user; RLS enforces it.
 */
export function createSupabaseServices(url: string, anonKey: string): Services {
  const client = createClient(url, anonKey)
  return { repo: createSupabaseRepo(client), auth: createSupabaseAuth(client) }
}

export function createSupabaseAuth(client: SupabaseClient): AuthService {
  return {
    async currentUser() {
      const { data, error } = await client.auth.getSession()
      if (error) fail('reading the session', error)
      return toAuthUser(data.session?.user)
    },
    async signIn(email, password) {
      const { error } = await client.auth.signInWithPassword({ email, password })
      if (error) throw new Error(error.message)
    },
    async signOut() {
      const { error } = await client.auth.signOut()
      if (error) throw new Error(error.message)
    },
    onChange(cb) {
      const { data } = client.auth.onAuthStateChange((_event, session) => cb(toAuthUser(session?.user)))
      return () => data.subscription.unsubscribe()
    },
  }
}

export function createSupabaseRepo(client: SupabaseClient): Repo {
  /** The signed-in user's id (read from the locally stored session; RLS is the real gate). */
  async function userId(): Promise<string> {
    const { data, error } = await client.auth.getSession()
    if (error) fail('reading the session', error)
    const id = data.session?.user.id
    if (!id) throw new Error('Supabase: not signed in')
    return id
  }

  /** Reads every row of a table, paging past the server's max-rows limit. Stable order needed for paging. */
  async function fetchAll<Row>(table: string, orderBy: string[]): Promise<Row[]> {
    const rows: Row[] = []
    for (let from = 0; ; from += PAGE_SIZE) {
      let q = client.from(table).select('*')
      for (const col of orderBy) q = q.order(col)
      const { data, error } = await q.range(from, from + PAGE_SIZE - 1)
      if (error) fail(`loading ${table}`, error)
      const page = (data ?? []) as Row[]
      rows.push(...page)
      if (page.length < PAGE_SIZE) return rows
    }
  }

  async function fetchSettingsRow(): Promise<SettingsRow | null> {
    const { data, error } = await client.from('settings').select('*').maybeSingle()
    if (error) fail('loading settings', error)
    return (data as SettingsRow | null) ?? null
  }

  /** Inserts DEFAULT_SETTINGS unless a row already exists (safe against concurrent first loads). */
  async function ensureSettings(): Promise<Settings> {
    const uid = await userId()
    const { error } = await client
      .from('settings')
      .upsert(
        { user_id: uid, ...settingsToRow(DEFAULT_SETTINGS) },
        { onConflict: 'user_id', ignoreDuplicates: true },
      )
    if (error) fail('creating default settings', error)
    const row = await fetchSettingsRow()
    return row ? settingsFromRow(row) : DEFAULT_SETTINGS
  }

  /** Inserts the system Admin/Misc project unless one exists (the partial unique index makes this idempotent). */
  async function ensureSystemProject(): Promise<Project> {
    const project = makeSystemProject()
    const { error } = await client.from('projects').insert(projectToRow(project))
    if (error && error.code !== UNIQUE_VIOLATION) fail('creating the system project', error)
    if (!error) return project
    const { data, error: readError } = await client
      .from('projects')
      .select('*')
      .eq('is_system', true)
      .limit(1)
    if (readError) fail('loading the system project', readError)
    const row = (data as ProjectRow[] | null)?.[0]
    if (!row) throw new Error('Supabase: system project exists but could not be read')
    return projectFromRow(row)
  }

  async function loadSnapshot(): Promise<Snapshot> {
    const [projects, milestones, tasks, dependencies, checklist, templates, weeks, settingsRow] =
      await Promise.all([
        fetchAll<ProjectRow>('projects', ['id']),
        fetchAll<MilestoneRow>('milestones', ['id']),
        fetchAll<TaskRow>('tasks', ['id']),
        fetchAll<DependencyRow>('task_dependencies', ['task_id', 'blocked_by_task_id']),
        fetchAll<ChecklistItemRow>('checklist_items', ['id']),
        fetchAll<TemplateRow>('templates', ['id']),
        fetchAll<WeekRow>('weeks', ['week_start']),
        fetchSettingsRow(),
      ])

    const settings = settingsRow ? settingsFromRow(settingsRow) : await ensureSettings()
    const projectList = projects.map(projectFromRow)
    if (!projectList.some((p) => p.isSystem)) projectList.push(await ensureSystemProject())

    return {
      projects: projectList,
      milestones: milestones.map(milestoneFromRow),
      tasks: tasks.map(taskFromRow),
      dependencies: dependencies.map(dependencyFromRow),
      checklist: checklist.map(checklistItemFromRow),
      templates: templates.map(templateFromRow),
      resources: [], // TODO(resources): load from the resources table (migration 0004)
      weeks: weeks.map(weekFromRow),
      settings,
    }
  }

  async function upsert(table: string, rows: object[], onConflict: string): Promise<void> {
    if (rows.length === 0) return
    const { error } = await client.from(table).upsert(rows, { onConflict })
    if (error) fail(`saving ${table}`, error)
  }

  async function insert(table: string, rows: object[]): Promise<void> {
    if (rows.length === 0) return
    const { error } = await client.from(table).insert(rows)
    if (error) fail(`inserting into ${table}`, error)
  }

  async function deleteById(table: string, id: ID): Promise<void> {
    const { error } = await client.from(table).delete().eq('id', id)
    if (error) fail(`deleting from ${table}`, error)
  }

  /**
   * Replaces the blockers of a task. New blockers are upserted first and stale ones pruned afterwards, so a
   * failure part-way never leaves the task with fewer blockers than it started with.
   */
  async function setDependencies(taskId: ID, blockedByIds: ID[]): Promise<void> {
    const wanted = [...new Set(blockedByIds)].filter((id) => id !== taskId)
    if (wanted.length > 0) {
      const rows = wanted.map((blockedByTaskId) => dependencyToRow({ taskId, blockedByTaskId }))
      const { error } = await client
        .from('task_dependencies')
        .upsert(rows, { onConflict: 'task_id,blocked_by_task_id', ignoreDuplicates: true })
      if (error) fail('saving task_dependencies', error)
    }
    let del = client.from('task_dependencies').delete().eq('task_id', taskId)
    if (wanted.length > 0) del = del.not('blocked_by_task_id', 'in', `(${wanted.join(',')})`)
    const { error } = await del
    if (error) fail('clearing task_dependencies', error)
  }

  /** Inserts in FK-safe order: projects, milestones, tasks, dependencies, checklist. */
  async function insertBundle(bundle: EntityBundle): Promise<void> {
    await insert('projects', bundle.projects.map(projectToRow))
    await insert('milestones', bundle.milestones.map(milestoneToRow))
    await insert('tasks', bundle.tasks.map(taskToRow))
    await insert('task_dependencies', bundle.dependencies.map(dependencyToRow))
    await insert('checklist_items', bundle.checklist.map(checklistItemToRow))
  }

  async function apply(change: Change): Promise<void> {
    switch (change.kind) {
      case 'saveProjects':
        return upsert('projects', change.projects.map(projectToRow), 'id')
      case 'deleteProject':
        // milestones, tasks, checklist and dependencies cascade in the database; the system project is guarded by a trigger
        return deleteById('projects', change.id)
      case 'saveMilestones':
        return upsert('milestones', change.milestones.map(milestoneToRow), 'id')
      case 'deleteMilestone':
        return deleteById('milestones', change.id)
      case 'saveTasks':
        return upsert('tasks', change.tasks.map(taskToRow), 'id')
      case 'deleteTask':
        return deleteById('tasks', change.id)
      case 'setDependencies':
        return setDependencies(change.taskId, change.blockedByIds)
      case 'saveChecklist':
        return upsert('checklist_items', change.items.map(checklistItemToRow), 'id')
      case 'deleteChecklistItem':
        return deleteById('checklist_items', change.id)
      case 'saveTemplate':
        return upsert('templates', [templateToRow(change.template)], 'id')
      case 'deleteTemplate':
        return deleteById('templates', change.id)
      case 'saveWeek': {
        const uid = await userId()
        return upsert('weeks', [{ user_id: uid, ...weekToRow(change.week) }], 'user_id,week_start')
      }
      case 'saveSettings': {
        const uid = await userId()
        return upsert('settings', [{ user_id: uid, ...settingsToRow(change.settings) }], 'user_id')
      }
      case 'insertBundle':
        return insertBundle(change.bundle)
      case 'saveResources':
      case 'deleteResource':
        throw new Error('Supabase: resources are not supported yet') // TODO(resources)
      default: {
        const _exhaustive: never = change
        throw new Error(`Supabase: unsupported change ${JSON.stringify(_exhaustive)}`)
      }
    }
  }

  const notYet = async (): Promise<never> => {
    throw new Error('Supabase: image storage is not supported yet') // TODO(resources)
  }
  return { loadSnapshot, apply, uploadImage: notYet, imageUrl: notYet, deleteImage: notYet }
}
