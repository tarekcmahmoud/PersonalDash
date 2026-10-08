/* eslint-disable react-refresh/only-export-components -- test helper module */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, type RenderResult } from '@testing-library/react'
import type { ReactElement, ReactNode } from 'react'
import { MemoryRouter, Route, Routes, useLocation, useParams } from 'react-router-dom'
import { createMemoryAuth, createMemoryRepo } from '../../data/memoryRepo'
import type { Repo } from '../../data/repo'
import { seedSnapshot } from '../../data/seed'
import { ServicesProvider } from '../../data/services'
import type { Snapshot } from '../../domain/types'
import { todayISO } from '../../domain/week'
import { ImportPage } from '../routes/ImportPage'
import { TemplatesPage } from '../routes/TemplatesPage'

/** Shows the current path and router state so tests can assert on navigation. */
function LocationProbe() {
  const location = useLocation()
  return (
    <div data-testid="location" data-pathname={location.pathname}>
      {location.pathname}
    </div>
  )
}

function ProjectStub() {
  const { projectId } = useParams()
  return <div data-testid="project-stub">{projectId}</div>
}

export interface RenderOptions {
  route?: string
  /** Router state for the initial entry. */
  state?: unknown
  /** Starting data; defaults to the demo seed. */
  snapshot?: Snapshot
}

function Providers({
  repo,
  auth,
  queryClient,
  route,
  state,
  children,
}: {
  repo: Repo
  auth: ReturnType<typeof createMemoryAuth>
  queryClient: QueryClient
  route: string
  state?: unknown
  children: ReactNode
}) {
  return (
    <QueryClientProvider client={queryClient}>
      <ServicesProvider services={{ repo, auth }}>
        <MemoryRouter initialEntries={[{ pathname: route, state }]}>{children}</MemoryRouter>
      </ServicesProvider>
    </QueryClientProvider>
  )
}

/** Renders any element with query client, memory services (seeded with demo data) and a router. */
export function renderWithServices(
  ui: ReactElement,
  { route = '/', state, snapshot }: RenderOptions = {},
): RenderResult & { repo: Repo; queryClient: QueryClient } {
  const repo = createMemoryRepo(snapshot ?? seedSnapshot(todayISO()))
  const auth = createMemoryAuth()
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const utils = render(
    <Providers repo={repo} auth={auth} queryClient={queryClient} route={route} state={state}>
      {ui}
    </Providers>,
  )
  return Object.assign(utils, { repo, queryClient })
}

/** Renders the Import and Templates routes with in-memory services; returns the repo for assertions. */
export function renderApp({ route = '/import', state, snapshot }: RenderOptions = {}) {
  return renderWithServices(
    <>
      <LocationProbe />
      <Routes>
        <Route path="/import" element={<ImportPage />} />
        <Route path="/templates" element={<TemplatesPage />} />
        <Route path="/projects/:projectId" element={<ProjectStub />} />
      </Routes>
    </>,
    { route, state, snapshot },
  )
}
