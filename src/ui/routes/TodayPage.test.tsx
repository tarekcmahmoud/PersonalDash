import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { makeTask } from '../../domain/factories'
import { seedSnapshot } from '../../data/seed'
import { addDaysISO, todayISO, weekStartOf } from '../../domain/week'
import { renderApp } from '../plan/testUtils'
import { TodayPage } from './TodayPage'

/** The `<section>` under a Section heading ("Today", "Later this week"). */
const sectionOf = (heading: HTMLElement) => within(heading.closest('section')!)
const section = async (name: string) => sectionOf(await screen.findByRole('heading', { name, level: 2 }))

describe('TodayPage', () => {
  it('shows the task pinned for today and marks it done when toggled', async () => {
    const user = userEvent.setup()
    renderApp(<TodayPage />)

    const today = await section('Today')
    const row = today.getByText('Design homepage').closest('[data-testid="task-row"]')!
    expect(row).toHaveAttribute('data-status', 'todo')

    await user.click(today.getByRole('checkbox', { name: /Design homepage/ }))
    await waitFor(() => expect(row).toHaveAttribute('data-status', 'done'))
  })

  it('shows the date and the week capacity line, but no capacity card or project overview', async () => {
    renderApp(<TodayPage />)
    expect(await screen.findByText(/\d+(\.\d)? of \d+(\.\d)?h this week/)).toBeInTheDocument()
    expect(screen.queryByText('Projects overview')).not.toBeInTheDocument()
    expect(screen.queryByRole('article')).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Capacity' })).not.toBeInTheDocument()
  })

  it('lists planned-but-unpinned tasks under "Later this week"', async () => {
    renderApp(<TodayPage />)
    const later = await section('Later this week')
    expect(later.getByText('Draft sitemap')).toBeInTheDocument()
  })

  it('shows follow-ups due today as one line with Received', async () => {
    const snapshot = seedSnapshot(todayISO())
    const waiting = snapshot.tasks.find((t) => t.status === 'waiting')!
    waiting.followUpDate = todayISO()
    renderApp(<TodayPage />, { snapshot })

    const today = await section('Today')
    expect(today.getByText('Follow up: Finance team re Collect final cost figures')).toBeInTheDocument()
    expect(today.getByRole('button', { name: 'Received' })).toBeInTheDocument()
  })

  it('marks a follow-up received', async () => {
    const user = userEvent.setup()
    const snapshot = seedSnapshot(todayISO())
    const waiting = snapshot.tasks.find((t) => t.status === 'waiting')!
    waiting.followUpDate = todayISO()
    renderApp(<TodayPage />, { snapshot })

    await user.click(await screen.findByRole('button', { name: 'Received' }))
    await waitFor(() => expect(screen.queryByText(/Follow up: Finance team/)).not.toBeInTheDocument())
  })

  it('offers to move an overdue pinned task to today', async () => {
    const user = userEvent.setup()
    const today = todayISO()
    const snapshot = seedSnapshot(today)
    // A task pinned yesterday (the same week unless today is Monday — then last week; both are overdue).
    const yesterday = addDaysISO(today, -1)
    snapshot.tasks.push(
      makeTask({
        title: 'Send invoice',
        projectId: null,
        weekStart: weekStartOf(yesterday),
        pinnedDay: yesterday,
      }),
    )
    renderApp(<TodayPage />, { snapshot })

    const row = (await section('Today')).getByText('Send invoice').closest('[data-testid="task-row"]')!
    await user.click(within(row as HTMLElement).getByRole('button', { name: 'Move to today' }))
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Move to today' })).not.toBeInTheDocument(),
    )
    expect((await section('Today')).getByText('Send invoice')).toBeInTheDocument()
  })

  it('shows an empty state with a link to the planner when nothing is planned', async () => {
    const snapshot = seedSnapshot(todayISO())
    snapshot.tasks = snapshot.tasks.map((t) => ({ ...t, weekStart: null, pinnedDay: null }))
    renderApp(<TodayPage />, { snapshot })
    expect(await screen.findByRole('link', { name: 'Plan the week' })).toHaveAttribute('href', '/plan')
    expect(screen.queryByRole('heading', { name: 'Later this week' })).not.toBeInTheDocument()
  })

  it('nudges towards the weekly review when last week has leftovers', async () => {
    renderApp(<TodayPage />)
    expect(await screen.findByRole('link', { name: /Start weekly review/ })).toHaveAttribute(
      'href',
      '/review',
    )
  })
})
