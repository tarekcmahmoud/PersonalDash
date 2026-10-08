import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { seedSnapshot } from '../../data/seed'
import { makeProject } from '../../domain/factories'
import { freezeToday, renderWithApp, TEST_TODAY, unfreezeToday } from '../../test/renderWithApp'
import { ProjectsPage } from './ProjectsPage'

beforeEach(() => freezeToday())
afterEach(() => unfreezeToday())

describe('ProjectsPage', () => {
  it('lists seeded projects grouped by status with next step and counts', async () => {
    renderWithApp(<ProjectsPage />, { route: '/projects' })

    expect(await screen.findByRole('link', { name: 'Client website redesign' })).toHaveAttribute(
      'href',
      expect.stringMatching(/^\/projects\/.+/),
    )
    const active = screen.getByRole('region', { name: /^Active/ })
    expect(within(active).getByRole('link', { name: 'Quarterly board report' })).toBeInTheDocument()
    expect(within(active).getByRole('link', { name: 'Admin / Misc' })).toBeInTheDocument()
    expect(within(active).queryByRole('link', { name: 'Kitchen renovation' })).not.toBeInTheDocument()

    const hold = screen.getByRole('region', { name: /^On hold/ })
    expect(within(hold).getByRole('link', { name: 'Kitchen renovation' })).toBeInTheDocument()

    const website = screen.getByRole('link', { name: 'Client website redesign' }).closest('[data-testid]')!
    expect(within(website as HTMLElement).getByText('Draft sitemap')).toBeInTheDocument()
    expect(within(website as HTMLElement).getByText(/\d+ open · 3 done/)).toBeInTheDocument()
  })

  it('shows the over-cap banner only when active projects exceed the cap', async () => {
    const snapshot = seedSnapshot(TEST_TODAY)
    snapshot.settings.activeCap = 3 // seed has 4 active (non-system) projects
    const { unmount } = renderWithApp(<ProjectsPage />, { snapshot })
    expect(
      await screen.findByText('You have 4 active projects (cap 3). Consider putting one on hold.'),
    ).toBeInTheDocument()
    unmount()

    const atCap = seedSnapshot(TEST_TODAY)
    atCap.settings.activeCap = 4
    renderWithApp(<ProjectsPage />, { snapshot: atCap })
    await screen.findByRole('link', { name: 'Client website redesign' })
    expect(screen.queryByText(/Consider putting one on hold/)).not.toBeInTheDocument()
  })

  it('collapses done projects into a details section', async () => {
    const snapshot = seedSnapshot(TEST_TODAY)
    snapshot.projects.push(makeProject({ name: 'Old shipped thing', status: 'done', rank: 9 }))
    renderWithApp(<ProjectsPage />, { snapshot })
    const summary = await screen.findByText('Done (1)')
    expect(summary.closest('details')).not.toHaveAttribute('open')
  })

  it('reorders active projects with the move buttons and rewrites ranks', async () => {
    const user = userEvent.setup()
    const { snapshot } = renderWithApp(<ProjectsPage />)
    await user.click(await screen.findByRole('button', { name: 'Move down: Client website redesign' }))

    await waitFor(async () => {
      const ranks = Object.fromEntries((await snapshot()).projects.map((p) => [p.name, p.rank]))
      expect(ranks['Quarterly board report']).toBe(1)
      expect(ranks['Client website redesign']).toBe(2)
      expect(ranks['Hire a designer']).toBe(3)
    })
  })

  it('creates a project with rank after the last active one', async () => {
    const user = userEvent.setup()
    const { snapshot } = renderWithApp(<ProjectsPage />, { route: '/projects', path: '/projects' })
    await user.click(await screen.findByRole('button', { name: 'New project' }))

    const dialog = screen.getByRole('dialog', { name: 'New project' })
    await user.click(within(dialog).getByRole('button', { name: 'Create project' }))
    expect(within(dialog).getByText('Give the project a name.')).toBeInTheDocument()

    await user.type(within(dialog).getByRole('textbox', { name: /Name/ }), 'Learn piano')
    await user.type(within(dialog).getByRole('textbox', { name: /Done when/ }), 'Play a full piece')
    await user.type(within(dialog).getByLabelText(/Target date/), '2027-03-01')
    await user.click(within(dialog).getByRole('button', { name: 'Create project' }))

    await waitFor(async () => {
      const created = (await snapshot()).projects.find((p) => p.name === 'Learn piano')
      expect(created).toMatchObject({
        outcome: 'Play a full piece',
        targetDate: '2027-03-01',
        status: 'active',
        rank: 5,
      })
    })
  })
})
