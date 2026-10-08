import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { seedSnapshot } from '../../data/seed'
import { freezeToday, renderWithApp, TEST_TODAY, unfreezeToday } from '../../test/renderWithApp'
import { TaskDialogHost } from './TaskDialogHost'

beforeEach(() => freezeToday())
afterEach(() => unfreezeToday())

const seed = seedSnapshot(TEST_TODAY)
const task = (title: string) => seed.tasks.find((t) => t.title === title)!
const project = (name: string) => seed.projects.find((p) => p.name === name)!

const openDialog = async (title: string) => {
  const result = renderWithApp(<TaskDialogHost />, {
    route: `/?task=${task(title).id}`,
    snapshot: structuredClone(seed),
  })
  const dialog = await screen.findByRole('dialog', { name: 'Edit task' })
  return { ...result, dialog }
}

describe('TaskDialog', () => {
  it('rejects a blocker that would create a dependency cycle', async () => {
    const user = userEvent.setup()
    const { dialog, snapshot } = await openDialog('Publish job post')

    // "Review applications" is already blocked by "Publish job post"; blocking the reverse is a loop.
    await user.selectOptions(
      within(dialog).getByRole('combobox', { name: 'Add a blocker' }),
      'Review applications and shortlist',
    )
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(/would create a loop/)
    expect(within(dialog).queryByRole('button', { name: /Remove blocker/ })).not.toBeInTheDocument()

    // A harmless blocker is accepted and saved through setDependencies.
    await user.selectOptions(
      within(dialog).getByRole('combobox', { name: 'Add a blocker' }),
      'Agree budget and contract type',
    )
    expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument()
    expect(
      within(dialog).getByRole('button', { name: 'Remove blocker: Agree budget and contract type' }),
    ).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))

    await waitFor(async () => {
      const deps = (await snapshot()).dependencies.filter((d) => d.taskId === task('Publish job post').id)
      expect(deps).toEqual([
        { taskId: task('Publish job post').id, blockedByTaskId: task('Agree budget and contract type').id },
      ])
    })
  })

  it('splits an XL task into subtasks right after it and deletes the original', async () => {
    const user = userEvent.setup()
    const { dialog, snapshot } = await openDialog('Build CMS integration')

    await user.click(within(dialog).getByRole('textbox', { name: 'Subtasks, one per line' }))
    await user.paste('Content model [S]\nEditor [L]\nPublishing flow')
    await user.click(within(dialog).getByRole('button', { name: 'Split into subtasks' }))
    await user.click(await screen.findByRole('button', { name: 'Split task' }))

    await waitFor(async () => {
      const snap = await snapshot()
      expect(snap.tasks.some((t) => t.title === 'Build CMS integration')).toBe(false)
    })
    const snap = await snapshot()
    const build = snap.milestones.find((m) => m.name === 'Build')!
    const inOrder = snap.tasks
      .filter((t) => t.milestoneId === build.id)
      .sort((a, b) => a.position - b.position)
      .map((t) => `${t.title} [${t.size}]`)
    expect(inOrder).toEqual([
      'Set up staging environment [S]',
      'Content model [S]',
      'Editor [L]',
      'Publishing flow [M]',
      'Build homepage [L]',
      'Build content pages [M]',
    ])
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Edit task' })).not.toBeInTheDocument())
  })

  it('only offers the split helper for XL tasks', async () => {
    const { dialog } = await openDialog('Draft sitemap')
    expect(within(dialog).queryByRole('button', { name: 'Split into subtasks' })).not.toBeInTheDocument()
  })

  it('saves edits: title, size, waiting info and checklist', async () => {
    const user = userEvent.setup()
    const { dialog, snapshot } = await openDialog('Draft sitemap')

    const title = within(dialog).getByRole('textbox', { name: /Title/ })
    await user.clear(title)
    await user.type(title, 'Draft the sitemap')
    await user.click(within(dialog).getByRole('button', { name: 'L' }))
    await user.selectOptions(within(dialog).getByRole('combobox', { name: 'Status' }), 'Waiting')
    await user.type(within(dialog).getByRole('textbox', { name: 'Waiting on' }), 'Client')
    await user.type(
      within(dialog).getByRole('textbox', { name: 'New checklist item' }),
      'Send for review{Enter}',
    )
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))

    await waitFor(async () => {
      const snap = await snapshot()
      const saved = snap.tasks.find((t) => t.id === task('Draft sitemap').id)!
      expect(saved).toMatchObject({
        title: 'Draft the sitemap',
        size: 'L',
        status: 'waiting',
        waitingOn: 'Client',
      })
      const items = snap.checklist
        .filter((c) => c.taskId === saved.id)
        .sort((a, b) => a.position - b.position)
      expect(items.map((c) => c.text)).toEqual([
        'Review analytics with client',
        'List every existing URL',
        'Agree page hierarchy',
        'Send for review',
      ])
    })
  })

  it('discards changes on Cancel', async () => {
    const user = userEvent.setup()
    const { dialog, snapshot } = await openDialog('Draft sitemap')
    const title = within(dialog).getByRole('textbox', { name: /Title/ })
    await user.clear(title)
    await user.type(title, 'Something else')
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect((await snapshot()).tasks.find((t) => t.id === task('Draft sitemap').id)!.title).toBe(
      'Draft sitemap',
    )
  })

  it('moves a task to another project, to the end of that group', async () => {
    const user = userEvent.setup()
    const { dialog, snapshot } = await openDialog('Renew car insurance')
    await user.selectOptions(within(dialog).getByRole('combobox', { name: 'Project' }), 'Hire a designer')
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    await waitFor(async () => {
      const moved = (await snapshot()).tasks.find((t) => t.id === task('Renew car insurance').id)!
      expect(moved).toMatchObject({
        projectId: project('Hire a designer').id,
        milestoneId: null,
        position: 6,
      })
    })
  })

  it('unplans a planned task on save', async () => {
    const user = userEvent.setup()
    const { dialog, snapshot } = await openDialog('Design homepage')
    expect(within(dialog).getByText(/Planned for the week of/)).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Unplan' }))
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    await waitFor(async () => {
      const saved = (await snapshot()).tasks.find((t) => t.id === task('Design homepage').id)!
      expect(saved.weekStart).toBeNull()
      expect(saved.pinnedDay).toBeNull()
    })
  })

  it('deletes a task after confirmation', async () => {
    const user = userEvent.setup()
    const { dialog, snapshot } = await openDialog('Draft sitemap')
    await user.click(within(dialog).getByRole('button', { name: 'Delete task' }))
    const confirm = await screen.findByRole('alertdialog')
    await user.click(within(confirm).getByRole('button', { name: 'Delete task' }))
    await waitFor(async () => {
      expect((await snapshot()).tasks.some((t) => t.id === task('Draft sitemap').id)).toBe(false)
    })
  })
})
