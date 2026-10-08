import { BaseStyles, ThemeProvider } from '@primer/react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement, ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { HealthFlag } from '../../domain/health'
import { makeProject, makeTask } from '../../domain/factories'
import { CapacityBar } from './CapacityBar'
import { HealthBadges } from './HealthBadges'
import { ProjectObjective } from './ProjectObjective'
import { SizeLabel } from './SizeLabel'
import { TaskRow } from './TaskRow'

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider colorMode="light">
      <BaseStyles>{children}</BaseStyles>
    </ThemeProvider>
  )
}

function renderUI(ui: ReactElement) {
  return render(ui, { wrapper: Wrapper })
}

const thisYear = new Date().getFullYear()

describe('SizeLabel', () => {
  it('shows S/M/L as plain labels with hours meaning in the title', () => {
    renderUI(<SizeLabel size="M" />)
    expect(screen.getByText('M')).toHaveAttribute('title', '≈half day')
  })

  it('shows XL as "XL · split" with the split hint', () => {
    renderUI(<SizeLabel size="XL" />)
    const label = screen.getByText('XL · split')
    expect(label).toHaveAttribute('title', 'Too big or unclear — split before scheduling')
  })
})

describe('CapacityBar', () => {
  it('shows planned of capacity with one decimal and no trailing ".0"', () => {
    renderUI(<CapacityBar planned={12.5} capacity={22} />)
    expect(screen.getByText('12.5h planned of 22h')).toBeInTheDocument()
    expect(screen.queryByText(/over/)).not.toBeInTheDocument()
  })

  it('drops ".0" from whole hours', () => {
    renderUI(<CapacityBar planned={10} capacity={20} />)
    expect(screen.getByText('10h planned of 20h')).toBeInTheDocument()
  })

  it('calls out hours over capacity', () => {
    renderUI(<CapacityBar planned={25} capacity={22} />)
    expect(screen.getByText('25h planned of 22h')).toBeInTheDocument()
    expect(screen.getByText('· 3h over').className).toMatch(/over/)
  })

  it('shows meeting hours when given and positive, and not when zero', () => {
    const { unmount } = renderUI(<CapacityBar planned={5} capacity={20} meetingHours={9} />)
    expect(screen.getByText('· 9h in meetings')).toBeInTheDocument()
    unmount()
    renderUI(<CapacityBar planned={5} capacity={20} meetingHours={0} />)
    expect(screen.queryByText(/in meetings/)).not.toBeInTheDocument()
  })

  it('exposes the bar as "Capacity used" and caps it at 100%', () => {
    renderUI(<CapacityBar planned={30} capacity={20} />)
    const bar = screen.getByRole('progressbar', { name: 'Capacity used' })
    expect(bar).toHaveAttribute('aria-valuenow', '100')
  })

  it('treats zero capacity with planned work as full', () => {
    renderUI(<CapacityBar planned={2} capacity={0} />)
    expect(screen.getByRole('progressbar', { name: 'Capacity used' })).toHaveAttribute('aria-valuenow', '100')
  })
})

