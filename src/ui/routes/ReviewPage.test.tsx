import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { seedSnapshot } from '../../data/seed'
import { makeTask } from '../../domain/factories'
import type { Snapshot, Task } from '../../domain/types'
import { freezeToday, renderWithApp, TEST_TODAY, unfreezeToday } from '../../test/renderWithApp'
import { ReviewPage } from './ReviewPage'

// TEST_TODAY is Thursday 2026-10-08: the new week starts Oct 5, the reviewed week Sep 28.
const NEW_WEEK = '2026-10-05'
const PAST_WEEK = '2026-09-28'

beforeEach(() => {
  freezeToday()
  window.scrollTo = vi.fn()
})
afterEach(() => unfreezeToday())

/** The seed's projects, with tasks replaced by a crafted set around the reviewed week. */
function craft(): { snapshot: Snapshot; task: (title: string) => Task; projectId: (name: string) => string } {
  const snapshot = structuredClone(seedSnapshot(TEST_TODAY))
  const projectId = (name: string) => snapshot.projects.find((p) => p.name === name)!.id
  const website = projectId('Client website redesign')
  const board = projectId('Quarterly board report')
  const doneAt = (day: string) => `${day}T12:00:00.000Z`

  snapshot.tasks = [
    makeTask({
      title: 'Done A',
      projectId: website,
      status: 'done',
      weekStart: PAST_WEEK,
      completedAt: doneAt('2026-09-29'),
    }),
    makeTask({
      title: 'Done B',
      projectId: website,
      status: 'done',
      weekStart: PAST_WEEK,
      completedAt: doneAt('2026-09-30'),
    }),
    makeTask({
      title: 'Done C',
      projectId: board,
      status: 'done',
      weekStart: PAST_WEEK,
      completedAt: doneAt('2026-10-01'),
    }),
    makeTask({ title: 'Slip once', projectId: website, weekStart: PAST_WEEK, slipCount: 0, position: 1 }),
    makeTask({
      title: 'Slip chronic',
      projectId: board,
      weekStart: PAST_WEEK,
      slipCount: 1,
      pinnedDay: '2026-09-30',
      position: 2,
    }),
    makeTask({ title: 'File me', projectId: null, position: 0 }),
    makeTask({ title: 'Delete me', projectId: null, position: 1 }),
  ]
  snapshot.checklist = []
  snapshot.dependencies = []
  snapshot.weeks = []
  return { snapshot, task: (title) => snapshot.tasks.find((t) => t.title === title)!, projectId }
}

const render = (snapshot: Snapshot, route = '/review') =>
  renderWithApp(<ReviewPage />, { route, path: '/review', snapshot })

const taskIn = async (snap: () => Promise<Snapshot>, title: string) =>
  (await snap()).tasks.find((t) => t.title === title)!

