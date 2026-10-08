import { createContext, useContext, type ReactNode } from 'react'
import type { AuthService } from './auth'
import type { Repo } from './repo'

export interface Services {
  repo: Repo
  auth: AuthService
}

const ServicesContext = createContext<Services | null>(null)

export function ServicesProvider({ services, children }: { services: Services; children: ReactNode }) {
  return <ServicesContext.Provider value={services}>{children}</ServicesContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useServices(): Services {
  const s = useContext(ServicesContext)
  if (!s) throw new Error('useServices must be used inside <ServicesProvider>')
  return s
}
