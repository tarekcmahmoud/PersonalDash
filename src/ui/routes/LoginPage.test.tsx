import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import type { AuthService, AuthUser } from '../../data/auth'
import type { Repo } from '../../data/repo'
import { ServicesProvider } from '../../data/services'
import { LoginPage } from './LoginPage'

function fakeAuth(overrides: Partial<AuthService> = {}): AuthService {
  return {
    currentUser: vi.fn().mockResolvedValue(null),
    signIn: vi.fn().mockResolvedValue(undefined),
    signOut: vi.fn().mockResolvedValue(undefined),
    onChange: vi.fn().mockReturnValue(() => {}),
    ...overrides,
  }
}

function renderLogin(
  auth: AuthService,
  initialEntry: string | { pathname: string; state?: unknown } = '/login',
) {
  const repo = {} as Repo
  return render(
    <ServicesProvider services={{ auth, repo }}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<p>Home page</p>} />
          <Route path="/week" element={<p>Week page</p>} />
        </Routes>
      </MemoryRouter>
    </ServicesProvider>,
  )
}

describe('LoginPage', () => {
  it('calls signIn with the entered values and navigates home', async () => {
    const auth = fakeAuth()
    const user = userEvent.setup()
    renderLogin(auth)

    await user.type(screen.getByLabelText(/email/i), 'me@example.com')
    await user.type(screen.getByLabelText(/password/i), 's3cret')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    expect(auth.signIn).toHaveBeenCalledWith('me@example.com', 's3cret')
    expect(await screen.findByText('Home page')).toBeInTheDocument()
  })

  it('returns to the page the user came from', async () => {
    const auth = fakeAuth()
    const user = userEvent.setup()
    renderLogin(auth, { pathname: '/login', state: { from: '/week' } })

    await user.type(screen.getByLabelText(/email/i), 'me@example.com')
    await user.type(screen.getByLabelText(/password/i), 'pw')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    expect(await screen.findByText('Week page')).toBeInTheDocument()
  })

  it('shows an error when sign-in is rejected and stays on the form', async () => {
    const auth = fakeAuth({ signIn: vi.fn().mockRejectedValue(new Error('Invalid login credentials')) })
    const user = userEvent.setup()
    renderLogin(auth)

    await user.type(screen.getByLabelText(/email/i), 'me@example.com')
    await user.type(screen.getByLabelText(/password/i), 'wrong')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    expect(await screen.findByText('Invalid login credentials')).toBeInTheDocument()
    expect(screen.queryByText('Home page')).not.toBeInTheDocument()
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
  })

  it('redirects to / when already signed in', async () => {
    const me: AuthUser = { id: 'u1', email: 'me@example.com' }
    renderLogin(fakeAuth({ currentUser: vi.fn().mockResolvedValue(me) }))
    await waitFor(() => expect(screen.getByText('Home page')).toBeInTheDocument())
  })
})
