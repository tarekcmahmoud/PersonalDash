import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  connect,
  createTokenStore,
  disconnect,
  getAuthState,
  getValidToken,
  invalidateToken,
  reconnect,
  subscribeAuth,
  type GoogleTokenResponse,
} from './auth'

class MemoryStorage {
  data = new Map<string, string>()
  getItem(k: string) {
    return this.data.get(k) ?? null
  }
  setItem(k: string, v: string) {
    this.data.set(k, v)
  }
  removeItem(k: string) {
    this.data.delete(k)
  }
}

describe('token store', () => {
  it('returns a stored token until shortly before it expires', () => {
    let now = 1_000_000
    const store = createTokenStore(new MemoryStorage(), () => now)
    expect(store.get()).toBeNull()
    store.set({ accessToken: 'abc', expiresAt: now + 3_600_000 })
    expect(store.get()?.accessToken).toBe('abc')
    now += 3_600_000 - 61_000 // 61s before expiry: still usable
    expect(store.get()?.accessToken).toBe('abc')
    now += 2_000 // inside the 60s safety margin
    expect(store.get()).toBeNull()
  })

  it('forgets expired tokens, including in storage', () => {
    let now = 0
    const storage = new MemoryStorage()
    const store = createTokenStore(storage, () => now)
    store.set({ accessToken: 'abc', expiresAt: 100_000 })
    expect(storage.data.size).toBe(1)
    now = 200_000
    expect(store.get()).toBeNull()
    expect(storage.data.size).toBe(0)
  })

  it('restores a valid token from storage in a new page load, and ignores an expired one', () => {
    const storage = new MemoryStorage()
    createTokenStore(storage, () => 0).set({ accessToken: 'abc', expiresAt: 3_600_000 })
    expect(createTokenStore(storage, () => 1000).get()?.accessToken).toBe('abc')
    expect(createTokenStore(storage, () => 3_600_000).get()).toBeNull()
  })

  it('clear() removes the token everywhere', () => {
    const storage = new MemoryStorage()
    const store = createTokenStore(storage, () => 0)
    store.set({ accessToken: 'abc', expiresAt: 3_600_000 })
    store.clear()
    expect(store.get()).toBeNull()
    expect(storage.data.size).toBe(0)
  })

  it('survives corrupt or unavailable storage', () => {
    const corrupt = new MemoryStorage()
    corrupt.setItem('personaldash.gcal.token', '{nope')
    expect(createTokenStore(corrupt).get()).toBeNull()

    const throwing = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
      removeItem: () => {
        throw new Error('blocked')
      },
    }
    const store = createTokenStore(throwing, () => 0)
    expect(store.get()).toBeNull()
    store.set({ accessToken: 'abc', expiresAt: 3_600_000 })
    expect(store.get()?.accessToken).toBe('abc') // memory copy still works
    expect(() => store.clear()).not.toThrow()
    expect(createTokenStore(null).get()).toBeNull()
  })
})

describe('connect / reconnect / disconnect', () => {
  const requests: { prompt?: string }[] = []
  let respond: (cb: (r: GoogleTokenResponse) => void, errCb?: (e: { type?: string }) => void) => void
  const revoke = vi.fn((_token: string, done?: () => void) => done?.())

  beforeEach(() => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'client-123')
    requests.length = 0
    respond = (cb) => cb({ access_token: 'tok-1', expires_in: 3599 })
    window.google = {
      accounts: {
        oauth2: {
          initTokenClient: ({ client_id, scope, callback, error_callback }) => {
            expect(client_id).toBe('client-123')
            expect(scope).toContain('calendar.events.readonly')
            expect(scope).toContain('calendar.app.created')
            return {
              requestAccessToken: (o) => {
                requests.push(o ?? {})
                respond(callback, error_callback)
              },
            }
          },
          revoke,
        },
      },
    }
  })

  afterEach(async () => {
    invalidateToken()
    delete window.google
    vi.unstubAllEnvs()
    revoke.mockClear()
  })

  it('connect() asks for consent and stores a token that status subscribers see', async () => {
    const seen: boolean[] = []
    const off = subscribeAuth(() => seen.push(getAuthState().hasToken))
    expect(getAuthState().configured).toBe(true)
    expect(getAuthState().hasToken).toBe(false)

    await expect(connect()).resolves.toBe(true)

    expect(requests).toEqual([{ prompt: 'consent' }])
    expect(getValidToken()).toBe('tok-1')
    expect(getAuthState()).toMatchObject({ hasToken: true, busy: false, error: null })
    expect(seen).toContain(true)
    off()
  })

  it('reconnect() asks without forcing the consent screen', async () => {
    await expect(reconnect()).resolves.toBe(true)
    expect(requests).toEqual([{ prompt: '' }])
  })

  it('reports Google errors as state, never throws', async () => {
    respond = (cb) => cb({ error: 'access_denied' })
    await expect(connect()).resolves.toBe(false)
    expect(getValidToken()).toBeNull()
    expect(getAuthState().error).toMatch(/denied/i)

    respond = (_cb, errCb) => errCb?.({ type: 'popup_closed' })
    await expect(connect()).resolves.toBe(false)
    expect(getAuthState().error).toMatch(/closed/i)
    expect(getAuthState().busy).toBe(false)
  })

  it('fails with a message when the client id is not configured', async () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', '')
    expect(getAuthState().configured).toBe(false)
    await expect(connect()).resolves.toBe(false)
    expect(getAuthState().error).toMatch(/not configured/i)
    expect(requests).toEqual([])
  })

  it('disconnect() revokes the token and forgets it', async () => {
    await connect()
    await disconnect()
    expect(revoke).toHaveBeenCalledWith('tok-1', expect.any(Function))
    expect(getValidToken()).toBeNull()
    expect(getAuthState().hasToken).toBe(false)
  })

  it('invalidateToken() (a 401) flips the state to no token', async () => {
    await connect()
    invalidateToken()
    expect(getAuthState().hasToken).toBe(false)
  })

  it('notifies subscribers when the token expires', async () => {
    vi.useFakeTimers()
    try {
      respond = (cb) => cb({ access_token: 'short', expires_in: 120 }) // 120s, minus the 60s margin
      const seen: boolean[] = []
      const off = subscribeAuth(() => seen.push(getAuthState().hasToken))
      await connect()
      expect(getAuthState().hasToken).toBe(true)
      vi.advanceTimersByTime(61_000)
      expect(getAuthState().hasToken).toBe(false)
      expect(seen.at(-1)).toBe(false)
      off()
    } finally {
      vi.useRealTimers()
    }
  })
})
