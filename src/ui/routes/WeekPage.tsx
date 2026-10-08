import { useEffect, useRef } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { usePlanContext, useSnapshot } from '../../data/hooks'
import { dayCapacity } from '../../domain/capacity'
import { isInWeek, weekDays } from '../../domain/week'
import { Page } from '../components/Page'
import { DayColumn } from '../plan/DayColumn'
import { eventsOnDay } from '../plan/events'
import { useWeekParam } from '../plan/useWeekParam'
import { WeekSwitcher } from '../plan/WeekSwitcher'
import { weekStats } from '../plan/weekStats'

// Six columns fit at once (any-day + five days); the board scrolls sideways for the rest.
const COLUMN = 'md:w-[max(184px,calc(100%/6))] md:shrink-0 md:border-l md:px-3 md:py-2'

/**
 * Week board: a "this week, any day" column followed by Monday to Sunday, separated by hairlines.
 * On phones it is a vertical list of day sections. Tasks move between days via the hover "Move to…" menu.
 */
export function WeekPage() {
  const { weekStart, setWeek, resetWeek, isCurrentWeek } = useWeekParam()
  const ctx = usePlanContext(weekStart)
  const { isError, error } = useSnapshot()
  const boardRef = useRef<HTMLDivElement>(null)
  const loaded = ctx !== null

  // On wide screens the board scrolls sideways in whole columns: show yesterday and today next to "Any day".
  useEffect(() => {
    const board = boardRef.current
    const today = board?.querySelector<HTMLElement>('[data-today]')
    const anyDay = board?.querySelector<HTMLElement>('[data-day="any"]')
    if (!board || !today || !anyDay || board.scrollWidth <= board.clientWidth) return
    const columnWidth = anyDay.offsetWidth
    const todayIndex = Math.round(today.offsetLeft / columnWidth) - 1 // 0 = Monday
    board.scrollLeft = Math.max(0, todayIndex - 1) * columnWidth
  }, [loaded, weekStart])

  const body = (() => {
    if (isError)
      return (
        <Alert variant="destructive">
          <AlertDescription>{`Could not load your data: ${String(error)}`}</AlertDescription>
        </Alert>
      )
    if (!ctx)
      return (
        <div className="flex flex-col gap-3" role="status" aria-label="Loading">
          <Skeleton className="h-5 w-1/3" />
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-5 w-1/2" />
        </div>
      )

    const { planned, followUps } = weekStats(ctx)
    const names = new Map(ctx.projects.map((p) => [p.id, p.name]))
    const days = weekDays(weekStart)
    const todayInWeek = isInWeek(ctx.today, weekStart)
    // Overdue follow-ups (before this week) are shown on today's column.
    const followUpDay = (date: string): string => (date < weekStart ? ctx.today : date)

    return (
      <div
        ref={boardRef}
        className="relative flex flex-col divide-y border-t md:flex-row md:divide-y-0 md:overflow-x-auto"
      >
        <DayColumn
          className={`${COLUMN} md:sticky md:left-0 md:z-10 md:border-l-0 md:bg-background md:pl-0`}
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
            className={COLUMN}
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
      <div className="mt-4">{body}</div>
    </Page>
  )
}
