import { Button, Flash, FormControl, Heading, Stack, TextInput } from '@primer/react'
import { useEffect, useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useServices } from '../../data/services'
import styles from './LoginPage.module.css'

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
    <main className={styles.page}>
      <form className={styles.card} onSubmit={onSubmit} aria-labelledby="login-heading">
        <Stack gap="normal">
          <Stack gap="condensed">
            <Heading as="h1" id="login-heading" variant="medium">
              PersonalDash
            </Heading>
            <p className={styles.subtitle}>Sign in to continue</p>
          </Stack>
          {error && <Flash variant="danger">{error}</Flash>}
          <FormControl required>
            <FormControl.Label>Email</FormControl.Label>
            <TextInput
              block
              type="email"
              name="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </FormControl>
          <FormControl required>
            <FormControl.Label>Password</FormControl.Label>
            <TextInput
              block
              type="password"
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </FormControl>
          <Button type="submit" variant="primary" block loading={submitting}>
            Sign in
          </Button>
        </Stack>
      </form>
    </main>
  )
}
