import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { useApply, usePlanContext, useSnapshot } from '../../data/hooks'
import { useServices } from '../../data/services'
import { weekCapacity } from '../../domain/capacity'
import type { Settings, Weekday } from '../../domain/types'
import { WEEKDAYS } from '../../domain/types'
import { preloadGis } from '../../integrations/gcal/auth'
import { requestSync, useSyncStatus } from '../../integrations/gcal/syncControl'
import { useGcalConnection, type GcalStatus } from '../../integrations/gcal/useGcalConnection'
import { Page, Section } from '../components/Page'
import { draftFromSettings, fmtHours, parseDraft, SIZE_KEYS, type SettingsDraft } from './SettingsPage.form'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

const DAY_LABELS: Record<Weekday, { short: string; long: string }> = {
  mon: { short: 'Mon', long: 'Monday' },
  tue: { short: 'Tue', long: 'Tuesday' },
  wed: { short: 'Wed', long: 'Wednesday' },
  thu: { short: 'Thu', long: 'Thursday' },
  fri: { short: 'Fri', long: 'Friday' },
  sat: { short: 'Sat', long: 'Saturday' },
  sun: { short: 'Sun', long: 'Sunday' },
}

/** A settings block: small heading, hairline above (except the first), generous whitespace. */
function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Section title={title} className="mb-0 border-t py-6 first:border-t-0 first:pt-0">
      <div className="mt-3 grid gap-4">{children}</div>
    </Section>
  )
}

const Help = ({ children, className }: { children: ReactNode; className?: string }) => (
  <p className={cn('text-sm text-muted-foreground', className)}>{children}</p>
)

export function SettingsPage() {
  const { data: snapshot, isError } = useSnapshot()
  return (
    <Page title="Settings" description="Working hours, capacity, limits and integrations.">
      {snapshot ? (
        <SettingsForm settings={snapshot.settings}>
          <GoogleCalendarSection />
          <AccountSection />
        </SettingsForm>
      ) : isError ? (
        <p className="text-sm text-destructive">Could not load your settings.</p>
      ) : (
        <div role="status" aria-label="Loading settings" className="grid gap-3">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-40 w-full" />
        </div>
      )}
    </Page>
  )
}

// ---------------------------------------------------------------------------------------------

function FieldError({ children }: { children?: string }) {
  return children ? (
    <p className="text-sm text-destructive" role="alert">
      {children}
    </p>
  ) : null
}

