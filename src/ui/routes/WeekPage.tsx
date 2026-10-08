import { Flash, Spinner } from '@primer/react'
import { useEffect, useRef } from 'react'
import { dayCapacity } from '../../domain/capacity'
import { usePlanContext, useSnapshot } from '../../data/hooks'
import { isInWeek, weekDays } from '../../domain/week'
import { Page } from '../components/Page'
import { DayColumn } from '../plan/DayColumn'
import { eventsOnDay } from '../plan/events'
import { useWeekParam } from '../plan/useWeekParam'
import { WeekSwitcher } from '../plan/WeekSwitcher'
import { weekStats } from '../plan/weekStats'
import styles from './WeekPage.module.css'

/** Week board: a "this week, any day" column followed by Monday to Sunday. Tasks move between days via a menu. */
export function WeekPage() {
  const { weekStart, setWeek, resetWeek, isCurrentWeek } = useWeekParam()
  const ctx = usePlanContext(weekStart)
  const { isError, error } = useSnapshot()
  const boardRef = useRef<HTMLDivElement>(null)
  const loaded = ctx !== null

  // On wide screens the board scrolls sideways: bring today's column into view.
  useEffect(() => {
    const board = boardRef.current
    const today = board?.querySelector<HTMLElement>('[data-today]')
    const anyDay = board?.querySelector<HTMLElement>('[data-day="any"]')
    if (!board || !today || !anyDay || board.scrollWidth <= board.clientWidth) return
    // The any-day column sticks to the left edge; scroll so today's column sits right next to it.
    const offset = today.getBoundingClientRect().left - board.getBoundingClientRect().left
    board.scrollLeft += offset - anyDay.offsetWidth - 16
  }, [loaded, weekStart])

  const body = (() => {
    if (isError) return <Flash variant="danger">{`Could not load your data: ${String(error)}`}</Flash>
    if (!ctx) return <Spinner aria-label="Loading" />

    const { planned, followUps } = weekStats(ctx)
    const names = new Map(ctx.projects.map((p) => [p.id, p.name]))
    const days = weekDays(weekStart)
    const todayInWeek = isInWeek(ctx.today, weekStart)
    // Overdue follow-ups (before this week) are shown on today's column.
    const followUpDay = (date: string): string => (date < weekStart ? ctx.today : date)

    return (
      <div className={styles.board} ref={boardRef}>
        <DayColumn
          weekStart={weekStart}
          day={null}
          tasks={planned.filter((t) => t.pinnedDay === null || !days.includes(t.pinnedDay))}
          followUps={[]}
          meetings={[]}
          capacity={null}
          settings={ctx.settings}
          projectNames={names}
        />
        {days.map((day) => (
          <DayColumn
            key={day}
            weekStart={weekStart}
            day={day}
            isToday={todayInWeek && day === ctx.today}
            tasks={planned.filter((t) => t.pinnedDay === day)}
            followUps={followUps.filter((f) => followUpDay(f.date) === day)}
            meetings={eventsOnDay(ctx.events, day)}
            capacity={dayCapacity(day, ctx.settings, ctx.events).capacity}
            settings={ctx.settings}
            projectNames={names}
          />
        ))}
      </div>
    )
  })()

  return (
    <Page title="Week" wide>
      <WeekSwitcher
        weekStart={weekStart}
        isCurrentWeek={isCurrentWeek}
        onChange={setWeek}
        onReset={resetWeek}
      />
      {body}
    </Page>
  )
}
