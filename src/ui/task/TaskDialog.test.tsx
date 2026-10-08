import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { seedSnapshot } from '../../data/seed'
import { addDaysISO, weekStartOf } from '../../domain/week'
import { freezeToday, renderWithApp, TEST_TODAY, unfreezeToday } from '../../test/renderWithApp'
import { TaskDialogHost } from './TaskDialogHost'

beforeEach(() => freezeToday())
afterEach(() => unfreezeToday())

const seed = seedSnapshot(TEST_TODAY)
const task = (title: string) => seed.tasks.find((t) => t.title === title)!
const project = (name: string) => seed.projects.find((p) => p.name === name)!

/** Choose an option in a shadcn (Radix) Select. */
const pick = async (
  user: ReturnType<typeof userEvent.setup>,
  trigger: HTMLElement,
  option: string | RegExp,
) => {
  await user.click(trigger)
  await user.click(await screen.findByRole('option', { name: option }))
}

const openDialog = async (title: string) => {
  const result = renderWithApp(<TaskDialogHost />, {
    route: `/?task=${task(title).id}`,
    snapshot: structuredClone(seed),
  })
  const dialog = await screen.findByRole('dialog', { name: 'Edit task' })
  return { ...result, dialog }
}

describe('TaskDialog', () => {
  it('links the task to tasks it waits for and rejects loops', async () => {
    const user = userEvent.setup()
    const { dialog, snapshot } = await openDialog('Publish job post')

    // It already waits for the budget, so the section starts open.
    const add = () => within(dialog).getByRole('combobox', { name: 'Add a task it waits for' })
    expect(
      within(dialog).getByRole('button', { name: 'Stop waiting for: Agree budget and contract type' }),
    ).toBeInTheDocument()

    // "Review applications" already waits for "Publish job post"; the reverse would be a loop.
    await pick(user, add(), /Review applications and shortlist/)
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(/would create a loop/)
    expect(within(dialog).queryByRole('button', { name: /Stop waiting for: Review/ })).not.toBeInTheDocument()

    // A harmless link is accepted and saved through setDependencies.
    await pick(user, add(), /Write interview plan/)
    expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))

    await waitFor(async () => {
      const deps = (await snapshot()).dependencies.filter((d) => d.taskId === task('Publish job post').id)
      expect(deps.map((d) => d.blockedByTaskId).sort()).toEqual(
        [task('Agree budget and contract type').id, task('Write interview plan').id].sort(),
      )
    })
  })

  it('splits an XL task into subtasks right after it and deletes the original', async () => {
    const user = userEvent.setup()
    const { dialog, snapshot } = await openDialog('Build CMS integration')

    // XL tasks open the split section by default.
    await user.click(within(dialog).getByRole('textbox', { name: 'Subtasks, one per line' }))
    await user.paste('Content model [S]\nEditor [L]\nPublishing flow')
    await user.click(within(dialog).getByRole('button', { name: 'Split into subtasks' }))
    await user.click(
      await within(await screen.findByRole('alertdialog')).findByRole('button', { name: 'Split task' }),
    )

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
    // Links: the first subtask takes over the XL task's own link, the rest run in order, and what waited for
    // the XL task now waits for the last subtask.
    const title = (id: string) => snap.tasks.find((t) => t.id === id)?.title
    const waitsFor = (name: string) =>
      snap.dependencies.filter((d) => title(d.taskId) === name).map((d) => title(d.blockedByTaskId))
    expect(waitsFor('Content model')).toEqual(['Set up staging environment'])
    expect(waitsFor('Editor')).toEqual(['Content model'])
    expect(waitsFor('Publishing flow')).toEqual(['Editor'])
    expect(waitsFor('Build homepage')).toEqual(['Publishing flow'])
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
    await user.click(within(dialog).getByRole('radio', { name: 'L' }))
    await pick(user, within(dialog).getByRole('combobox', { name: 'Status' }), 'Waiting')
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
    await pick(user, within(dialog).getByRole('combobox', { name: 'Project' }), 'Hire a designer')
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

  it('keeps secondary sections collapsed unless they have content', async () => {
    const { dialog } = await openDialog('Draft sitemap')
    // Draft sitemap has a checklist, so it starts open; it waits for nothing.
    expect(within(dialog).getByRole('button', { name: /^Checklist( \d+)?$/ })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
    expect(within(dialog).getByRole('button', { name: 'Waits for' })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
  })

  it('pins a planned task to a day with the Day select', async () => {
    const user = userEvent.setup()
    const { dialog, snapshot } = await openDialog('Design homepage')
    const planned = task('Design homepage')
    expect(planned.weekStart).not.toBeNull()
    await pick(user, within(dialog).getByRole('combobox', { name: 'Day' }), /^Fri /)
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    await waitFor(async () => {
      const saved = (await snapshot()).tasks.find((t) => t.id === planned.id)!
      expect(saved.weekStart).toBe(planned.weekStart)
      expect(saved.pinnedDay).toBe(addDaysISO(planned.weekStart!, 4))
    })
  })

  it('plans an unplanned task into the current week on a chosen day', async () => {
    const user = userEvent.setup()
    const { dialog, snapshot } = await openDialog('Renew car insurance')
    expect(task('Renew car insurance').weekStart).toBeNull()
    expect(within(dialog).getByRole('combobox', { name: 'Day' })).toHaveTextContent('Not planned')
    await pick(user, within(dialog).getByRole('combobox', { name: 'Day' }), /^Wed /)
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    const monday = weekStartOf(TEST_TODAY)
    await waitFor(async () => {
      const saved = (await snapshot()).tasks.find((t) => t.id === task('Renew car insurance').id)!
      expect(saved).toMatchObject({ weekStart: monday, pinnedDay: addDaysISO(monday, 2) })
    })
  })

  it('unplans a planned task with "Not planned"', async () => {
    const user = userEvent.setup()
    const { dialog, snapshot } = await openDialog('Design homepage')
    await pick(user, within(dialog).getByRole('combobox', { name: 'Day' }), 'Not planned')
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

  it('delegates a task to a collaborator with a follow-up date, taking it out of the week', async () => {
    const user = userEvent.setup()
    // "Draft sitemap" is planned this week in the website project (collaborators: Sam Lee, Priya Shah).
    const { dialog, snapshot } = await openDialog('Draft sitemap')
    expect(within(dialog).queryByLabelText('Follow up on')).not.toBeInTheDocument()

    await pick(user, within(dialog).getByRole('combobox', { name: 'Assigned to' }), 'Sam Lee')
    // The Day field gives way to a follow-up date, three days out by default.
    expect(within(dialog).queryByRole('combobox', { name: 'Day' })).not.toBeInTheDocument()
    expect(within(dialog).getByLabelText('Follow up on')).toHaveValue(addDaysISO(TEST_TODAY, 3))
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))

    await waitFor(async () => {
      const saved = (await snapshot()).tasks.find((t) => t.id === task('Draft sitemap').id)!
      expect(saved).toMatchObject({
        assigneeId: seed.people.find((p) => p.name === 'Sam Lee')!.id,
        followUpDate: addDaysISO(TEST_TODAY, 3),
        weekStart: null,
        pinnedDay: null,
      })
    })
  })

  it('takes a delegated task back', async () => {
    const user = userEvent.setup()
    const { dialog, snapshot } = await openDialog('Design content page templates')
    expect(within(dialog).getByRole('combobox', { name: 'Assigned to' })).toHaveTextContent('Priya Shah')
    await pick(user, within(dialog).getByRole('combobox', { name: 'Assigned to' }), 'Me')
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    await waitFor(async () => {
      const saved = (await snapshot()).tasks.find((t) => t.id === task('Design content page templates').id)!
      expect(saved).toMatchObject({ assigneeId: null, followUpDate: null })
    })
  })
})
