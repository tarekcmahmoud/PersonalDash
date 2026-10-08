import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { format, parseISO } from 'date-fns'
import { describe, expect, it } from 'vitest'
import { seedSnapshot } from '../../data/seed'
import { addDaysISO, todayISO, weekStartOf } from '../../domain/week'
import { renderApp } from '../plan/testUtils'
import { WeekPage } from './WeekPage'

const dayRegion = async (day: string) =>
  within(await screen.findByRole('region', { name: format(parseISO(day), 'EEEE MMMM d') }))

describe('WeekPage', () => {
  it('shows the pinned task on today and the unpinned ones under "any day"', async () => {
    renderApp(<WeekPage />)
    const today = await dayRegion(todayISO())
    expect(today.getByText('Design homepage')).toBeInTheDocument()
    const anyDay = within(await screen.findByRole('region', { name: 'This week, any day' }))
    expect(anyDay.getByText('Draft sitemap')).toBeInTheDocument()
  })

  it('shows hours and free time per day', async () => {
    renderApp(<WeekPage />)
    const today = await dayRegion(todayISO())
    expect(today.getByText(/\d+(\.\d)?h · \d+(\.\d)?h (free|over)/)).toBeInTheDocument()
  })

  it('shows follow-ups on their date as a row', async () => {
    const snapshot = seedSnapshot(todayISO())
    const waiting = snapshot.tasks.find((t) => t.status === 'waiting')!
    waiting.followUpDate = todayISO()
    renderApp(<WeekPage />, { snapshot })
    const today = await dayRegion(todayISO())
    expect(today.getByText('Follow up: Finance team re Collect final cost figures')).toBeInTheDocument()
  })

  it('moves a task to another day via the Move to… menu', async () => {
    const user = userEvent.setup()
    renderApp(<WeekPage />)
    const ws = weekStartOf(todayISO())
    const target = addDaysISO(ws, 4) // Friday

    const anyDay = within(await screen.findByRole('region', { name: 'This week, any day' }))
    await user.click(anyDay.getByRole('button', { name: 'Move "Draft sitemap" to…' }))
    await user.click(
      await screen.findByRole('menuitem', { name: new RegExp(format(parseISO(target), 'EEE MMM d')) }),
    )

    const friday = await dayRegion(target)
    await waitFor(() => expect(friday.getByText('Draft sitemap')).toBeInTheDocument())
    expect(
      within(screen.getByRole('region', { name: 'This week, any day' })).queryByText('Draft sitemap'),
    ).not.toBeInTheDocument()
  })

  it('unplans a task from the menu', async () => {
    const user = userEvent.setup()
    renderApp(<WeekPage />)
    const anyDay = within(await screen.findByRole('region', { name: 'This week, any day' }))
    await user.click(anyDay.getByRole('button', { name: 'Move "Draft sitemap" to…' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Unplan' }))
    await waitFor(() => expect(screen.queryByText('Draft sitemap')).not.toBeInTheDocument())
  })
})
