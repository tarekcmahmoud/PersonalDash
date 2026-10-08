import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { makeTask } from '../../domain/factories'
import { seedSnapshot } from '../../data/seed'
import { addDaysISO, todayISO, weekStartOf } from '../../domain/week'
import { renderApp } from '../plan/testUtils'
import { TodayPage } from './TodayPage'

describe('TodayPage', () => {
  it('shows the task pinned for today and marks it done when toggled', async () => {
    const user = userEvent.setup()
    renderApp(<TodayPage />)

    const pinned = within(await screen.findByRole('region', { name: /Pinned for today/ }))
    const row = pinned.getByText('Design homepage').closest('[data-testid="task-row"]')!
    expect(row).toHaveAttribute('data-status', 'todo')

    await user.click(pinned.getByRole('checkbox', { name: /Design homepage/ }))
    await waitFor(() => expect(row).toHaveAttribute('data-status', 'done'))
  })

  it('shows follow-ups due today and the projects overview', async () => {
    const snapshot = seedSnapshot(todayISO())
    const waiting = snapshot.tasks.find((t) => t.status === 'waiting')!
    waiting.followUpDate = todayISO()
    renderApp(<TodayPage />, { snapshot })

    expect(
      await screen.findByText('Follow up: Finance team re Collect final cost figures'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Received' })).toBeInTheDocument()
    // Phone layout (no wide match in jsdom): overview sits under a "Projects overview" disclosure.
    expect(screen.getByText('Projects overview')).toBeInTheDocument()
    expect(screen.getByRole('article', { name: 'Hire a designer' })).toBeInTheDocument()
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

    const overdue = within(await screen.findByRole('region', { name: /Overdue/ }))
    expect(overdue.getByText('Send invoice')).toBeInTheDocument()
    await user.click(overdue.getByRole('button', { name: 'Move to today' }))
    const pinned = within(await screen.findByRole('region', { name: /Pinned for today/ }))
    expect(pinned.getByText('Send invoice')).toBeInTheDocument()
  })

  it('shows an empty state with a link to the planner when nothing is planned', async () => {
    const snapshot = seedSnapshot(todayISO())
    snapshot.tasks = snapshot.tasks.map((t) => ({ ...t, weekStart: null, pinnedDay: null }))
    renderApp(<TodayPage />, { snapshot })
    expect(await screen.findByRole('link', { name: 'Plan the week' })).toHaveAttribute('href', '/plan')
  })
})