/** Label + grey caption on the left, a short control on the right (stacked on phones). */
function SettingRow({
  htmlFor,
  label,
  caption,
  children,
}: {
  htmlFor: string
  label: string
  caption?: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="min-w-0">
        <Label htmlFor={htmlFor}>{label}</Label>
        {caption && <p className="mt-0.5 text-sm text-muted-foreground">{caption}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2">{children}</div>
    </div>
  )
}

function Unit({ children }: { children: ReactNode }) {
  return <span className="text-sm text-muted-foreground">{children}</span>
}

function SettingsForm({ settings, children }: { settings: Settings; children?: ReactNode }) {
  const apply = useApply()
  const ctx = usePlanContext()
  const [draft, setDraft] = useState<SettingsDraft>(() => draftFromSettings(settings))
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const baseline = useMemo(() => JSON.stringify(draftFromSettings(settings)), [settings])
  const dirty = JSON.stringify(draft) !== baseline
  const { settings: parsed, errors, valid } = useMemo(() => parseDraft(draft, settings), [draft, settings])

  const edit = (update: (d: SettingsDraft) => SettingsDraft) => {
    setDraft(update)
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
      toast.success('Settings saved')
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not save settings')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <form id="settings-form" onSubmit={onSubmit} aria-label="Planning settings" noValidate>
        <Block title="Working hours">
          <Help>The hours you can work each day. Days that are off add no capacity.</Help>
          <div className="divide-y divide-border/60">
            {WEEKDAYS.map((d) => {
              const day = draft.days[d]
              const label = DAY_LABELS[d]
              return (
                <div key={d} className="py-2">
                  <div className="flex min-h-9 items-center gap-3">
                    <label className="flex w-20 shrink-0 max-sm:w-16 cursor-pointer items-center gap-3 text-sm">
                      <Checkbox
                        checked={day.on}
                        onCheckedChange={(v) => setDay(d, { on: v === true })}
                        aria-label={`${label.long} is a working day`}
                      />
                      {label.short}
                    </label>
                    {day.on ? (
                      <div className="flex items-center gap-2">
                        <Input
                          type="time"
                          className="w-[8.5rem] max-sm:w-[6.75rem] max-sm:[&::-webkit-calendar-picker-indicator]:hidden"
                          aria-label={`${label.long} start time`}
                          aria-invalid={errors[`day.${d}`] ? true : undefined}
                          value={day.start}
                          onChange={(e) => setDay(d, { start: e.target.value })}
                        />
                        <span className="text-muted-foreground" aria-hidden>
                          –
                        </span>
                        <Input
                          type="time"
                          className="w-[8.5rem] max-sm:w-[6.75rem] max-sm:[&::-webkit-calendar-picker-indicator]:hidden"
                          aria-label={`${label.long} end time`}
                          aria-invalid={errors[`day.${d}`] ? true : undefined}
                          value={day.end}
                          onChange={(e) => setDay(d, { end: e.target.value })}
                        />
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">Day off</span>
                    )}
                  </div>
                  {errors[`day.${d}`] && (
                    <p
                      className="mt-1 pl-[5.75rem] max-sm:pl-[4.75rem] text-sm text-destructive"
                      role="alert"
                    >
                      {errors[`day.${d}`]}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </Block>

        <Block title="Capacity">
          <SettingRow
            htmlFor="focus-pct"
            label="Share of free time you can plan work into"
            caption="Capacity = (working hours − meeting hours) × this share. The rest is buffer for email, interruptions and things that overrun."
          >
            <Input
              id="focus-pct"
              type="number"
              inputMode="decimal"
              min={10}
              max={100}
              step={1}
              className="w-20"
              value={draft.focusPct}
              aria-invalid={errors.focus ? true : undefined}
              onChange={(e) => edit((d) => ({ ...d, focusPct: e.target.value }))}
            />
            <Unit>%</Unit>
          </SettingRow>
          <FieldError>{errors.focus}</FieldError>
          {example && (
            <p className="text-sm text-muted-foreground" aria-live="polite" data-testid="capacity-example">
              This week: {fmtHours(example.workHours)}h work − {fmtHours(example.meetingHours)}h meetings →{' '}
              <span className="text-foreground">{fmtHours(example.capacity)}h capacity</span>
            </p>
          )}
        </Block>

        <Block title="Task sizes">
          <Help>How many hours a task of each size counts for when planning a week.</Help>
          <div className="flex flex-wrap gap-x-8 gap-y-3">
            {SIZE_KEYS.map((k) => (
              <div key={k} className="flex items-center gap-2">
                <Label htmlFor={`size-${k}`} className="text-muted-foreground">
                  Size {k}
                </Label>
                <Input
                  id={`size-${k}`}
                  type="number"
                  inputMode="decimal"
                  min={0.25}
                  step={0.25}
                  className="w-20"
                  value={draft.sizeHours[k]}
                  aria-invalid={errors[`size.${k}`] ? true : undefined}
                  onChange={(e) =>
                    edit((d) => ({ ...d, sizeHours: { ...d.sizeHours, [k]: e.target.value } }))
                  }
                />
                <Unit>h</Unit>
              </div>
            ))}
          </div>
          {SIZE_KEYS.map((k) => (
            <FieldError key={k}>{errors[`size.${k}`] && `Size ${k}: ${errors[`size.${k}`]}`}</FieldError>
          ))}
        </Block>

        <Block title="Projects">
          <SettingRow
            htmlFor="active-cap"
            label="Active project cap"
            caption="Warn when more projects than this are active."
          >
            <Input
              id="active-cap"
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              className="w-20"
              value={draft.activeCap}
              aria-invalid={errors.activeCap ? true : undefined}
              onChange={(e) => edit((d) => ({ ...d, activeCap: e.target.value }))}
            />
          </SettingRow>
          <FieldError>{errors.activeCap && `Active project cap: ${errors.activeCap}`}</FieldError>
          <SettingRow
            htmlFor="deadline-days"
            label="Deadline warning"
            caption="A target date this close counts as approaching."
          >
            <Input
              id="deadline-days"
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              className="w-20"
              value={draft.deadlineDays}
              aria-invalid={errors.deadlineDays ? true : undefined}
              onChange={(e) => edit((d) => ({ ...d, deadlineDays: e.target.value }))}
            />
            <Unit>days</Unit>
          </SettingRow>
          <FieldError>{errors.deadlineDays && `Deadline warning: ${errors.deadlineDays}`}</FieldError>
        </Block>

        <div className="flex flex-wrap items-center gap-3 md:pb-6 max-md:sticky max-md:bottom-14 max-md:z-[5] max-md:-mx-4 max-md:border-t max-md:bg-background/95 max-md:px-4 max-md:py-3 max-md:backdrop-blur">
          <Button type="submit" disabled={!dirty || !valid || saving}>
            {saving ? 'Saving…' : 'Save settings'}
          </Button>
          {dirty && !saving && (
            <span className="text-sm text-muted-foreground">
              {valid ? 'Unsaved changes' : 'Fix the highlighted fields to save'}
            </span>
          )}
          {dirty && (
            <Button type="button" variant="ghost" onClick={() => setDraft(draftFromSettings(settings))}>
              Discard
            </Button>
          )}
          {saveError && (
            <p className="w-full text-sm text-destructive" role="alert">
              {saveError}
            </p>
          )}
        </div>
      </form>
      {children}
    </div>
  )
}

// ---------------------------------------------------------------------------------------------

const STATUS_LABEL: Record<GcalStatus, { text: string; attention: boolean }> = {
  not_configured: { text: 'Not configured', attention: false },
  not_connected: { text: 'Not connected', attention: false },
  connected: { text: 'Connected', attention: false },
  needs_reconnect: { text: 'Needs reconnect', attention: true },
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
        variant="secondary"
        disabled={status === 'not_configured' || conn.busy}
        onClick={() => void conn.connect()}
      >
        Connect
      </Button>
    )
  } else {
    actions = (
      <>
        {status === 'needs_reconnect' ? (
          <Button variant="outline" disabled={conn.busy} onClick={() => void conn.reconnect()}>
            Reconnect
          </Button>
        ) : (
          <Button variant="outline" disabled={sync.running} onClick={requestSync}>
            {sync.running ? 'Syncing…' : 'Sync now'}
          </Button>
        )}
        <Button variant="ghost" disabled={conn.busy} onClick={() => void conn.disconnect()}>
          Disconnect
        </Button>
      </>
    )
  }

  return (
    <Block title="Google Calendar">
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        {label.attention && <span className="size-1.5 rounded-full bg-warning" aria-hidden />}
        <span>{label.text}</span>
        {conn.busy && <span className="text-muted-foreground/60">· waiting for Google…</span>}
      </p>
      <Help>
        Reads your primary calendar to show events in Today and Week, and counts busy meetings against your
        weekly capacity. Tasks pinned to a day are written as all-day events, only to a separate calendar
        named “PersonalDash”. Your other calendars are never changed.
      </Help>
      {status === 'not_configured' && (
        <Help>
          <span className="font-mono text-xs">VITE_GOOGLE_CLIENT_ID</span> is missing. See{' '}
          <span className="font-mono text-xs">docs/setup.md</span> for how to create a client ID.
        </Help>
      )}
      {status === 'needs_reconnect' && (
        <Help>
          Google access lasts about an hour per session. Reconnect to resume reading and syncing; it is
          usually instant.
        </Help>
      )}
      {conn.error && (
        <p className="text-sm text-destructive" role="alert">
          {conn.error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">{actions}</div>
      {status === 'connected' && sync.error && (
        <p className="text-sm text-destructive" role="alert">
          Sync failed: {sync.error}
        </p>
      )}
      {status === 'connected' && !sync.error && sync.lastSyncedAt && (
        <Help>Last synced at {formatTime(sync.lastSyncedAt)}.</Help>
      )}
    </Block>
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
    <Block title="Account">
      <div className="flex items-center justify-between gap-4">
        <span className="min-w-0 truncate text-sm text-muted-foreground">
          Signed in as <span>{user.data?.email ?? '…'}</span>
        </span>
        <Button variant="ghost" className="-mr-3" onClick={() => void signOut()} disabled={signingOut}>
          Sign out
        </Button>
      </div>
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </Block>
  )
}
