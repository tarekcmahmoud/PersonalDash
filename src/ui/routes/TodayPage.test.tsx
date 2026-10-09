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
const section = async (name: string | RegExp) =>
  sectionOf(await screen.findByRole('heading', { name, level: 2 }))

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

  it('shows delegated follow-ups in a Delegated card of their own, with Done', async () => {
    const user = userEvent.setup()
    const snapshot = seedSnapshot(todayISO())
    const delegated = snapshot.tasks.find((t) => t.assigneeId !== null)!
    delegated.followUpDate = todayISO()
    renderApp(<TodayPage />, { snapshot })

    const card = await section(/^Delegated/)
    expect(card.getByText('Follow up: Priya Shah re Design content page templates')).toBeInTheDocument()
    expect(card.getByText('Client website redesign · Design')).toBeInTheDocument()
    expect(card.getByRole('link', { name: 'All delegated' })).toHaveAttribute('href', '/delegated')
    expect((await section('Today')).queryByText(/Follow up: Priya Shah/)).not.toBeInTheDocument()
    await user.click(card.getByRole('button', { name: 'Done' }))
    await waitFor(() => expect(screen.queryByText(/Follow up: Priya Shah/)).not.toBeInTheDocument())
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

  it('lays out tasks on the left and resources on the right, like a project page', async () => {
    renderApp(<TodayPage />)
    expect(await screen.findByRole('heading', { name: 'Tasks', level: 2 })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /^Resources/, level: 2 })).toBeInTheDocument()
    expect(screen.getByRole('radiogroup', { name: 'Today view' })).toBeInTheDocument()
  })

  it("pulls in the resources of today's tasks: their workstream's, then the project-wide ones", async () => {
    renderApp(<TodayPage />)
    // "Design homepage" (Design workstream) is pinned for today.
    const resources = sectionOf(await screen.findByRole('heading', { name: /^Resources/, level: 2 }))
    expect(resources.getByText("for today's tasks")).toBeInTheDocument()
    const cards = await resources.findAllByTestId('resource-card')
    expect(cards.map((c) => within(c).getAllByRole('link')[0]!.textContent)).toEqual([
      'Brand guidelines',
      'Competitor moodboard',
      'drive.example.com',
    ])
    expect(resources.getByRole('link', { name: 'Brand guidelines' })).toHaveAttribute(
      'href',
      'https://example.com/brand-guidelines',
    )
    expect(resources.getAllByText('Client website redesign · For Design homepage')).toHaveLength(3)
    expect(resources.queryByText('Client brief')).not.toBeInTheDocument()
  })

  it("falls back to the rest of the week's resources when nothing is on today's list", async () => {
    const snapshot = seedSnapshot(todayISO())
    snapshot.tasks = snapshot.tasks.map((t) => (t.pinnedDay ? { ...t, pinnedDay: null } : t))
    renderApp(<TodayPage />, { snapshot })
    expect(await screen.findByText("for this week's tasks")).toBeInTheDocument()
    expect((await screen.findAllByTestId('resource-card')).length).toBeGreaterThan(0)
  })

  it('explains where resources come from when the tasks have none', async () => {
    const snapshot = seedSnapshot(todayISO())
    snapshot.resources = []
    renderApp(<TodayPage />, { snapshot })
    expect(await screen.findByText(/No resources for these tasks/)).toBeInTheDocument()
    expect(screen.queryByTestId('resource-card')).not.toBeInTheDocument()
  })
})
