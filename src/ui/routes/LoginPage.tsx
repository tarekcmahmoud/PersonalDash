import { useEffect, useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useServices } from '../../data/services'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

function redirectTarget(state: unknown): string {
  const from = (state as { from?: unknown } | null)?.from
  return typeof from === 'string' && from.startsWith('/') ? from : '/'
}

/** Email + password sign-in. The single account is created in the Supabase dashboard (no sign-up here). */
export function LoginPage() {
  const { auth } = useServices()
  const navigate = useNavigate()
  const location = useLocation()
  const target = redirectTarget(location.state)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let alive = true
    auth
      .currentUser()
      .then((user) => {
        if (alive && user) navigate('/', { replace: true })
      })
      .catch(() => {
        // not signed in / session unreadable: stay on the form
      })
    return () => {
      alive = false
    }
  }, [auth, navigate])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (submitting) return
    setError(null)
    setSubmitting(true)
    try {
      await auth.signIn(email.trim(), password)
      navigate(target, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed')
      setSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <form className="grid w-full max-w-xs gap-5" onSubmit={onSubmit} aria-labelledby="login-heading">
        <div>
          <h1 id="login-heading" className="text-2xl font-semibold tracking-tight">
            PersonalDash
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Sign in to continue</p>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="login-email">Email</Label>
          <Input
            id="login-email"
            type="email"
            name="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="login-password">Password</Label>
          <Input
            id="login-password"
            type="password"
            name="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </main>
  )
}
