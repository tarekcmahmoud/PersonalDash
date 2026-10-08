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
    const user = userEvent.setup()
    renderWithApp(<ProjectsPage />, { route: '/projects' })

    expect(await screen.findByRole('link', { name: 'Client website redesign' })).toHaveAttribute(
      'href',
      expect.stringMatching(/^\/projects\/.+/),
    )
    expect(screen.getByRole('link', { name: 'Quarterly board report' })).toBeInTheDocument()
    // The system project comes last among the active ones.
    const names = screen.getAllByTestId('project-card').map((r) => within(r).getByRole('link').textContent)
    expect(names.at(-1)).toBe('Admin / Misc')
    expect(within(screen.getAllByTestId('project-card').at(-1)!).getByText('System')).toBeInTheDocument()

    // On hold is a collapsed group.
    expect(screen.queryByRole('link', { name: 'Kitchen renovation' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /On hold/ }))
    expect(await screen.findByRole('link', { name: 'Kitchen renovation' })).toBeInTheDocument()

    // Each project is its own card: objective date, progress, next step and this week's load.
    const website = screen.getByRole('link', { name: 'Client website redesign' }).closest('[data-testid]')!
    const card = within(website as HTMLElement)
    expect(card.getByText('Next')).toBeInTheDocument()
    expect(card.getByText('Draft sitemap')).toBeInTheDocument()
    expect(card.getByText(/^Deadline /)).toBeInTheDocument()
    expect(card.getByText(/^\d+ of \d+ done$/)).toBeInTheDocument()
    expect(card.getByText(/^\d+ open · \d+ planned this week$/)).toBeInTheDocument()
    expect(card.getByLabelText(/Client website redesign: \d+ of \d+ tasks done/)).toBeInTheDocument()
  })

  it('has one primary action and puts import and templates in the … menu', async () => {
    const user = userEvent.setup()
    renderWithApp(<ProjectsPage />, { route: '/projects', path: '/projects' })
    expect(await screen.findByRole('button', { name: 'New project' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Import breakdown' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'More actions' }))
    expect(await screen.findByRole('menuitem', { name: 'Import breakdown' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'New from template' })).toBeInTheDocument()
  })

  it('shows a quiet over-cap line only when active projects exceed the cap', async () => {
    const snapshot = seedSnapshot(TEST_TODAY)
    snapshot.settings.activeCap = 3 // seed has 4 active (non-system) projects
    const { unmount } = renderWithApp(<ProjectsPage />, { snapshot })
    expect(
      await screen.findByText('4 active projects — more than your cap of 3. Consider putting one on hold.'),
    ).toBeInTheDocument()
    unmount()

    const atCap = seedSnapshot(TEST_TODAY)
    atCap.settings.activeCap = 4
    renderWithApp(<ProjectsPage />, { snapshot: atCap })
    await screen.findByRole('link', { name: 'Client website redesign' })
    expect(screen.queryByText(/Consider putting one on hold/)).not.toBeInTheDocument()
  })

  it('collapses done projects into a group', async () => {
    const user = userEvent.setup()
    const snapshot = seedSnapshot(TEST_TODAY)
    snapshot.projects.push(makeProject({ name: 'Old shipped thing', status: 'done', rank: 9 }))
    renderWithApp(<ProjectsPage />, { snapshot })
    const toggle = await screen.findByRole('button', { name: /Done/ })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('link', { name: 'Old shipped thing' })).not.toBeInTheDocument()
    await user.click(toggle)
    expect(await screen.findByRole('link', { name: 'Old shipped thing' })).toBeInTheDocument()
  })

  it('reorders active projects with the row menu and rewrites ranks', async () => {
    const user = userEvent.setup()
    const { snapshot } = renderWithApp(<ProjectsPage />)
    await user.click(await screen.findByRole('button', { name: 'Project actions: Client website redesign' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Move down' }))

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
