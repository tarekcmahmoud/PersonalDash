// Google Identity Services (token model) wrapper. Browser-only: no backend, no refresh tokens.
// Access tokens live ~1h and are kept in memory + sessionStorage with an expiry; once expired the user
// re-grants with a click ("Reconnect calendar"), which is usually instant after the first consent.

export const GCAL_SCOPES = [
  'https://www.googleapis.com/auth/calendar.events.readonly',
  'https://www.googleapis.com/auth/calendar.app.created',
].join(' ')

const GIS_SRC = 'https://accounts.google.com/gsi/client'
const STORAGE_KEY = 'personaldash.gcal.token'
/** Treat a token as expired this long before Google does, so requests never race the expiry. */
const EXPIRY_MARGIN_MS = 60_000

// ---------------------------------------------------------------------------------------------
// Minimal typing of the `google` global (no @types package).

export interface GoogleTokenResponse {
  access_token?: string
  expires_in?: number | string
  scope?: string
  error?: string
  error_description?: string
}
interface GoogleTokenClient {
  requestAccessToken(overrides?: { prompt?: string }): void
}
interface GoogleOAuth2 {
  initTokenClient(config: {
    client_id: string
    scope: string
    callback: (response: GoogleTokenResponse) => void
    error_callback?: (error: { type?: string; message?: string }) => void
  }): GoogleTokenClient
  revoke(accessToken: string, done?: () => void): void
  hasGrantedAllScopes?(response: GoogleTokenResponse, ...scopes: string[]): boolean
}
declare global {
  interface Window {
    google?: { accounts?: { oauth2?: GoogleOAuth2 } }
  }
}

// ---------------------------------------------------------------------------------------------
// Token store: memory + sessionStorage, with expiry.

export interface StoredToken {
  accessToken: string
  /** Epoch ms. */
  expiresAt: number
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export interface TokenStore {
  /** The token if it is still valid (with a safety margin); otherwise null (and it is forgotten). */
  get(): StoredToken | null
  set(token: StoredToken): void
  clear(): void
}

export function createTokenStore(
  storage: StorageLike | null,
  now: () => number = () => Date.now(),
): TokenStore {
  let memory: StoredToken | null | undefined // undefined = not read from storage yet

  const isValid = (t: StoredToken): boolean => t.expiresAt - EXPIRY_MARGIN_MS > now()

  function read(): StoredToken | null {
    try {
      const raw = storage?.getItem(STORAGE_KEY)
      if (!raw) return null
      const parsed = JSON.parse(raw) as Partial<StoredToken>
      if (typeof parsed.accessToken === 'string' && typeof parsed.expiresAt === 'number') {
        return { accessToken: parsed.accessToken, expiresAt: parsed.expiresAt }
      }
    } catch {
      // unreadable storage / corrupt value: behave as signed out
    }
    return null
  }

  function forget(): void {
    memory = null
    try {
      storage?.removeItem(STORAGE_KEY)
    } catch {
      // ignore
    }
  }

  return {
    get() {
      if (memory === undefined) memory = read()
      if (memory && !isValid(memory)) forget()
      return memory
    },
    set(token) {
      memory = token
      try {
        storage?.setItem(STORAGE_KEY, JSON.stringify(token))
      } catch {
        // storage unavailable: the in-memory copy still works for this page load
      }
    },
    clear: forget,
  }
}

function safeSessionStorage(): StorageLike | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage
  } catch {
    return null
  }
}

const store = createTokenStore(safeSessionStorage())

// ---------------------------------------------------------------------------------------------
// Observable auth state.

export interface GcalAuthState {
  /** VITE_GOOGLE_CLIENT_ID is set. */
  configured: boolean
  /** A non-expired access token is available. */
  hasToken: boolean
  /** Epoch ms when the current token stops being usable (0 without a token). */
  expiresAt: number
  /** A connect/reconnect is in flight. */
  busy: boolean
  /** Message from the last failed attempt; cleared by the next attempt. */
  error: string | null
}

export function getClientId(): string | null {
  const id = import.meta.env.VITE_GOOGLE_CLIENT_ID
  return typeof id === 'string' && id.trim() !== '' ? id.trim() : null
}
export const isGcalConfigured = (): boolean => getClientId() !== null

let busy = false
let error: string | null = null
let cached: GcalAuthState | null = null
let expiryTimer: ReturnType<typeof setTimeout> | undefined
const listeners = new Set<() => void>()

function computeState(): GcalAuthState {
  const token = store.get()
  return {
    configured: isGcalConfigured(),
    hasToken: token !== null,
    expiresAt: token?.expiresAt ?? 0,
    busy,
    error,
  }
}

function sameState(a: GcalAuthState, b: GcalAuthState): boolean {
  return (
    a.configured === b.configured &&
    a.hasToken === b.hasToken &&
    a.expiresAt === b.expiresAt &&
    a.busy === b.busy &&
    a.error === b.error
  )
}

function scheduleExpiry(): void {
  clearTimeout(expiryTimer)
  const token = store.get()
  if (!token || listeners.size === 0) return
  const ms = Math.min(token.expiresAt - EXPIRY_MARGIN_MS - Date.now() + 50, 2_000_000_000)
  expiryTimer = setTimeout(emit, Math.max(ms, 0))
}

function emit(): void {
  cached = computeState()
  scheduleExpiry()
  for (const l of [...listeners]) l()
}

