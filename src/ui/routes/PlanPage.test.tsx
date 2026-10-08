import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { renderApp } from '../plan/testUtils'
import { PlanPage } from './PlanPage'

const group = async (name: string) => within(await screen.findByRole('region', { name }))

describe('PlanPage', () => {
  it('planning a task updates the capacity text and the planned count', async () => {
    const user = userEvent.setup()
    renderApp(<PlanPage />)

    const website = await group('Client website redesign')
    expect(website.getByText('2 planned')).toBeInTheDocument()
    // Seed: sitemap M + homepage L + revenue M + long run M + dentist S + one follow-up S = 22h of 31.5h.
    expect(screen.getByText('22 of 31.5h planned')).toBeInTheDocument()

    // Workstreams run in parallel, so Build's first task is offered next to Design's.
    await user.click(website.getByRole('checkbox', { name: /Set up staging environment/ }))

    await waitFor(() => expect(screen.getByText('23 of 31.5h planned')).toBeInTheDocument())
    expect(website.getByText('3 planned')).toBeInTheDocument()
    expect(website.getByRole('checkbox', { name: /Set up staging environment/ })).toBeChecked()
  })

  it('shows XL tasks as disabled with "Split first"', async () => {
    const user = userEvent.setup()
    renderApp(<PlanPage />)

    const website = await group('Client website redesign')
    await user.click(website.getByRole('button', { name: /Show more tasks/ }))

    expect(await website.findByText('Split first')).toBeInTheDocument()
    expect(website.getByRole('checkbox', { name: /Build CMS integration/ })).toBeDisabled()
  })

  it('flags a project with nothing planned as neglected', async () => {
    renderApp(<PlanPage />)
    const designer = await group('Hire a designer')
    expect(designer.getByText('Nothing planned')).toBeInTheDocument()
    expect(designer.getByText('0 planned')).toBeInTheDocument()
  })

  it('shows one quiet line with the follow-up and Inbox counts, each linking out', async () => {
    renderApp(<PlanPage />)
    expect(await screen.findByRole('link', { name: '1 follow-up due' })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: '2 in Inbox' })).toHaveAttribute('href', '/inbox')
    // The planned list and the follow-up section moved elsewhere.
    expect(screen.queryByText(/Planned this week/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Follow up: Finance team/)).not.toBeInTheDocument()
  })

  it('sets and clears a capacity override', async () => {
    const user = userEvent.setup()
    renderApp(<PlanPage />)
    await screen.findByText('22 of 31.5h planned')

    await user.click(screen.getByRole('button', { name: 'Adjust' }))
    const input = await screen.findByLabelText('Capacity override in hours')
    await user.clear(input)
    await user.type(input, '20')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText(/2h over/)).toBeInTheDocument()
    expect(screen.getByText(/22 of 20h planned/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Adjust' }))
    await user.click(screen.getByRole('button', { name: 'Reset to computed' }))
    expect(await screen.findByText('22 of 31.5h planned')).toBeInTheDocument()
  })

  it('moves to the next week with the switcher', async () => {
    const user = userEvent.setup()
    renderApp(<PlanPage />)
    await screen.findByText('22 of 31.5h planned')
    await user.click(screen.getByRole('button', { name: 'Next week' }))
    expect(await screen.findByText('0 of 31.5h planned')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'This week' })).toBeInTheDocument()
  })
})
