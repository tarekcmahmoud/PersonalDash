import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { makeProject, makeTask } from '../../domain/factories'
import type { HealthFlag } from '../../domain/health'
import { CapacityBar, CapacityLine } from './CapacityBar'
import { plannedLabel, topSignal } from './format'
import { ProjectSignal } from './HealthBadges'
import { ProjectObjective } from './ProjectObjective'
import { SizeLabel } from './SizeLabel'
import { TaskRow } from './TaskRow'

describe('SizeLabel', () => {
  it('shows sizes as text and flags XL', () => {
    const { rerender } = render(<SizeLabel size="M" />)
    expect(screen.getByText('M')).toHaveAttribute('title', '≈half day')
    rerender(<SizeLabel size="XL" />)
    expect(screen.getByText('XL · split')).toBeInTheDocument()
  })
})

describe('CapacityLine / CapacityBar', () => {
  it('shows planned of capacity without trailing ".0"', () => {
    render(<CapacityLine planned={12.5} capacity={22} suffix=" this week" />)
    expect(screen.getByText('12.5 of 22h this week')).toBeInTheDocument()
  })
  it('calls out hours over capacity', () => {
    render(<CapacityLine planned={25} capacity={22} />)
    expect(screen.getByText('25 of 22h · 3h over')).toBeInTheDocument()
  })
  it('renders a labelled bar and meeting hours', () => {
    render(<CapacityBar planned={10} capacity={20} meetingHours={6} />)
    expect(screen.getByLabelText('Capacity used')).toBeInTheDocument()
    expect(screen.getByText('10 of 20h planned')).toBeInTheDocument()
    expect(screen.getByText('· 6h in meetings')).toBeInTheDocument()
  })
})

describe('ProjectSignal', () => {
  const date = '2026-10-20'
  it('picks the single most important signal', () => {
    const flags: HealthFlag[] = [
      { kind: 'neglected' },
      { kind: 'below_min', planned: 1, min: 2 },
      { kind: 'deadline_soon', date, dateKind: 'soft', daysLeft: 5 },
    ]
    expect(topSignal(flags)).toEqual({ text: '1 of 2 this week', tone: 'warning' })
    expect(topSignal([{ kind: 'deadline_soon', date, dateKind: 'hard', daysLeft: 0 }, ...flags])).toEqual({
      text: 'Due today',
      tone: 'danger',
    })
    expect(topSignal([{ kind: 'overdue', date, dateKind: 'soft', daysOver: 3 }])?.text).toBe('Overdue 3d')
    expect(topSignal([{ kind: 'no_next_step' }])).toEqual({ text: 'No next step', tone: 'muted' })
    expect(topSignal([])).toBeNull()
  })
  it('renders nothing without flags', () => {
    const { container } = render(<ProjectSignal flags={[]} />)
    expect(container).toBeEmptyDOMElement()
  })
  it('renders the text', () => {
    render(<ProjectSignal flags={[{ kind: 'neglected' }]} />)
    expect(screen.getByText('Nothing planned')).toBeInTheDocument()
  })
})

describe('ProjectObjective', () => {
  it('shows outcome and hard deadline on one grey line', () => {
    const year = new Date().getFullYear()
    render(
      <ProjectObjective
        project={makeProject({ name: 'P', outcome: 'Live', targetDate: `${year}-12-15`, dateKind: 'hard' })}
      />,
    )
    expect(screen.getByText('Live')).toBeInTheDocument()
    expect(screen.getByText('· Deadline Dec 15')).toBeInTheDocument()
  })
  it('appends the year for other years and says Target for soft dates', () => {
    render(<ProjectObjective project={makeProject({ name: 'P', outcome: '', targetDate: '2031-03-02' })} />)
    expect(screen.getByText('No outcome set')).toBeInTheDocument()
    expect(screen.getByText('· Target Mar 2, 2031')).toBeInTheDocument()
  })
})

describe('TaskRow', () => {
  it('toggles done through the checkbox', async () => {
    const task = makeTask({ title: 'Write brief', size: 'S' })
    const onToggle = vi.fn()
    render(<TaskRow task={task} onToggleDone={onToggle} />)
    await userEvent.click(screen.getByRole('checkbox', { name: 'Mark "Write brief" done' }))
    expect(onToggle).toHaveBeenCalledWith(task)
  })
  it('shows a done task as checked and struck through', () => {
    render(<TaskRow task={makeTask({ title: 'Done one', status: 'done' })} onToggleDone={() => {}} />)
    expect(screen.getByRole('checkbox')).toBeChecked()
    expect(screen.getByText('Done one')).toHaveClass('line-through')
    expect(screen.getByTestId('task-row')).toHaveAttribute('data-status', 'done')
  })
  it('shows grey metadata: project, size, day, checklist, waiting, slips', () => {
    render(
      <TaskRow
        task={makeTask({
          title: 'T',
          size: 'M',
          pinnedDay: '2026-10-08',
          status: 'waiting',
          waitingOn: 'Finance',
          followUpDate: '2026-10-09',
          slipCount: 2,
        })}
        projectName="Board report"
        checklist={{ done: 1, total: 3 }}
        meta={['Next']}
      />,
    )
    for (const text of [
      'Board report',
      'M',
      'Thu',
      '1/3',
      'Waiting on Finance · Oct 9',
      'Slipped ×2',
      'Next',
    ])
      expect(screen.getByText(text)).toBeInTheDocument()
  })
  it('opens the task from the title and renders actions and note', async () => {
    const task = makeTask({ title: 'Open me' })
    const onOpen = vi.fn()
    render(<TaskRow task={task} onOpen={onOpen} actions={<button>Act</button>} note="After: X" />)
    await userEvent.click(screen.getByRole('button', { name: 'Open me' }))
    expect(onOpen).toHaveBeenCalledWith(task)
    expect(screen.getByRole('button', { name: 'Act' })).toBeInTheDocument()
    expect(screen.getByText('After: X')).toBeInTheDocument()
  })
})

describe('plannedLabel', () => {
  const today = '2026-10-08' // Thursday; the week starts Mon Oct 5
  it('shows the weekday in this week and the date in other weeks', () => {
    expect(plannedLabel({ weekStart: '2026-10-05', pinnedDay: '2026-10-09' }, today)).toBe('Fri')
    expect(plannedLabel({ weekStart: '2026-11-02', pinnedDay: '2026-11-04' }, today)).toBe('Wed Nov 4')
  })
  it('names a later week planned without a day, and nothing otherwise', () => {
    expect(plannedLabel({ weekStart: '2026-11-02', pinnedDay: null }, today)).toBe('Week of Nov 2')
    expect(plannedLabel({ weekStart: '2026-10-05', pinnedDay: null }, today)).toBeNull()
    expect(plannedLabel({ weekStart: '2026-09-28', pinnedDay: null }, today)).toBeNull()
    expect(plannedLabel({ weekStart: null, pinnedDay: null }, today)).toBeNull()
  })
})
