import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { makeTask } from '../../domain/factories'
import { DEFAULT_SETTINGS, type CalendarEvent } from '../../domain/types'
import { renderApp } from './testUtils'
import { DayColumn } from './DayColumn'
import { MeetingList } from './MeetingList'

const standup: CalendarEvent = {
  id: 'e1',
  title: 'Standup',
  start: '2026-10-08T10:00:00',
  end: '2026-10-08T11:00:00',
  allDay: false,
  busy: true,
}

describe('MeetingList', () => {
  it('renders each meeting as "time title"', () => {
    renderApp(<MeetingList events={[standup]} />)
    const list = screen.getByRole('list', { name: 'Meetings' })
    expect(within(list).getByText('10:00–11:00')).toBeInTheDocument()
    expect(within(list).getByText('Standup')).toBeInTheDocument()
  })

  it('renders nothing without events', () => {
    renderApp(<MeetingList events={[]} />)
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })
})

describe('DayColumn', () => {
  it('shows the day, the hours line, meetings and tasks', () => {
    const task = makeTask({ title: 'Write report', size: 'M', projectId: null })
    renderApp(
      <DayColumn
        weekStart="2026-10-05"
        day="2026-10-08"
        isToday
        tasks={[task]}
        followUps={[]}
        meetings={[standup]}
        capacity={6}
        settings={DEFAULT_SETTINGS}
        projectNames={new Map()}
      />,
    )
    const col = within(screen.getByRole('region', { name: 'Thursday October 8' }))
    expect(col.getByRole('heading', { name: /Thu/ })).toBeInTheDocument()
    expect(col.getByText(/h free/)).toBeInTheDocument()
    expect(col.getByText('Standup')).toBeInTheDocument()
    expect(col.getByText('Write report')).toBeInTheDocument()
  })

  it('says when nothing is planned', () => {
    renderApp(
      <DayColumn
        weekStart="2026-10-05"
        day="2026-10-09"
        tasks={[]}
        followUps={[]}
        meetings={[]}
        capacity={6}
        settings={DEFAULT_SETTINGS}
        projectNames={new Map()}
      />,
    )
    expect(screen.getByText('Nothing planned')).toBeInTheDocument()
  })
})
