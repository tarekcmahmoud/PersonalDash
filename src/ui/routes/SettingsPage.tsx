import { Button, Checkbox, Flash, FormControl, Label, Spinner, Text, TextInput } from '@primer/react'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useApply, usePlanContext, useSnapshot } from '../../data/hooks'
import { useServices } from '../../data/services'
import { weekCapacity } from '../../domain/capacity'
import type { Settings, Weekday } from '../../domain/types'
import { WEEKDAYS } from '../../domain/types'
import { preloadGis } from '../../integrations/gcal/auth'
import { requestSync, useSyncStatus } from '../../integrations/gcal/syncControl'
import { useGcalConnection, type GcalStatus } from '../../integrations/gcal/useGcalConnection'
import { Page } from '../components/Page'
import { Section } from '../plan/Section'
import styles from './SettingsPage.module.css'
import { draftFromSettings, fmtHours, parseDraft, SIZE_KEYS, type SettingsDraft } from './SettingsPage.form'

const DAY_LABELS: Record<Weekday, { short: string; long: string }> = {
  mon: { short: 'Mon', long: 'Monday' },
  tue: { short: 'Tue', long: 'Tuesday' },
  wed: { short: 'Wed', long: 'Wednesday' },
  thu: { short: 'Thu', long: 'Thursday' },
  fri: { short: 'Fri', long: 'Friday' },
  sat: { short: 'Sat', long: 'Saturday' },
  sun: { short: 'Sun', long: 'Sunday' },
}

export function SettingsPage() {
  const { data: snapshot, isError } = useSnapshot()
  return (
    <Page title="Settings" description="Working hours, capacity, limits and integrations.">
      {snapshot ? (
        <div className={styles.stack}>
          <SettingsForm settings={snapshot.settings} />
          <GoogleCalendarSection />
          <AccountSection />
        </div>
      ) : isError ? (
        <Flash variant="danger">Could not load your settings.</Flash>
      ) : (
        <Spinner aria-label="Loading settings" />
      )}
    </Page>
  )
}

// ---------------------------------------------------------------------------------------------

function FieldError({ children }: { children?: string }) {
  return children ? (
    <p className={styles.fieldError} role="alert">
      {children}
    </p>
  ) : null
}

