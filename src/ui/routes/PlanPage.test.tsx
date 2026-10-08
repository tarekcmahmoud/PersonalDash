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
    expect(screen.getByText('22h planned of 31.5h')).toBeInTheDocument()

    await user.click(website.getByRole('checkbox', { name: /Design content page templates/ }))

    await waitFor(() => expect(screen.getByText('26h planned of 31.5h')).toBeInTheDocument())
    expect(website.getByText('3 planned')).toBeInTheDocument()
    expect(website.getByRole('checkbox', { name: /Design content page templates/ })).toBeChecked()
  })

  it('shows XL tasks as disabled with "Split this task first"', async () => {
    const user = userEvent.setup()
    renderApp(<PlanPage />)

    const website = await group('Client website redesign')
    await user.click(website.getByRole('button', { name: /Show more tasks/ }))

    expect(await website.findByText('Split this task first')).toBeInTheDocument()
    expect(website.getByRole('checkbox', { name: /Build CMS integration/ })).toBeDisabled()
  })

  it('flags a project with nothing planned as neglected', async () => {
    renderApp(<PlanPage />)
    const designer = await group('Hire a designer')
    expect(designer.getByText('Nothing planned')).toBeInTheDocument()
    expect(designer.getByText('0 planned')).toBeInTheDocument()
  })

  it('lists the follow-up for the week and the inbox count', async () => {
    renderApp(<PlanPage />)
    expect(
      await screen.findByText('Follow up: Finance team re Collect final cost figures'),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go to Inbox' })).toHaveAttribute('href', '/inbox')
  })

  it('sets and clears a capacity override', async () => {
    const user = userEvent.setup()
    renderApp(<PlanPage />)
    await screen.findByText('22h planned of 31.5h')

    await user.click(screen.getByRole('button', { name: 'Adjust' }))
    const input = screen.getByLabelText('Capacity override in hours')
    await user.clear(input)
    await user.type(input, '20')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText(/2h over/)).toBeInTheDocument()
    expect(screen.getByText('22h planned of 20h')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Adjust' }))
    await user.click(screen.getByRole('button', { name: 'Reset to computed' }))
    expect(await screen.findByText('22h planned of 31.5h')).toBeInTheDocument()
  })

  it('moves to the next week with the switcher', async () => {
    const user = userEvent.setup()
    renderApp(<PlanPage />)
    await screen.findByText('22h planned of 31.5h')
    await user.click(screen.getByRole('button', { name: 'Next week' }))
    expect(await screen.findByText('0h planned of 31.5h')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'This week' })).toBeInTheDocument()
  })
})
