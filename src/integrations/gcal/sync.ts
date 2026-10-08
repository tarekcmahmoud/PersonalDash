// Pushes pinned tasks to the dedicated "PersonalDash" calendar as all-day events.
import type { ID, ISODate, Project, Task } from '../../domain/types'
import { deleteEvent, errorMessage, GcalApiError, insertEvent, patchEvent } from './api'

export type SyncOp =
  | { kind: 'insert'; taskId: ID; day: ISODate; summary: string; description: string }
  | { kind: 'patch'; taskId: ID; eventId: string; day: ISODate; summary: string; description: string }
  | { kind: 'delete'; taskId: ID; eventId: string }
  /** Nothing to do on Google's side; just clear the task's dirty flag. */
  | { kind: 'clear'; taskId: ID }

/** The task fields written back after an operation. */
export interface TaskSyncPatch {
  taskId: ID
  patch: { gcalEventId: string | null; gcalDirty: boolean }
}

export interface SyncResult {
  patches: TaskSyncPatch[]
  errors: { taskId: ID; message: string }[]
  /** The token was rejected (401): stop and ask the user to reconnect. */
  unauthorized: boolean
}

export const eventSummary = (task: Pick<Task, 'title' | 'status'>): string =>
  `${task.status === 'done' ? '✓ ' : ''}${task.title}`

export function eventDescription(task: Pick<Task, 'projectId'>, projects: readonly Project[]): string {
  const name = task.projectId ? projects.find((p) => p.id === task.projectId)?.name : null
  return `Project: ${name ?? 'Inbox'}`
}

/** What has to happen on Google Calendar for the tasks that need it (in input order). */
export function planCalendarSync(tasks: readonly Task[], projects: readonly Project[]): SyncOp[] {
  const ops: SyncOp[] = []
  for (const task of tasks) {
    if (!(task.gcalDirty || (task.pinnedDay && !task.gcalEventId))) continue
    if (task.pinnedDay) {
      const common = {
        taskId: task.id,
        day: task.pinnedDay,
        summary: eventSummary(task),
        description: eventDescription(task, projects),
      }
      ops.push(
        task.gcalEventId
          ? { kind: 'patch', eventId: task.gcalEventId, ...common }
          : { kind: 'insert', ...common },
      )
    } else if (task.gcalEventId) {
      ops.push({ kind: 'delete', taskId: task.id, eventId: task.gcalEventId })
    } else {
      ops.push({ kind: 'clear', taskId: task.id })
    }
  }
  return ops
}

/**
 * Execute the operations one after another. Tasks that fail keep their dirty flag (no patch is returned
 * for them) so the next run retries; a 401 aborts the whole run.
 */
export async function runCalendarSync(
  ops: readonly SyncOp[],
  token: string,
  calendarId: string,
): Promise<SyncResult> {
  const result: SyncResult = { patches: [], errors: [], unauthorized: false }
  for (const op of ops) {
    try {
      switch (op.kind) {
        case 'insert': {
          const id = await insertEvent(token, calendarId, op)
          result.patches.push({ taskId: op.taskId, patch: { gcalEventId: id, gcalDirty: false } })
          break
        }
        case 'patch': {
          const id = await patchEvent(token, calendarId, op.eventId, op)
          result.patches.push({ taskId: op.taskId, patch: { gcalEventId: id, gcalDirty: false } })
          break
        }
        case 'delete':
          await deleteEvent(token, calendarId, op.eventId)
          result.patches.push({ taskId: op.taskId, patch: { gcalEventId: null, gcalDirty: false } })
          break
        case 'clear':
          result.patches.push({ taskId: op.taskId, patch: { gcalEventId: null, gcalDirty: false } })
          break
      }
    } catch (e) {
      result.errors.push({ taskId: op.taskId, message: errorMessage(e) })
      if (e instanceof GcalApiError && e.status === 401) {
        result.unauthorized = true
        break
      }
    }
  }
  return result
}

/** Insert and patch are interchangeable here: both leave an event with this content. */
const signature = (op: SyncOp): string =>
  op.kind === 'insert' || op.kind === 'patch' ? `event|${op.day}|${op.summary}|${op.description}` : op.kind

/**
 * Patches are computed from the tasks as they were when the run started. If a task changed in the
 * meantime (renamed, unpinned, completed …), keep it dirty so the next run pushes the newer state.
 * Tasks that no longer exist are dropped.
 */
export function reconcilePatches(
  result: SyncResult,
  executed: readonly SyncOp[],
  currentTasks: readonly Task[],
  projects: readonly Project[],
): TaskSyncPatch[] {
  const byId = new Map(currentTasks.map((t) => [t.id, t]))
  const opById = new Map(executed.map((o) => [o.taskId, o]))
  const out: TaskSyncPatch[] = []
  for (const { taskId, patch } of result.patches) {
    const current = byId.get(taskId)
    if (!current) continue
    const done = opById.get(taskId)
    const fresh: SyncOp = planCalendarSync([current], projects)[0] ?? { kind: 'clear', taskId }
    const changed = !!done && signature(fresh) !== signature(done)
    out.push({ taskId, patch: changed ? { ...patch, gcalDirty: true } : patch })
  }
  return out
}
