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
  it('shows workstreams in order, marks the next task of each and explains blocked ones', async () => {
    renderPage({ route })

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Client website redesign' }),
    ).toBeInTheDocument()
    const headings = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)
    expect(headings).toEqual(['Discovery', 'Design', 'Build'])
    expect(screen.getByRole('heading', { level: 2, name: /^Workstreams/ })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: /^Resources/ })).toBeInTheDocument()

    // Workstreams run in parallel: each one has its own grey "Next" (Discovery is all done).
    expect(screen.getAllByText('Next')).toHaveLength(2)
    expect(within(rowOf('Draft sitemap')).getByText('Next')).toBeInTheDocument()
    expect(within(rowOf('Set up staging environment')).getByText('Next')).toBeInTheDocument()
    expect(within(rowOf('Draft sitemap')).queryByText(/After:/)).not.toBeInTheDocument()
    const cardOf = (name: string) => screen.getByRole('region', { name }).querySelector('[data-testid]')!
    expect(within(cardOf('Design') as HTMLElement).getAllByText('Next')).toHaveLength(1)
    expect(within(cardOf('Build') as HTMLElement).getAllByText('Next')).toHaveLength(1)
    expect(within(cardOf('Discovery') as HTMLElement).queryByText('Next')).not.toBeInTheDocument()

    // The first task of another workstream is not blocked by the previous workstream.
    expect(within(rowOf('Set up staging environment')).queryByText(/After:/)).not.toBeInTheDocument()

    // A task waiting for an open task in the same workstream is muted; the link is drawn, not written.
    expect(rowOf('Design homepage')).toHaveClass('opacity-50')
    expect(within(rowOf('Design homepage')).queryByText(/After:/)).not.toBeInTheDocument()

    // Done tasks are collapsed per group.
    expect(screen.getByRole('button', { name: '3 done' })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('button', { name: 'Kickoff call with client' })).not.toBeInTheDocument()
  })

  it('links back to the projects list', async () => {
    renderPage({ route })
    expect(await screen.findByRole('link', { name: 'Projects' })).toHaveAttribute('href', '/projects')
  })

  it('shows substreams as cards inside their workstream card and adds one from the … menu', async () => {
    const user = userEvent.setup()
    const kitchen = seed.projects.find((p) => p.name === 'Kitchen renovation')!
    const { snapshot } = renderWithApp(<ProjectPage />, {
      route: `/projects/${kitchen.id}`,
      path,
      snapshot: structuredClone(seed),
    })
    await screen.findByRole('heading', { level: 1, name: 'Kitchen renovation' })

    const workstream = screen.getByRole('region', { name: 'Design and ordering' })
    const subs = within(workstream).getAllByTestId('substream-card')
    expect(subs.map((c) => within(c).getByRole('heading', { level: 4 }).textContent)).toEqual([
      'Cabinets',
      'Appliances',
    ])
    expect(within(subs[0]!).getByRole('button', { name: 'Order cabinets and worktop' })).toBeInTheDocument()
    // The workstream's own task comes before its substreams.
    expect(
      within(workstream).getByRole('button', { name: 'Measure the room and draw a floor plan' }),
    ).toBeInTheDocument()
    // Each substream has its own next step.
    expect(within(rowOf('Choose cabinet and worktop colours')).getByText('Next')).toBeInTheDocument()
    expect(within(rowOf('Choose oven, hob and extractor')).getByText('Next')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Workstream actions: Design and ordering' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Add substream…' }))
    const dialog = await screen.findByRole('dialog', { name: 'Add substream' })
    await user.type(within(dialog).getByRole('textbox', { name: 'Name' }), 'Lighting')
    await user.click(within(dialog).getByRole('button', { name: 'Add substream' }))

    await waitFor(() => expect(within(workstream).getAllByTestId('substream-card')).toHaveLength(3))
    const added = (await snapshot()).milestones.find((m) => m.name === 'Lighting')!
    expect(added.position).toBe(2)
    expect(added.parentId).toBe(
      (await snapshot()).milestones.find((m) => m.name === 'Design and ordering')!.id,
    )
  })

  it('deletes a workstream together with its substreams and their tasks', async () => {
    const user = userEvent.setup()
    const kitchen = seed.projects.find((p) => p.name === 'Kitchen renovation')!
    const { snapshot } = renderWithApp(<ProjectPage />, {
      route: `/projects/${kitchen.id}`,
      path,
      snapshot: structuredClone(seed),
    })
    await screen.findByRole('heading', { level: 1, name: 'Kitchen renovation' })
    await user.click(screen.getByRole('button', { name: 'Workstream actions: Design and ordering' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Delete workstream…' }))
    const confirm = await screen.findByRole('alertdialog')
    expect(confirm).toHaveTextContent('This also deletes its 2 substreams and 4 tasks.')
    await user.click(within(confirm).getByRole('button', { name: 'Delete workstream' }))
    await waitFor(async () => {
      const snap = await snapshot()
      expect(snap.milestones.filter((m) => m.projectId === kitchen.id)).toEqual([])
      expect(
        snap.tasks
          .filter((t) => t.projectId === kitchen.id)
          .map((t) => t.title)
          .sort(),
      ).toEqual(['Confirm electrician schedule', 'Get three quotes from contractors'])
    })
  })

  it('has no visible status/edit/delete buttons, only a … menu', async () => {
    const user = userEvent.setup()
    renderPage({ route })
    await screen.findByRole('heading', { level: 1, name: 'Client website redesign' })
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Project actions' }))
    expect(await screen.findByRole('menuitem', { name: 'Edit project…' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Delete project…' })).toBeInTheDocument()
  })

  it('changes the project status from the … menu', async () => {
    const user = userEvent.setup()
    const { snapshot } = renderPage({ route })
    await user.click(await screen.findByRole('button', { name: 'Project actions' }))
    await user.click(await screen.findByRole('menuitemradio', { name: 'On hold' }))
    await waitFor(async () => {
      expect((await snapshot()).projects.find((p) => p.id === website.id)!.status).toBe('on_hold')
    })
  })

  it('edits the project from the … menu', async () => {
    const user = userEvent.setup()
    const { snapshot } = renderPage({ route })
    await user.click(await screen.findByRole('button', { name: 'Project actions' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Edit project…' }))
    const dialog = await screen.findByRole('dialog', { name: 'Edit project' })
    const name = within(dialog).getByRole('textbox', { name: 'Name' })
    await user.clear(name)
    await user.type(name, 'Website v2')
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    await waitFor(async () => {
      expect((await snapshot()).projects.find((p) => p.id === website.id)!.name).toBe('Website v2')
    })
  })

  it('writes links to other workstreams as grey notes on both tasks', async () => {
    const snapshot = structuredClone(seed)
    const byTitle = (title: string) => snapshot.tasks.find((t) => t.title === title)!
    snapshot.dependencies.push({
      taskId: byTitle('Set up staging environment').id,
      blockedByTaskId: byTitle('Design homepage').id,
    })
    renderWithApp(<ProjectPage />, { route, path, snapshot })
    await screen.findByRole('heading', { level: 1, name: 'Client website redesign' })
    expect(
      within(rowOf('Set up staging environment')).getByText('After: Design homepage (Design)'),
    ).toBeInTheDocument()
    expect(rowOf('Set up staging environment')).toHaveClass('opacity-50')
    expect(
      within(rowOf('Design homepage')).getByText('Then: Set up staging environment (Build)'),
    ).toBeInTheDocument()
  })

  it('links tasks from the row menu: Waits for…, then the task to wait for', async () => {
    const user = userEvent.setup()
    const designer = seed.projects.find((p) => p.name === 'Hire a designer')!
    const { snapshot } = renderWithApp(<ProjectPage />, {
      route: `/projects/${designer.id}`,
      path,
      snapshot: structuredClone(seed),
    })
    await screen.findByRole('heading', { level: 1, name: 'Hire a designer' })

    // Write interview plan can start any time; make it wait for the job post.
    expect(rowOf('Write interview plan')).not.toHaveClass('opacity-50')
    await user.click(screen.getByRole('button', { name: 'Task actions: Write interview plan' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Waits for…' }))
    expect(screen.getByText(/Pick the task/)).toHaveTextContent(
      'Pick the task “Write interview plan” waits for.',
    )
    await user.click(screen.getByRole('button', { name: 'Publish job post' }))

    await waitFor(() => expect(rowOf('Write interview plan')).toHaveClass('opacity-50'))
    expect(screen.queryByText(/Pick the task/)).not.toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    const ids = (await snapshot()).dependencies
      .filter((d) => d.taskId === rowOf('Write interview plan').dataset.taskId)
      .map((d) => d.blockedByTaskId)
    expect(ids).toEqual([rowOf('Publish job post').dataset.taskId])

    // And undo it from the same menu.
    await user.click(screen.getByRole('button', { name: 'Task actions: Write interview plan' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Stop waiting for “Publish job post”' }))
    await waitFor(() => expect(rowOf('Write interview plan')).not.toHaveClass('opacity-50'))
  })

  it('refuses a link that would make a loop', async () => {
    const user = userEvent.setup()
    renderPage({ route })
    await screen.findByRole('heading', { level: 1, name: 'Client website redesign' })
    // Design homepage already waits for Draft sitemap.
    await user.click(screen.getByRole('button', { name: 'Task actions: Draft sitemap' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Waits for…' }))
    await user.click(screen.getByRole('button', { name: 'Design homepage' }))
    expect(rowOf('Draft sitemap')).not.toHaveClass('opacity-50')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('cancels picking with Escape', async () => {
    const user = userEvent.setup()
    renderPage({ route })
    await screen.findByRole('heading', { level: 1, name: 'Client website redesign' })
    await user.click(screen.getByRole('button', { name: 'Task actions: Draft sitemap' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Waits for…' }))
    expect(screen.getByText(/Pick the task/)).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.queryByText(/Pick the task/)).not.toBeInTheDocument()
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

  it('adds a task from the inline "Add task" row at the end of its workstream', async () => {
    const user = userEvent.setup()
    const { snapshot } = renderPage({ route })
    expect(await screen.findByRole('button', { name: 'Add task to Design' })).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: 'New task in Design' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Add task to Design' }))
    const input = await screen.findByRole('textbox', { name: 'New task in Design' })
    await user.type(input, 'Review mockups{Enter}')

    await waitFor(async () => {
      const added = (await snapshot()).tasks.find((t) => t.title === 'Review mockups')
      const design = seed.milestones.find((m) => m.name === 'Design')!
      expect(added).toMatchObject({ projectId: website.id, milestoneId: design.id, size: 'M', position: 3 })
    })
  })

  it('cancels the inline add row with Escape', async () => {
    const user = userEvent.setup()
    const { snapshot } = renderPage({ route })
    await user.click(await screen.findByRole('button', { name: 'Add task to Design' }))
    await user.type(await screen.findByRole('textbox', { name: 'New task in Design' }), 'Nope{Escape}')
    expect(screen.queryByRole('textbox', { name: 'New task in Design' })).not.toBeInTheDocument()
    expect((await snapshot()).tasks.some((t) => t.title === 'Nope')).toBe(false)
  })

  it('reorders open tasks within a group with the row menu', async () => {
    const user = userEvent.setup()
    const { snapshot } = renderPage({ route })
    await user.click(await screen.findByRole('button', { name: 'Task actions: Design homepage' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Move up' }))

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
    await userEvent.setup().click(screen.getByRole('button', { name: 'Project actions' }))
    expect(await screen.findByRole('menuitem', { name: 'Edit project…' })).toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: 'Delete project…' })).not.toBeInTheDocument()
    expect(screen.queryByRole('menuitemradio', { name: 'On hold' })).not.toBeInTheDocument()
  })

  it('renames and deletes a workstream from its menu', async () => {
    const user = userEvent.setup()
    const { snapshot } = renderPage({ route })
    await user.click(await screen.findByRole('button', { name: 'Workstream actions: Design' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Rename workstream…' }))
    const dialog = await screen.findByRole('dialog', { name: 'Edit workstream' })
    const name = within(dialog).getByRole('textbox', { name: 'Name' })
    await user.clear(name)
    await user.type(name, 'UI design')
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    await waitFor(async () => {
      expect((await snapshot()).milestones.some((m) => m.name === 'UI design')).toBe(true)
    })

    await user.click(await screen.findByRole('button', { name: 'Workstream actions: Build' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Delete workstream…' }))
    const confirm = await screen.findByRole('alertdialog')
    expect(within(confirm).getByText('Delete workstream “Build”?')).toBeInTheDocument()
    await user.click(await within(confirm).findByRole('button', { name: 'Delete workstream' }))
    await waitFor(async () => {
      expect((await snapshot()).milestones.some((m) => m.name === 'Build')).toBe(false)
    })
  })

  it('adds a workstream from the button under the cards', async () => {
    const user = userEvent.setup()
    const { snapshot } = renderPage({ route })
    await user.click(await screen.findByRole('button', { name: 'Add workstream' }))
    const dialog = await screen.findByRole('dialog', { name: 'Add workstream' })
    await user.type(within(dialog).getByRole('textbox', { name: 'Name' }), 'Launch')
    await user.click(within(dialog).getByRole('button', { name: 'Add workstream' }))
    await waitFor(async () => {
      const added = (await snapshot()).milestones.find((m) => m.name === 'Launch')
      expect(added).toMatchObject({ projectId: website.id, position: 3 })
    })
  })

  it('shows tasks without a workstream as their own "No workstream" card', async () => {
    const stray = {
      ...seed.tasks.find((t) => t.title === 'Draft sitemap')!,
      id: 'stray',
      title: 'Stray task',
    }
    renderWithApp(<ProjectPage />, {
      route,
      path,
      snapshot: {
        ...structuredClone(seed),
        tasks: [...structuredClone(seed).tasks, { ...stray, milestoneId: null }],
      },
    })
    expect(await screen.findByRole('heading', { level: 3, name: 'No workstream' })).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual([
      'No workstream',
      'Discovery',
      'Design',
      'Build',
    ])
  })

  it('deletes a project after confirmation and goes back to the list', async () => {
    const user = userEvent.setup()
    const { snapshot } = renderPage({ route })
    await user.click(await screen.findByRole('button', { name: 'Project actions' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Delete project…' }))
    await user.click(
      await within(await screen.findByRole('alertdialog')).findByRole('button', { name: 'Delete project' }),
    )
    await waitFor(async () => {
      expect((await snapshot()).projects.some((p) => p.id === website.id)).toBe(false)
    })
  })
})
