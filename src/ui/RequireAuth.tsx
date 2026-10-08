import { Spinner, Stack } from '@primer/react'
import { useEffect, useState, type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import type { AuthUser } from '../data/auth'
import { useServices } from '../data/services'

/** Renders children only for a signed-in user; otherwise redirects to /login. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { auth } = useServices()
  const location = useLocation()
  const [user, setUser] = useState<AuthUser | null | undefined>(undefined)

  useEffect(() => {
    let alive = true
    auth.currentUser().then((u) => alive && setUser(u))
    const off = auth.onChange((u) => setUser(u))
    return () => {
      alive = false
      off()
    }
  }, [auth])

  if (user === undefined)
    return (
      <Stack align="center" padding="spacious">
        <Spinner />
      </Stack>
    )
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return <>{children}</>
}