function SettingsForm({ settings }: { settings: Settings }) {
  const apply = useApply()
  const ctx = usePlanContext()
  const [draft, setDraft] = useState<SettingsDraft>(() => draftFromSettings(settings))
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const baseline = useMemo(() => JSON.stringify(draftFromSettings(settings)), [settings])
  const dirty = JSON.stringify(draft) !== baseline
  const { settings: parsed, errors, valid } = useMemo(() => parseDraft(draft, settings), [draft, settings])

  const edit = (update: (d: SettingsDraft) => SettingsDraft) => {
    setDraft(update)
    setSaved(false)
    setSaveError(null)
  }
  const setDay = (day: Weekday, patch: Partial<SettingsDraft['days'][Weekday]>) =>
    edit((d) => ({ ...d, days: { ...d.days, [day]: { ...d.days[day], ...patch } } }))

  const example = useMemo(() => {
    if (!ctx) return null
    return weekCapacity(ctx.weekStart, parsed, ctx.events, null)
  }, [ctx, parsed])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!valid || !dirty || saving) return
    setSaving(true)
    setSaveError(null)
    try {
      await apply({ kind: 'saveSettings', settings: parsed })
      setDraft(draftFromSettings(parsed))
      setSaved(true)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not save settings')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className={styles.stack} aria-label="Planning settings" noValidate>
      <Section title="Working hours">
        <div className={styles.fields}>
          <p className={styles.help}>The hours you can work each day. Days that are off add no capacity.</p>
          {WEEKDAYS.map((d) => {
            const day = draft.days[d]
            const label = DAY_LABELS[d]
            return (
              <div key={d} className={styles.dayRow}>
                <label className={styles.dayName}>
                  <Checkbox
                    checked={day.on}
                    onChange={(e) => setDay(d, { on: e.target.checked })}
                    aria-label={`${label.long} is a working day`}
                  />
                  {label.short}
                </label>
                {day.on ? (
                  <>
                    <TextInput
                      block
                      type="time"
                      aria-label={`${label.long} start time`}
                      value={day.start}
                      validationStatus={errors[`day.${d}`] ? 'error' : undefined}
                      onChange={(e) => setDay(d, { start: e.target.value })}
                    />
                    <TextInput
                      block
                      type="time"
                      aria-label={`${label.long} end time`}
                      value={day.end}
                      validationStatus={errors[`day.${d}`] ? 'error' : undefined}
                      onChange={(e) => setDay(d, { end: e.target.value })}
                    />
                  </>
                ) : (
                  <span className={styles.dayOff}>Day off</span>
                )}
                {errors[`day.${d}`] && (
                  <p className={styles.dayError} role="alert">
                    {errors[`day.${d}`]}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      </Section>

      <Section title="Focus factor">
        <div className={styles.fields}>
          <FormControl>
            <FormControl.Label>Share of free time you can plan work into</FormControl.Label>
            <TextInput
              type="number"
              inputMode="decimal"
              min={10}
              max={100}
              step={1}
              trailingVisual="%"
              className={styles.numberInput}
              value={draft.focusPct}
              validationStatus={errors.focus ? 'error' : undefined}
              onChange={(e) => edit((d) => ({ ...d, focusPct: e.target.value }))}
            />
            <FormControl.Caption>
              Capacity = (working hours − meeting hours) × focus factor. The rest is buffer for email,
              interruptions and things that overrun.
            </FormControl.Caption>
          </FormControl>
          <FieldError>{errors.focus}</FieldError>
          {example && (
            <p className={styles.example} aria-live="polite" data-testid="capacity-example">
              This week: {fmtHours(example.workHours)}h work − {fmtHours(example.meetingHours)}h meetings →{' '}
              <strong>{fmtHours(example.capacity)}h capacity</strong>
            </p>
          )}
        </div>
      </Section>

      <Section title="Task sizes">
        <div className={styles.fields}>
          <p className={styles.help}>How many hours a task of each size counts for when planning a week.</p>
          <div className={styles.sizeGrid}>
            {SIZE_KEYS.map((k) => (
              <FormControl key={k}>
                <FormControl.Label>Size {k}</FormControl.Label>
                <TextInput
                  block
                  type="number"
                  inputMode="decimal"
                  min={0.25}
                  step={0.25}
                  trailingVisual="h"
                  value={draft.sizeHours[k]}
                  validationStatus={errors[`size.${k}`] ? 'error' : undefined}
                  onChange={(e) =>
                    edit((d) => ({ ...d, sizeHours: { ...d.sizeHours, [k]: e.target.value } }))
                  }
                />
              </FormControl>
            ))}
          </div>
          {SIZE_KEYS.map((k) => (
            <FieldError key={k}>{errors[`size.${k}`] && `Size ${k}: ${errors[`size.${k}`]}`}</FieldError>
          ))}
        </div>
      </Section>

      <Section title="Projects">
        <div className={styles.fields}>
          <div className={styles.twoCol}>
            <FormControl>
              <FormControl.Label>Active project cap</FormControl.Label>
              <TextInput
                block
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                value={draft.activeCap}
                validationStatus={errors.activeCap ? 'error' : undefined}
                onChange={(e) => edit((d) => ({ ...d, activeCap: e.target.value }))}
              />
              <FormControl.Caption>Warn when more projects than this are active.</FormControl.Caption>
            </FormControl>
            <FormControl>
              <FormControl.Label>Deadline warning</FormControl.Label>
              <TextInput
                block
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                trailingVisual="days"
                value={draft.deadlineDays}
                validationStatus={errors.deadlineDays ? 'error' : undefined}
                onChange={(e) => edit((d) => ({ ...d, deadlineDays: e.target.value }))}
              />
              <FormControl.Caption>A target date this close counts as approaching.</FormControl.Caption>
            </FormControl>
          </div>
          <FieldError>{errors.activeCap && `Active project cap: ${errors.activeCap}`}</FieldError>
          <FieldError>{errors.deadlineDays && `Deadline warning: ${errors.deadlineDays}`}</FieldError>
        </div>
      </Section>

      <div className={styles.saveBar}>
        <Button type="submit" variant="primary" disabled={!dirty || !valid || saving} loading={saving}>
          Save settings
        </Button>
        {dirty && !saving && (
          <span className={styles.dirtyNote}>
            {valid ? 'Unsaved changes' : 'Fix the highlighted fields to save'}
          </span>
        )}
        {dirty && (
          <Button
            variant="invisible"
            onClick={() => {
              setDraft(draftFromSettings(settings))
              setSaved(false)
            }}
          >
            Discard
          </Button>
        )}
      </div>
      {saved && !dirty && <Flash variant="success">Settings saved.</Flash>}
      {saveError && <Flash variant="danger">{saveError}</Flash>}
    </form>
  )
}

// ---------------------------------------------------------------------------------------------

const STATUS_LABEL: Record<
  GcalStatus,
  { text: string; variant: 'default' | 'success' | 'attention' | 'secondary' }
> = {
  not_configured: { text: 'Not configured', variant: 'secondary' },
  not_connected: { text: 'Not connected', variant: 'default' },
  connected: { text: 'Connected', variant: 'success' },
  needs_reconnect: { text: 'Needs reconnect', variant: 'attention' },
}

const formatTime = (ms: number): string =>
  new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

function GoogleCalendarSection() {
  const conn = useGcalConnection()
  const sync = useSyncStatus()
  const { status } = conn
  const label = STATUS_LABEL[status]

  useEffect(() => {
    preloadGis()
  }, [])

  let actions: ReactNode
  if (status === 'not_connected' || status === 'not_configured') {
    actions = (
      <Button
        variant="primary"
        disabled={status === 'not_configured' || conn.busy}
        onClick={() => void conn.connect()}
      >
        Connect Google Calendar
      </Button>
    )
  } else {
    actions = (
      <>
        {status === 'needs_reconnect' ? (
          <Button variant="primary" disabled={conn.busy} onClick={() => void conn.reconnect()}>
            Reconnect calendar
          </Button>
        ) : (
          <Button disabled={sync.running} onClick={requestSync}>
            {sync.running ? 'Syncing…' : 'Sync now'}
          </Button>
        )}
        <Button variant="danger" disabled={conn.busy} onClick={() => void conn.disconnect()}>
          Disconnect
        </Button>
      </>
    )
  }

  return (
    <Section title="Google Calendar">
      <div className={styles.fields}>
        <div className={styles.statusRow}>
          <Text weight="semibold">Status</Text>
          <Label variant={label.variant}>{label.text}</Label>
          {conn.busy && <Spinner size="small" aria-label="Waiting for Google" />}
        </div>
        <p className={styles.help}>
          Reads your primary calendar to show events in Today and Week, and counts busy meetings against your
          weekly capacity. Tasks pinned to a day are written as all-day events, only to a separate calendar
          named “PersonalDash”. Your other calendars are never changed.
        </p>
        {status === 'not_configured' && (
          <Flash variant="warning">
            Google Calendar is not configured: <span className={styles.mono}>VITE_GOOGLE_CLIENT_ID</span> is
            missing. See <span className={styles.mono}>docs/setup.md</span> for how to create a client ID.
          </Flash>
        )}
        {status === 'needs_reconnect' && (
          <p className={styles.help}>
            Google access lasts about an hour per session. Reconnect to resume reading and syncing; it is
            usually instant.
          </p>
        )}
        {conn.error && <Flash variant="danger">{conn.error}</Flash>}
        <div className={styles.actions}>{actions}</div>
        {status === 'connected' && sync.error && <Flash variant="danger">Sync failed: {sync.error}</Flash>}
        {status === 'connected' && !sync.error && sync.lastSyncedAt && (
          <p className={styles.help}>Last synced at {formatTime(sync.lastSyncedAt)}.</p>
        )}
      </div>
    </Section>
  )
}

// ---------------------------------------------------------------------------------------------

function AccountSection() {
  const { auth } = useServices()
  const user = useQuery({ queryKey: ['auth-user'], queryFn: () => auth.currentUser() })
  const [signingOut, setSigningOut] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function signOut() {
    setSigningOut(true)
    setError(null)
    try {
      await auth.signOut()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign-out failed')
      setSigningOut(false)
    }
  }

  return (
    <Section title="Account">
      <div className={styles.accountRow}>
        <span>
          Signed in as <span className={styles.email}>{user.data?.email ?? '…'}</span>
        </span>
        <Button onClick={() => void signOut()} disabled={signingOut}>
          Sign out
        </Button>
      </div>
      {error && <Flash variant="danger">{error}</Flash>}
    </Section>
  )
}
