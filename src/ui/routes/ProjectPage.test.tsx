import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { seedSnapshot } from '../../data/seed'
import { freezeToday, renderWithApp, TEST_TODAY, unfreezeToday } from '../../test/renderWithApp'
import { ProjectPage } from './ProjectPage'

beforeEach(() => freezeToday())
afterEach(() => unfreezeToday())

const seed = seedSnapshot(TEST_TODAY)
const website = seed.projects.find((p) => p.name === 'Client website redesign')!
const sitemap = seed.tasks.find((t) => t.title === 'Draft sitemap')!
const route = `/projects/${website.id}`
const path = '/projects/:projectId'

const renderPage = ({ route }: { route: string }) =>
  renderWithApp(<ProjectPage />, { route, path, snapshot: structuredClone(seed) })

const rowOf = (title: string) =>
  screen.getByRole('button', { name: title }).closest('[data-testid="task-row"]') as HTMLElement

describe('ProjectPage', () => {
  it('shows milestones in order, highlights the next task and explains blocked ones', async () => {
    renderPage({ route })

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Client website redesign' }),
    ).toBeInTheDocument()
    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)
    expect(headings).toEqual(['Discovery', 'Design', 'Build'])

    // Exactly one "Next" label, on the first ready task.
    expect(screen.getAllByText('Next')).toHaveLength(1)
    expect(within(rowOf('Draft sitemap')).getByText('Next')).toBeInTheDocument()
    expect(within(rowOf('Draft sitemap')).queryByText(/Blocked by/)).not.toBeInTheDocument()

    // The following task waits for its predecessor.
    expect(within(rowOf('Design homepage')).getByText('Blocked by: Draft sitemap')).toBeInTheDocument()
    expect(rowOf('Design homepage').className).toMatch(/muted/)

    // Done tasks are collapsed per group.
    expect(screen.getByText('3 done').closest('details')).not.toHaveAttribute('open')
  })

  it('lists explicit blockers by title', async () => {
    const designer = seed.projects.find((p) => p.name === 'Hire a designer')!
    renderPage({ route: `/projects/${designer.id}` })
    await screen.findByRole('heading', { level: 1, name: 'Hire a designer' })
    expect(
      within(rowOf('Review applications and shortlist')).getByText('Blocked by: Publish job post'),
    ).toBeInTheDocument()
  })

  it('opens the task dialog from the ?task= param and removes it on close', async () => {
    const user = userEvent.setup()
    renderPage({ route: `${route}?task=${sitemap.id}` })
    const dialog = await screen.findByRole('dialog', { name: 'Edit task' })
    expect(within(dialog).getByRole('textbox', { name: /Title/ })).toHaveValue('Draft sitemap')

    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByTestId('location')).toHaveTextContent(route)
    expect(screen.getByTestId('location')).not.toHaveTextContent('task=')
  })

  it('opens the dialog when a task title is clicked', async () => {
    const user = userEvent.setup()
    renderPage({ route })
    await user.click(await screen.findByRole('button', { name: 'Draft sitemap' }))
    expect(await screen.findByRole('dialog', { name: 'Edit task' })).toBeInTheDocument()
    expect(screen.getByTestId('location')).toHaveTextContent(`task=${sitemap.id}`)
  })

  it('adds a task from the quick-add input at the end of its milestone', async () => {
    const user = userEvent.setup()
    const { snapshot } = renderPage({ route })
    const input = await screen.findByRole('textbox', { name: 'New task in Design' })
    await user.type(input, 'Review mockups{Enter}')

    await waitFor(async () => {
      const added = (await snapshot()).tasks.find((t) => t.title === 'Review mockups')
      const design = seed.milestones.find((m) => m.name === 'Design')!
      expect(added).toMatchObject({ projectId: website.id, milestoneId: design.id, size: 'M', position: 3 })
    })
  })

  it('reorders open tasks within a group with the move buttons', async () => {
    const user = userEvent.setup()
    const { snapshot } = renderPage({ route })
    await user.click(await screen.findByRole('button', { name: 'Move up: Design homepage' }))

    await waitFor(async () => {
      const tasks = (await snapshot()).tasks
      const pos = (title: string) => tasks.find((t) => t.title === title)!.position
      expect(pos('Design homepage')).toBe(0)
      expect(pos('Draft sitemap')).toBe(1)
    })
  })

  it('hides delete for the system project', async () => {
    const system = seed.projects.find((p) => p.isSystem)!
    renderPage({ route: `/projects/${system.id}` })
    await screen.findByRole('heading', { level: 1, name: 'Admin / Misc' })
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument()
  })

  it('deletes a project after confirmation and goes back to the list', async () => {
    const user = userEvent.setup()
    const { snapshot } = renderPage({ route })
    await user.click(await screen.findByRole('button', { name: 'Delete' }))
    await user.click(await screen.findByRole('button', { name: 'Delete project' }))
    await waitFor(async () => {
      expect((await snapshot()).projects.some((p) => p.id === website.id)).toBe(false)
    })
  })
})
