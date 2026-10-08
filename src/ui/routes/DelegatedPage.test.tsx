import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { seedSnapshot } from '../../data/seed'
import { addDaysISO } from '../../domain/week'
import { freezeToday, renderWithApp, TEST_TODAY, unfreezeToday } from '../../test/renderWithApp'
import { DelegatedPage } from './DelegatedPage'

beforeEach(() => freezeToday())
afterEach(() => unfreezeToday())

/** The seed, with "Update KPI slides" also delegated to Sam and overdue for a follow-up. */
function snapshot() {
  const s = seedSnapshot(TEST_TODAY)
  const sam = s.people.find((p) => p.name === 'Sam Lee')!
  const kpi = s.tasks.find((t) => t.title === 'Update KPI slides')!
  kpi.assigneeId = sam.id
  kpi.followUpDate = addDaysISO(TEST_TODAY, -2)
  return s
}

const section = (name: string) => within(screen.getByRole('heading', { name, level: 2 }).closest('section')!)

describe('DelegatedPage', () => {
  it('groups delegated tasks by person, with overdue follow-ups first', async () => {
    renderWithApp(<DelegatedPage />, { snapshot: snapshot() })
    expect(await screen.findByText('1 follow-up due')).toBeInTheDocument()
    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)
    expect(headings).toEqual(['Sam Lee1', 'Priya Shah1'])
    expect(section('Sam Lee1').getByText(/Follow up · overdue since/)).toHaveClass('text-destructive')
    expect(section('Priya Shah1').getByText('Design content page templates')).toBeInTheDocument()
  })

  it('sets the next follow-up, and ticks a task off when they are done', async () => {
    const user = userEvent.setup()
    const { snapshot: saved } = renderWithApp(<DelegatedPage />, { snapshot: snapshot() })
    const sam = await waitFor(() => section('Sam Lee1'))
    await user.click(sam.getByRole('button', { name: 'Follow up again…' }))
    await user.click(await screen.findByRole('button', { name: 'In 1 week' }))
    await waitFor(async () =>
      expect((await saved()).tasks.find((t) => t.title === 'Update KPI slides')!.followUpDate).toBe(
        addDaysISO(TEST_TODAY, 7),
      ),
    )

    await user.click(screen.getByRole('checkbox', { name: /Design content page templates/ }))
    await waitFor(() => expect(screen.queryByText('Design content page templates')).not.toBeInTheDocument())
  })

  it('explains how to delegate when nothing is', async () => {
    const s = seedSnapshot(TEST_TODAY)
    s.tasks = s.tasks.map((t) => ({ ...t, assigneeId: null }))
    renderWithApp(<DelegatedPage />, { snapshot: s })
    expect(await screen.findByText(/Nothing delegated/)).toBeInTheDocument()
  })
})