describe('ReviewPage', () => {
  it('shows which weeks are reviewed and planned, and the compact step line', async () => {
    render(craft().snapshot)
    expect(await screen.findByText('Reviewing Sep 28 – Oct 4 → planning Oct 5 – 11')).toBeInTheDocument()
    expect(await screen.findByText('Step 1 of 4 · Look back')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Look back/ })).toHaveAttribute('aria-current', 'step')
  })

  it('step 1 shows last week in numbers: done per project, leftovers, untouched projects', async () => {
    render(craft().snapshot)
    expect(await screen.findByText('tasks done')).toBeInTheDocument()
    expect(screen.getByText('tasks done').previousElementSibling).toHaveTextContent('3')
    expect(screen.getByText('left over').previousElementSibling).toHaveTextContent('2')
    expect(screen.getByText('projects untouched').previousElementSibling).toHaveTextContent('2')

    const website = screen.getByText('Client website redesign').closest('details')!
    expect(within(website).getByText('2')).toBeInTheDocument()
    expect(within(website).getByText('Done A')).toBeInTheDocument()
    expect(within(website).getByText('Done B')).toBeInTheDocument()
    const board = screen.getByText('Quarterly board report').closest('details')!
    expect(within(board).getByText('Done C')).toBeInTheDocument()

    expect(screen.getByText('Hire a designer')).toBeInTheDocument()
    expect(screen.getByText('Personal: run a half marathon')).toBeInTheDocument()
    expect(screen.getAllByText('No progress')).toHaveLength(2)
  })

  it('moves between steps with Next/Back and the ?step= param', async () => {
    const user = userEvent.setup()
    render(craft().snapshot)
    await screen.findByText('tasks done')
    await user.click(screen.getByRole('button', { name: /^Next/ }))
    expect(await screen.findByText('Step 2 of 4 · Leftovers')).toBeInTheDocument()
    expect(screen.getByTestId('location')).toHaveTextContent('/review?step=2')

    await user.click(screen.getByRole('button', { name: 'Back' }))
    expect(await screen.findByText('Step 1 of 4 · Look back')).toBeInTheDocument()
  })

  describe('leftovers', () => {
    it('carry over moves the task into the new week and counts the slip', async () => {
      const user = userEvent.setup()
      const { snapshot } = render(craft().snapshot, '/review?step=2')
      await user.click(await screen.findByRole('button', { name: 'Carry over Slip once' }))

      await waitFor(async () => {
        expect(await taskIn(snapshot, 'Slip once')).toMatchObject({ weekStart: NEW_WEEK, slipCount: 1 })
      })
      expect(screen.getByText('Carried over to Oct 5 – 11')).toBeInTheDocument()
      // The decided row stays visible, with Undo instead of the decision buttons.
      expect(screen.queryByRole('button', { name: 'Carry over Slip once' })).not.toBeInTheDocument()
    })

    it('carry over clears the pinned day', async () => {
      const user = userEvent.setup()
      const { snapshot } = render(craft().snapshot, '/review?step=2')
      await user.click(await screen.findByRole('button', { name: 'Carry over Slip chronic' }))
      await waitFor(async () => {
        expect(await taskIn(snapshot, 'Slip chronic')).toMatchObject({
          weekStart: NEW_WEEK,
          pinnedDay: null,
          slipCount: 2,
        })
      })
    })

    it('back to project unplans the task and counts the slip', async () => {
      const user = userEvent.setup()
      const { snapshot } = render(craft().snapshot, '/review?step=2')
      await user.click(await screen.findByRole('button', { name: 'Back to project Slip once' }))

      await waitFor(async () => {
        expect(await taskIn(snapshot, 'Slip once')).toMatchObject({
          weekStart: null,
          pinnedDay: null,
          slipCount: 1,
        })
      })
      expect(screen.getByText('Back in Client website redesign, not planned')).toBeInTheDocument()
    })

    it('Undo reverts the decision', async () => {
      const user = userEvent.setup()
      const { snapshot } = render(craft().snapshot, '/review?step=2')
      await user.click(await screen.findByRole('button', { name: 'Carry over Slip once' }))
      await user.click(await screen.findByRole('button', { name: 'Undo decision for Slip once' }))

      await waitFor(async () => {
        expect(await taskIn(snapshot, 'Slip once')).toMatchObject({ weekStart: PAST_WEEK, slipCount: 0 })
      })
      expect(await screen.findByRole('button', { name: 'Carry over Slip once' })).toBeInTheDocument()
    })

    it('keeps Next disabled until every leftover has a decision', async () => {
      const user = userEvent.setup()
      render(craft().snapshot, '/review?step=2')
      const next = await screen.findByRole('button', { name: /^Next/ })
      expect(next).toBeDisabled()
      expect(screen.getByText('Decide on 2 more tasks to continue')).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Carry over Slip once' }))
      expect(next).toBeDisabled()
      await user.click(screen.getByRole('button', { name: 'Back to project Slip chronic' }))
      await waitFor(() => expect(next).toBeEnabled())
    })

    it('"Carry over all" and "Return all" decide the remaining rows', async () => {
      const user = userEvent.setup()
      const { snapshot } = render(craft().snapshot, '/review?step=2')
      await user.click(await screen.findByRole('button', { name: 'Back to project Slip once' }))
      await user.click(screen.getByRole('button', { name: 'Carry over all' }))

      await waitFor(async () => {
        expect(await taskIn(snapshot, 'Slip chronic')).toMatchObject({ weekStart: NEW_WEEK, slipCount: 2 })
      })
      // The task decided individually keeps its own decision.
      expect(await taskIn(snapshot, 'Slip once')).toMatchObject({ weekStart: null, slipCount: 1 })
      expect(screen.getByRole('button', { name: 'Carry over all' })).toBeDisabled()
      expect(screen.getByRole('button', { name: /^Next/ })).toBeEnabled()
    })

    it('"Return all" unplans every leftover', async () => {
      const user = userEvent.setup()
      const { snapshot } = render(craft().snapshot, '/review?step=2')
      await user.click(await screen.findByRole('button', { name: 'Return all' }))
      await waitFor(async () => {
        const s = await snapshot()
        expect(s.tasks.filter((t) => t.title.startsWith('Slip')).map((t) => t.weekStart)).toEqual([
          null,
          null,
        ])
      })
    })

    it('flags a chronic slipper (counting this slip) with a note and an Open task link', async () => {
      const crafted = craft()
      render(crafted.snapshot, '/review?step=2')
      expect(
        await screen.findByText('Slipped 2 times — split it, or decide if it still matters'),
      ).toBeInTheDocument()
      const chronic = crafted.task('Slip chronic')
      expect(screen.getByRole('link', { name: 'Open task Slip chronic' })).toHaveAttribute(
        'href',
        `/projects/${chronic.projectId}?task=${chronic.id}`,
      )
      expect(screen.getAllByText(/split it, or decide/)).toHaveLength(1)
      expect(screen.queryByRole('link', { name: 'Open task Slip once' })).not.toBeInTheDocument()
    })

    it('shows a blankslate and an enabled Next when nothing is left over', async () => {
      const crafted = craft()
      crafted.snapshot.tasks = crafted.snapshot.tasks.filter((t) => !t.title.startsWith('Slip'))
      render(crafted.snapshot, '/review?step=2')
      expect(await screen.findByText('Nothing left over')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /^Next/ })).toBeEnabled()
    })
  })

  describe('inbox triage', () => {
    it('files an inbox task into a project', async () => {
      const user = userEvent.setup()
      const crafted = craft()
      const { snapshot } = render(crafted.snapshot, '/review?step=3')
      await user.click(await screen.findByRole('button', { name: 'File to… File me' }))
      await user.click(await screen.findByRole('menuitem', { name: 'Hire a designer' }))

      await waitFor(async () => {
        expect(await taskIn(snapshot, 'File me')).toMatchObject({
          projectId: crafted.projectId('Hire a designer'),
        })
      })
      await waitFor(() => expect(screen.queryByText('File me')).not.toBeInTheDocument())
    })

    it('deletes a task after confirming, then shows the empty state', async () => {
      const user = userEvent.setup()
      const { snapshot } = render(craft().snapshot, '/review?step=3')
      await user.click(await screen.findByRole('button', { name: 'Delete Delete me' }))
      const dialog = await screen.findByRole('alertdialog')
      expect(within(dialog).getByText('Delete "Delete me"?')).toBeInTheDocument()
      // Nothing is deleted until confirmed.
      expect(await taskIn(snapshot, 'Delete me')).toBeDefined()
      await user.click(within(dialog).getByRole('button', { name: 'Delete' }))

      await waitFor(async () => expect(await taskIn(snapshot, 'Delete me')).toBeUndefined())

      await user.click(screen.getByRole('button', { name: 'File to… File me' }))
      await user.click(await screen.findByRole('menuitem', { name: 'Admin / Misc' }))
      expect(await screen.findByText('Inbox is empty')).toBeInTheDocument()
    })

    it('does not delete when cancelled', async () => {
      const user = userEvent.setup()
      const { snapshot } = render(craft().snapshot, '/review?step=3')
      await user.click(await screen.findByRole('button', { name: 'Delete Delete me' }))
      const dialog = await screen.findByRole('alertdialog')
      await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
      expect(await taskIn(snapshot, 'Delete me')).toBeDefined()
      expect(screen.getByText('Delete me')).toBeInTheDocument()
    })
  })

  describe('finishing', () => {
    it('plans the week and stamps reviewedAt on the new week, keeping the capacity override', async () => {
      const user = userEvent.setup()
      const crafted = craft()
      crafted.snapshot.weeks = [{ weekStart: NEW_WEEK, capacityOverride: 20, reviewedAt: null }]
      const { snapshot } = render(crafted.snapshot, '/review?step=4')
      expect(await screen.findByText(/h planned of 20h/)).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Finish review' }))

      await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(/^\/$/))
      const week = (await snapshot()).weeks.find((w) => w.weekStart === NEW_WEEK)!
      expect(week.capacityOverride).toBe(20)
      expect(week.reviewedAt).toMatch(/^2026-10-08T/)
    })

    it('creates the week record when there was none', async () => {
      const user = userEvent.setup()
      const { snapshot } = render(craft().snapshot, '/review?step=4')
      await user.click(await screen.findByRole('button', { name: 'Finish review' }))
      await waitFor(async () => {
        const week = (await snapshot()).weeks.find((w) => w.weekStart === NEW_WEEK)
        expect(week).toMatchObject({ capacityOverride: null })
        expect(week?.reviewedAt).toBeTruthy()
      })
    })

    it('supports ?week= to review another week', async () => {
      render(craft().snapshot, '/review?week=2026-10-12')
      expect(await screen.findByText('Reviewing Oct 5 – 11 → planning Oct 12 – 18')).toBeInTheDocument()
    })

    it('says so when the week was already reviewed, and can run again', async () => {
      const user = userEvent.setup()
      const crafted = craft()
      crafted.snapshot.weeks = [
        { weekStart: NEW_WEEK, capacityOverride: null, reviewedAt: '2026-10-05T08:00:00' },
      ]
      render(crafted.snapshot)
      expect(await screen.findByText(/You already reviewed this week on Monday, Oct 5/)).toBeInTheDocument()
      expect(screen.queryByRole('navigation', { name: 'Review steps' })).not.toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Review again' }))
      expect(await screen.findByRole('navigation', { name: 'Review steps' })).toBeInTheDocument()
    })
  })
})