/** Current state; referentially stable until something changes (safe for useSyncExternalStore). */
export function getAuthState(): GcalAuthState {
  const fresh = computeState()
  if (!cached || !sameState(cached, fresh)) cached = fresh
  return cached
}

/** Subscribe to status changes (token acquired / expired / invalidated, busy, error). */
export function subscribeAuth(listener: () => void): () => void {
  listeners.add(listener)
  scheduleExpiry()
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) clearTimeout(expiryTimer)
  }
}

/** The current access token, or null when there is none or it has expired. Never throws. */
export function getValidToken(): string | null {
  return store.get()?.accessToken ?? null
}

/** Called by the API layer on a 401: forget the token so the UI offers "Reconnect". */
export function invalidateToken(): void {
  store.clear()
  emit()
}

function setStatus(next: { busy?: boolean; error?: string | null }): void {
  if (next.busy !== undefined) busy = next.busy
  if (next.error !== undefined) error = next.error
  emit()
}

// ---------------------------------------------------------------------------------------------
// GIS script + token requests.

let gisPromise: Promise<void> | null = null

const gisReady = (): boolean => typeof window !== 'undefined' && !!window.google?.accounts?.oauth2

/** Load the GIS client script once. Resolves when `google.accounts.oauth2` is usable; rejects on failure. */
export function loadGis(): Promise<void> {
  if (gisReady()) return Promise.resolve()
  gisPromise ??= new Promise<void>((resolve, reject) => {
    const fail = (message: string) => {
      gisPromise = null
      reject(new Error(message))
    }
    const script = document.createElement('script')
    script.src = GIS_SRC
    script.async = true
    script.defer = true
    script.onload = () => (gisReady() ? resolve() : fail('Google sign-in did not initialise'))
    script.onerror = () => {
      script.remove()
      fail('Could not load Google sign-in (offline, or blocked by an extension?)')
    }
    document.head.appendChild(script)
  })
  return gisPromise
}

/**
 * Warm up the GIS script so a later button click can open the popup synchronously
 * (browsers only allow popups right after a user gesture).
 */
export function preloadGis(): void {
  if (isGcalConfigured()) loadGis().catch(() => undefined)
}

function describeError(type: string | undefined, fallback: string): string {
  switch (type) {
    case 'popup_closed':
      return 'The Google window was closed before finishing.'
    case 'popup_failed_to_open':
      return 'The browser blocked the Google popup. Allow popups for this site and try again.'
    case 'access_denied':
      return 'Access was denied.'
    default:
      return fallback
  }
}

let inFlight: Promise<boolean> | null = null

/** Ask Google for an access token. Resolves true on success; failures set `error` and resolve false. */
function requestToken(prompt: '' | 'consent'): Promise<boolean> {
  if (inFlight) return inFlight
  const run = async (): Promise<boolean> => {
    const clientId = getClientId()
    if (!clientId) {
      setStatus({
        busy: false,
        error: 'Google Calendar is not configured (VITE_GOOGLE_CLIENT_ID is missing).',
      })
      return false
    }
    setStatus({ busy: true, error: null })
    try {
      // Only await when the script is not there yet: awaiting would burn the click's user activation.
      if (!gisReady()) await loadGis()
      const oauth2 = window.google!.accounts!.oauth2!
      return await new Promise<boolean>((resolve) => {
        const fail = (message: string) => {
          setStatus({ error: message })
          resolve(false)
        }
        try {
          const client = oauth2.initTokenClient({
            client_id: clientId,
            scope: GCAL_SCOPES,
            callback: (response) => {
              if (response.error || !response.access_token) {
                return fail(
                  describeError(response.error, response.error_description || 'Google did not grant access.'),
                )
              }
              const scopesOk = oauth2.hasGrantedAllScopes?.(response, ...GCAL_SCOPES.split(' ')) ?? true
              if (!scopesOk) {
                return fail('Calendar permissions were not granted. Tick all the requested boxes and retry.')
              }
              const seconds = Number(response.expires_in)
              const ttlMs = (Number.isFinite(seconds) && seconds > 0 ? seconds : 3600) * 1000
              store.set({ accessToken: response.access_token, expiresAt: Date.now() + ttlMs })
              resolve(true)
            },
            error_callback: (err) => fail(describeError(err.type, err.message || 'Google sign-in failed.')),
          })
          client.requestAccessToken({ prompt })
        } catch (e) {
          fail(e instanceof Error ? e.message : 'Google sign-in failed.')
        }
      })
    } catch (e) {
      setStatus({ error: e instanceof Error ? e.message : 'Google sign-in failed.' })
      return false
    } finally {
      setStatus({ busy: false })
    }
  }
  const pending: Promise<boolean> = run().finally(() => {
    if (inFlight === pending) inFlight = null
  })
  inFlight = pending
  return pending
}

/** First connection: opens Google's consent popup. Must be called from a click handler. */
export function connect(): Promise<boolean> {
  return requestToken('consent')
}

/** New token for an already-consented user (usually instant). Must be called from a click handler. */
export function reconnect(): Promise<boolean> {
  return requestToken('')
}

/** Revoke the token at Google (best effort) and forget it locally. Never throws. */
export async function disconnect(): Promise<void> {
  const token = getValidToken()
  store.clear()
  emit()
  if (!token || !gisReady()) return
  await new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, 3000)
    try {
      window.google!.accounts!.oauth2!.revoke(token, () => {
        clearTimeout(timer)
        resolve()
      })
    } catch {
      clearTimeout(timer)
      resolve()
    }
  })
}
