import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { SNAPSHOT_KEY, useApply, useSnapshot, useUpdateTasks } from '../../data/hooks'
import type { Snapshot } from '../../domain/types'
import { calendarExists, createPersonalDashCalendar, deleteEvent, errorMessage } from './api'
import { getValidToken, preloadGis } from './auth'
import { planCalendarSync, reconcilePatches, runCalendarSync } from './sync'
import { getSyncStatus, setSyncStatus, useSyncStatus } from './syncControl'
import { CALENDAR_EVENTS_KEY } from './useCalendarEvents'
import { useGcalAuth } from './useGcalAuth'
import { useGcalConnection } from './useGcalConnection'

const DEBOUNCE_MS = 1500
const RETRY_MS = 60_000

/**
 * Render-nothing orchestrator. While the calendar is connected and a token is valid it makes sure the
 * "PersonalDash" calendar exists and pushes pinned tasks that are dirty or not yet synced. Mount once,
 * inside the services/query providers (e.g. in AppShell).
 */
export function CalendarSync() {
  const qc = useQueryClient()
  const { data: snapshot } = useSnapshot()
  const { hasToken } = useGcalAuth()
  const { nonce } = useSyncStatus()
  const apply = useApply()
  const updateTasks = useUpdateTasks()

  const connected = !!snapshot?.settings.calendarConnected
  const active = connected && hasToken
  const calendarId = snapshot?.settings.gcalCalendarId ?? null

  const ops = useMemo(() => (snapshot ? planCalendarSync(snapshot.tasks, snapshot.projects) : []), [snapshot])
  // A stable key so unrelated snapshot changes do not restart the debounce.
  const opsKey = useMemo(() => JSON.stringify(ops), [ops])

  const running = useRef(false)
  const rerun = useRef(false)
  const verifiedCalendar = useRef<string | null>(null)
  const retryTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const apis = useRef({ apply, updateTasks, qc })
  useEffect(() => {
    apis.current = { apply, updateTasks, qc }
  })

  const runRef = useRef<() => Promise<void>>(async () => undefined)
  useEffect(() => {
    /** One pass: ensure the calendar, then execute whatever the *current* snapshot needs. */
    async function runOnce(): Promise<void> {
      const token = getValidToken()
      const current = apis.current.qc.getQueryData<Snapshot>(SNAPSHOT_KEY)
      if (!token || !current?.settings.calendarConnected) return

      let id = current.settings.gcalCalendarId
      if (id && verifiedCalendar.current !== id) {
        if (await calendarExists(token, id)) verifiedCalendar.current = id
        else id = null // deleted in Google Calendar: create it again (events are re-inserted on 404)
      }
      if (!id) {
        id = await createPersonalDashCalendar(token)
        verifiedCalendar.current = id
        const latest = apis.current.qc.getQueryData<Snapshot>(SNAPSHOT_KEY)?.settings ?? current.settings
        await apis.current.apply({ kind: 'saveSettings', settings: { ...latest, gcalCalendarId: id } })
      }

      const fresh = apis.current.qc.getQueryData<Snapshot>(SNAPSHOT_KEY) ?? current
      const pending = planCalendarSync(fresh.tasks, fresh.projects)
      if (pending.length === 0) return

      const result = await runCalendarSync(pending, token, id)
      const after = apis.current.qc.getQueryData<Snapshot>(SNAPSHOT_KEY) ?? fresh
      const patches = reconcilePatches(result, pending, after.tasks, after.projects)
      const byId = new Map(after.tasks.map((t) => [t.id, t]))
      const updates = patches.flatMap(({ taskId, patch }) => {
        const task = byId.get(taskId)
        return task ? [{ task, patch }] : []
      })
      if (updates.length > 0) await apis.current.updateTasks(updates)
      if (result.errors.length > 0) throw new Error(result.errors[0]!.message)
    }

    async function run(): Promise<void> {
      if (running.current) {
        rerun.current = true
        return
      }
      running.current = true
      clearTimeout(retryTimer.current)
      setSyncStatus({ running: true })
      try {
        do {
          rerun.current = false
          await runOnce()
        } while (rerun.current)
        setSyncStatus({ running: false, error: null, lastSyncedAt: Date.now() })
      } catch (e) {
        setSyncStatus({ running: false, error: errorMessage(e) })
        // Network or server hiccup: try again later. (A 401 drops the token, which deactivates us.)
        if (getValidToken()) retryTimer.current = setTimeout(() => void runRef.current(), RETRY_MS)
      } finally {
        running.current = false
      }
    }
    runRef.current = run
  }, [])

  // Debounced sync whenever there is something to push (or the calendar still needs creating).
  const needsCalendar = active && !calendarId
  useEffect(() => {
    if (!active || (opsKey === '[]' && !needsCalendar)) return
    const timer = setTimeout(() => void runRef.current(), DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [active, opsKey, needsCalendar])

  // "Sync now" from Settings: immediately, and refresh the displayed events too.
  const seenNonce = useRef(nonce)
  useEffect(() => {
    if (nonce === seenNonce.current) return
    seenNonce.current = nonce
    if (!active) return
    void qc.invalidateQueries({ queryKey: CALENDAR_EVENTS_KEY })
    void runRef.current()
  }, [nonce, active, qc])

  // Deleted tasks (or whole projects/milestones) never reach the sync planner, so remove their events here:
  // compare the event ids of the previous snapshot with the current one. Best effort.
  const knownEvents = useRef<Map<string, string> | null>(null)
  useEffect(() => {
    if (!snapshot) return
    const current = new Map<string, string>()
    for (const t of snapshot.tasks) if (t.gcalEventId) current.set(t.id, t.gcalEventId)
    const previous = knownEvents.current
    knownEvents.current = current
    if (!previous || !active || !calendarId) return
    const token = getValidToken()
    if (!token) return
    for (const [taskId, eventId] of previous) {
      if (!current.has(taskId) && !snapshot.tasks.some((t) => t.id === taskId)) {
        void deleteEvent(token, calendarId, eventId).catch(() => undefined)
      }
    }
  }, [snapshot, active, calendarId])

  useEffect(() => {
    const timerRef = retryTimer
    return () => clearTimeout(timerRef.current)
  }, [])

  // Leaving the "active" state (token expired, disconnected) clears stale errors and pending retries.
  useEffect(() => {
    if (active) return
    clearTimeout(retryTimer.current)
    if (getSyncStatus().error) setSyncStatus({ error: null })
  }, [active])

  return null
}

/**
 * One quiet line shown only when the calendar is connected but the access token has expired.
 * Mount at the top of the main content area.
 */
export function CalendarReconnectBanner() {
  const { status, busy, error, reconnect } = useGcalConnection()
  useEffect(() => {
    if (status === 'needs_reconnect') preloadGis()
  }, [status])
  if (status !== 'needs_reconnect') return null
  return (
    <p className="text-sm text-muted-foreground" role="status">
      Google Calendar needs reconnecting.{' '}
      <Button variant="link" className="h-auto p-0 text-sm" disabled={busy} onClick={() => void reconnect()}>
        Reconnect
      </Button>
      {error && <span className="ml-2 text-destructive">{error}</span>}
    </p>
  )
}
