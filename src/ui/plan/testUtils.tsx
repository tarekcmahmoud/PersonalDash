import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, type RenderResult } from '@testing-library/react'
import type { ReactElement, ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { createMemoryAuth, createMemoryRepo } from '../../data/memoryRepo'
import { seedSnapshot } from '../../data/seed'
import { ServicesProvider } from '../../data/services'
import type { Repo } from '../../data/repo'
import type { Snapshot } from '../../domain/types'
import { todayISO } from '../../domain/week'

export interface RenderOptions {
  /** Router entries, default ['/']. */
  route?: string
  /** Start data; default seedSnapshot(todayISO()). */
  snapshot?: Snapshot
}

/** Renders a screen with query client, memory services (seeded with today's demo data) and a router. */
export function renderApp(ui: ReactElement, opts: RenderOptions = {}): RenderResult & { repo: Repo } {
  const repo = createMemoryRepo(opts.snapshot ?? seedSnapshot(todayISO()))
  const services = { repo, auth: createMemoryAuth() }
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>
        <ServicesProvider services={services}>
          <MemoryRouter initialEntries={[opts.route ?? '/']}>{children}</MemoryRouter>
        </ServicesProvider>
      </QueryClientProvider>
    )
  }

  return Object.assign(render(ui, { wrapper: Wrapper }), { repo })
}
