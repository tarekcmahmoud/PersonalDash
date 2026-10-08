import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { seedSnapshot } from '../../data/seed'
import { freezeToday, renderWithApp, TEST_TODAY, unfreezeToday } from '../../test/renderWithApp'
import { InboxPage } from './InboxPage'

beforeEach(() => freezeToday())
afterEach(() => unfreezeToday())

const seed = seedSnapshot(TEST_TODAY)
const render = (route = '/inbox') => renderWithApp(<InboxPage />, { route, snapshot: structuredClone(seed) })

describe('InboxPage', () => {
  it('lists the inbox tasks', async () => {
    render()
    expect(await screen.findByRole('button', { name: 'Renew passport' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reply to Sam about conference' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Draft sitemap' })).not.toBeInTheDocument()
  })

  it('captures a task with Enter as a size S inbox task', async () => {
    const user = userEvent.setup()
    const { snapshot } = render()
    await user.type(await screen.findByRole('textbox', { name: 'Capture a task' }), 'Call the plumber{Enter}')

    expect(await screen.findByRole('button', { name: 'Call the plumber' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Capture a task' })).toHaveValue('')
    await waitFor(async () => {
      const created = (await snapshot()).tasks.find((t) => t.title === 'Call the plumber')
      expect(created).toMatchObject({ projectId: null, milestoneId: null, size: 'S', status: 'todo' })
    })
  })

  it('files a task into a project, at the end of its tasks', async () => {
    const user = userEvent.setup()
    const { snapshot } = render()
    await user.click(await screen.findByRole('button', { name: 'File to… Renew passport' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Hire a designer' }))

    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Renew passport' })).not.toBeInTheDocument(),
    )
    const designer = seed.projects.find((p) => p.name === 'Hire a designer')!
    const filed = (await snapshot()).tasks.find((t) => t.title === 'Renew passport')!
    expect(filed).toMatchObject({ projectId: designer.id, milestoneId: null, position: 6 })
  })

  it('files a task into a milestone of a project', async () => {
    const user = userEvent.setup()
    const { snapshot } = render()
    await user.click(await screen.findByRole('button', { name: 'File to… Reply to Sam about conference' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Client website redesign › Build' }))

    const build = seed.milestones.find((m) => m.name === 'Build')!
    await waitFor(async () => {
      const filed = (await snapshot()).tasks.find((t) => t.title === 'Reply to Sam about conference')!
      expect(filed).toMatchObject({ projectId: build.projectId, milestoneId: build.id, position: 4 })
    })
  })

  it('does not offer on-hold projects when filing', async () => {
    const user = userEvent.setup()
    render()
    await user.click(await screen.findByRole('button', { name: 'File to… Renew passport' }))
    const menu = await screen.findByRole('menu')
    expect(within(menu).queryByRole('menuitem', { name: 'Kitchen renovation' })).not.toBeInTheDocument()
    expect(within(menu).getByRole('menuitem', { name: 'Admin / Misc' })).toBeInTheDocument()
  })

  it('shows "Inbox zero" when empty', async () => {
    const snapshot = structuredClone(seed)
    snapshot.tasks = snapshot.tasks.filter((t) => t.projectId !== null)
    renderWithApp(<InboxPage />, { snapshot })
    expect(await screen.findByText('Inbox zero')).toBeInTheDocument()
  })

  it('opens the task dialog via the ?task= param', async () => {
    const passport = seed.tasks.find((t) => t.title === 'Renew passport')!
    render(`/inbox?task=${passport.id}`)
    const dialog = await screen.findByRole('dialog', { name: 'Edit task' })
    expect(within(dialog).getByRole('textbox', { name: /Title/ })).toHaveValue('Renew passport')
  })
})
