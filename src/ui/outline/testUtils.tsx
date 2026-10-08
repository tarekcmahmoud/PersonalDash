/* eslint-disable react-refresh/only-export-components -- test helper module */
import { BaseStyles, ThemeProvider } from '@primer/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation, useParams } from 'react-router-dom'
import { createMemoryAuth, createMemoryRepo } from '../../data/memoryRepo'
import { seedSnapshot } from '../../data/seed'
import { ServicesProvider } from '../../data/services'
import type { Snapshot } from '../../domain/types'
import { todayISO } from '../../domain/week'
import { ImportPage } from '../routes/ImportPage'
import { TemplatesPage } from '../routes/TemplatesPage'

// jsdom lacks ResizeObserver and the Popover API, which Primer's Dialog (and its Tooltip) rely on.
if (typeof ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}
if (!('popover' in HTMLElement.prototype)) {
  Object.defineProperty(HTMLElement.prototype, 'popover', { value: null, writable: true, configurable: true })
  const proto = HTMLElement.prototype as unknown as Record<string, unknown>
  proto.showPopover = () => {}
  proto.hidePopover = () => {}
  proto.togglePopover = () => false
}

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

/** Renders the Import and Templates routes with in-memory services; returns the repo for assertions. */
export function renderApp({ route = '/import', state, snapshot }: RenderOptions = {}) {
  const repo = createMemoryRepo(snapshot ?? seedSnapshot(todayISO()))
  const auth = createMemoryAuth()
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const utils = render(
    <ThemeProvider colorMode="light">
      <BaseStyles>
        <QueryClientProvider client={queryClient}>
          <ServicesProvider services={{ repo, auth }}>
            <MemoryRouter initialEntries={[{ pathname: route, state }]}>
              <LocationProbe />
              <Routes>
                <Route path="/import" element={<ImportPage />} />
                <Route path="/templates" element={<TemplatesPage />} />
                <Route path="/projects/:projectId" element={<ProjectStub />} />
              </Routes>
            </MemoryRouter>
          </ServicesProvider>
        </QueryClientProvider>
      </BaseStyles>
    </ThemeProvider>,
  )
  return { ...utils, repo, queryClient }
}
