/* eslint-disable react-refresh/only-export-components -- test helper, not a component module */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, type RenderResult } from '@testing-library/react'
import type { ReactElement } from 'react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import { createMemoryAuth, createMemoryRepo } from '../data/memoryRepo'
import type { Repo } from '../data/repo'
import { seedSnapshot } from '../data/seed'
import { ServicesProvider } from '../data/services'
import type { Snapshot } from '../domain/types'

export const TEST_TODAY = '2026-10-08'

/** Freeze `Date` (only) so "today" matches the seed; timers stay real. Call from beforeEach. */
export function freezeToday(date: string = TEST_TODAY): void {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(`${date}T10:00:00`))
}

export function unfreezeToday(): void {
  vi.useRealTimers()
}

function LocationProbe() {
  const { pathname, search } = useLocation()
  return <div data-testid="location">{pathname + search}</div>
}

export interface RenderWithAppOptions {
  /** Initial URL, e.g. '/projects/abc?task=xyz'. Default '/'. */
  route?: string
  /** Route pattern the element is mounted at, e.g. '/projects/:projectId'. Default: matches everything. */
  path?: string
  /** Data to start from. Default: seedSnapshot(TEST_TODAY). */
  snapshot?: Snapshot
}

export interface RenderWithAppResult extends RenderResult {
  repo: Repo
  /** Current persisted snapshot (what the repo holds). */
  snapshot: () => Promise<Snapshot>
}

/** Render a screen with React Query, memory services, tooltips and a MemoryRouter. */
export function renderWithApp(
  ui: ReactElement,
  { route = '/', path = '*', snapshot = seedSnapshot(TEST_TODAY) }: RenderWithAppOptions = {},
): RenderWithAppResult {
  const repo = createMemoryRepo(snapshot)
  const auth = createMemoryAuth()
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })

  const result = render(
    <ServicesProvider services={{ repo, auth }}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider delayDuration={0}>
          <MemoryRouter initialEntries={[route]}>
            <Routes>
              <Route path={path} element={ui} />
            </Routes>
            <LocationProbe />
          </MemoryRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ServicesProvider>,
  )
  return { ...result, repo, snapshot: () => repo.loadSnapshot() }
}
