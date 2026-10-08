import { useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { SNAPSHOT_KEY, useApply, useSnapshot } from '../../data/hooks'
import type { Settings, Snapshot } from '../../domain/types'
import { connect, disconnect, reconnect } from './auth'
import { CALENDAR_EVENTS_KEY } from './useCalendarEvents'
import { useGcalAuth } from './useGcalAuth'

export type GcalStatus = 'not_configured' | 'not_connected' | 'connected' | 'needs_reconnect'

export interface GcalConnection {
  status: GcalStatus
  /** A connect/reconnect popup is open. */
  busy: boolean
  /** Message from the last failed connect/reconnect. */
  error: string | null
  /** Call from a click handler. Resolves true when connected. */
  connect: () => Promise<boolean>
  /** Call from a click handler. Resolves true when a fresh token was obtained. */
  reconnect: () => Promise<boolean>
  disconnect: () => Promise<void>
}

/** Connection status plus the actions that also keep `settings.calendarConnected` in step. */
export function useGcalConnection(): GcalConnection {
  const { data: snapshot } = useSnapshot()
  const auth = useGcalAuth()
  const apply = useApply()
  const qc = useQueryClient()

  const connected = !!snapshot?.settings.calendarConnected
  const status: GcalStatus = !auth.configured
    ? 'not_configured'
    : !connected
      ? 'not_connected'
      : auth.hasToken
        ? 'connected'
        : 'needs_reconnect'

  const setConnected = useCallback(
    async (value: boolean): Promise<void> => {
      // Read the freshest settings: the user may have edited other settings in the meantime.
      const latest: Settings | undefined = qc.getQueryData<Snapshot>(SNAPSHOT_KEY)?.settings
      if (!latest || latest.calendarConnected === value) return
      await apply({ kind: 'saveSettings', settings: { ...latest, calendarConnected: value } })
    },
    [apply, qc],
  )

  const doConnect = useCallback(async () => {
    const ok = await connect()
    if (!ok) return false
    try {
      await setConnected(true)
    } catch {
      return false
    }
    void qc.invalidateQueries({ queryKey: CALENDAR_EVENTS_KEY })
    return true
  }, [qc, setConnected])

  const doReconnect = useCallback(async () => {
    const ok = await reconnect()
    if (ok) void qc.invalidateQueries({ queryKey: CALENDAR_EVENTS_KEY })
    return ok
  }, [qc])

  const doDisconnect = useCallback(async () => {
    await disconnect()
    qc.removeQueries({ queryKey: CALENDAR_EVENTS_KEY })
    try {
      await setConnected(false)
    } catch {
      // the settings write failed; the token is gone either way
    }
  }, [qc, setConnected])

  return {
    status,
    busy: auth.busy,
    error: auth.error,
    connect: doConnect,
    reconnect: doReconnect,
    disconnect: doDisconnect,
  }
}