describe('HealthBadges', () => {
  it('renders nothing for no flags', () => {
    const { container } = render(<HealthBadges flags={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders a label for every flag kind', () => {
    const flags: HealthFlag[] = [
      { kind: 'neglected' },
      { kind: 'below_min', planned: 1, min: 3 },
      { kind: 'deadline_soon', date: '2026-10-20', dateKind: 'hard', daysLeft: 3 },
      { kind: 'overdue', date: '2026-10-01', dateKind: 'soft', daysOver: 7 },
      { kind: 'no_next_step' },
    ]
    renderUI(<HealthBadges flags={flags} />)
    expect(screen.getByText('Nothing planned')).toBeInTheDocument()
    expect(screen.getByText('1/3 this week')).toBeInTheDocument()
    expect(screen.getByText('Due in 3d')).toBeInTheDocument()
    expect(screen.getByText('Overdue 7d')).toBeInTheDocument()
    expect(screen.getByText('No next step')).toBeInTheDocument()
  })

  it('shows "Due today" for a soft deadline with zero days left', () => {
    renderUI(
      <HealthBadges flags={[{ kind: 'deadline_soon', date: '2026-10-08', dateKind: 'soft', daysLeft: 0 }]} />,
    )
    expect(screen.getByText('Due today')).toBeInTheDocument()
  })
})

describe('ProjectObjective', () => {
  it('shows a hard deadline as "Deadline · <date>"', () => {
    const project = makeProject({
      name: 'Launch',
      outcome: 'Users can sign up',
      targetDate: `${thisYear}-12-15`,
      dateKind: 'hard',
    })
    renderUI(<ProjectObjective project={project} />)
    expect(screen.getByText('Users can sign up')).toBeInTheDocument()
    expect(screen.getByText('Deadline · Dec 15')).toBeInTheDocument()
  })

  it('shows a soft target from another year with the year appended', () => {
    const project = makeProject({
      name: 'Book',
      outcome: 'Draft done',
      targetDate: `${thisYear + 1}-03-01`,
      dateKind: 'soft',
    })
    renderUI(<ProjectObjective project={project} />)
    expect(screen.getByText(`Target · Mar 1 ${thisYear + 1}`)).toBeInTheDocument()
  })

  it('shows "No outcome set" when the outcome is empty and no label without a target date', () => {
    const project = makeProject({ name: 'Misc', outcome: '', targetDate: null })
    renderUI(<ProjectObjective project={project} compact />)
    expect(screen.getByText('No outcome set')).toBeInTheDocument()
    expect(screen.queryByText(/Deadline|Target/)).not.toBeInTheDocument()
  })
})

describe('TaskRow', () => {
  it('renders the title and size', () => {
    renderUI(<TaskRow task={makeTask({ title: 'Draft spec', size: 'L' })} />)
    expect(screen.getByTestId('task-row')).toHaveTextContent('Draft spec')
    expect(screen.getByText('L')).toBeInTheDocument()
  })

  it('calls onToggleDone with the task when the checkbox is clicked', async () => {
    const user = userEvent.setup()
    const onToggleDone = vi.fn()
    const task = makeTask({ title: 'Draft spec' })
    renderUI(<TaskRow task={task} onToggleDone={onToggleDone} />)

    const checkbox = screen.getByRole('checkbox', { name: 'Mark "Draft spec" done' })
    expect(checkbox).not.toBeChecked()
    await user.click(checkbox)
    expect(onToggleDone).toHaveBeenCalledTimes(1)
    expect(onToggleDone).toHaveBeenCalledWith(task)
  })

  it('shows a done task as checked, struck through and marked by status', () => {
    const task = makeTask({ title: 'Ship it', status: 'done', completedAt: '2026-10-07T10:00:00.000Z' })
    renderUI(<TaskRow task={task} onToggleDone={() => {}} />)
    expect(screen.getByRole('checkbox', { name: 'Mark "Ship it" done' })).toBeChecked()
    expect(screen.getByTestId('task-row')).toHaveAttribute('data-status', 'done')
    expect(screen.getByText('Ship it').className).toMatch(/done/)
  })

  it('calls onOpen from the title button', async () => {
    const user = userEvent.setup()
    const onOpen = vi.fn()
    const task = makeTask({ title: 'Open me' })
    renderUI(<TaskRow task={task} onOpen={onOpen} />)
    await user.click(screen.getByRole('button', { name: 'Open me' }))
    expect(onOpen).toHaveBeenCalledWith(task)
  })

  it('shows the waiting indicator with who and the follow-up date', () => {
    const task = makeTask({
      title: 'Contract',
      status: 'waiting',
      waitingOn: 'Alice',
      followUpDate: '2026-10-09',
    })
    renderUI(<TaskRow task={task} />)
    expect(screen.getByText('Waiting on Alice · follow up Oct 9')).toBeInTheDocument()
  })

  it('shows the slip warning from two slips', () => {
    const { unmount } = renderUI(<TaskRow task={makeTask({ title: 'Stuck', slipCount: 1 })} />)
    expect(screen.queryByText(/Slipped/)).not.toBeInTheDocument()
    unmount()
    renderUI(<TaskRow task={makeTask({ title: 'Stuck', slipCount: 2 })} />)
    expect(screen.getByText('Slipped ×2')).toBeInTheDocument()
  })

  it('shows the pinned weekday', () => {
    // 2026-10-08 is a Thursday.
    renderUI(<TaskRow task={makeTask({ title: 'Dentist', pinnedDay: '2026-10-08' })} />)
    expect(screen.getByText('Thu')).toBeInTheDocument()
  })

  it('shows checklist progress when there are items', () => {
    const { unmount } = renderUI(
      <TaskRow task={makeTask({ title: 'T' })} checklist={{ done: 0, total: 0 }} />,
    )
    expect(screen.queryByText(/\d\/\d/)).not.toBeInTheDocument()
    unmount()
    renderUI(<TaskRow task={makeTask({ title: 'T' })} checklist={{ done: 2, total: 5 }} />)
    expect(screen.getByText('2/5')).toBeInTheDocument()
  })

  it('shows the project name, note, trailing controls and doneWhen tooltip', () => {
    const task = makeTask({ title: 'Write tests', doneWhen: 'All green' })
    renderUI(
      <TaskRow
        task={task}
        projectName="PersonalDash"
        note="Blocked by: API"
        muted
        trailing={<button type="button">Move</button>}
      />,
    )
    expect(screen.getByText('PersonalDash')).toBeInTheDocument()
    expect(screen.getByText('Blocked by: API')).toBeInTheDocument()
    expect(within(screen.getByTestId('task-row')).getByRole('button', { name: 'Move' })).toBeInTheDocument()
    expect(screen.getByText('Write tests')).toHaveAttribute('title', 'All green')
  })

  it('renders no checkbox when onToggleDone is not given', () => {
    renderUI(<TaskRow task={makeTask({ title: 'Read only' })} />)
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  })
})
