import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { usePlanContext, useSnapshot } from '../../data/hooks'
import { dayCapacity } from '../../domain/capacity'
import { isInWeek, weekDays } from '../../domain/week'
import { Page } from '../components/Page'
import { DayColumn } from '../plan/DayColumn'
import { DelegatedDayCard } from '../plan/DelegatedDayCard'
import { WeekDndProvider } from '../plan/WeekDnd'
import { eventsOnDay } from '../plan/events'
import { useWeekParam } from '../plan/useWeekParam'
import { WeekSwitcher } from '../plan/WeekSwitcher'
import { weekStats } from '../plan/weekStats'
import { TaskDialogHost } from '../task/TaskDialogHost'

/**
 * Week board: a card for "this week, any day" followed by one per day, Monday to Sunday. Eight columns at
 * 1280px and up, four or two on narrower screens, a vertical list on phones. Drag a task onto another day (or "Any day") to move it; the hover "Move to…" menu does the same.
 * Follow-ups on delegated tasks are stacked under their day in a quieter card of their own; on wider screens
 * those cards line up across a row (each column is a two-row subgrid: your day, then delegated).
 */
export function WeekPage() {
  const { weekStart, setWeek, resetWeek, isCurrentWeek } = useWeekParam()
  const ctx = usePlanContext(weekStart)
  const { isError, error } = useSnapshot()

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
    const onDay = (day: string, kind: 'waiting' | 'delegated') =>
      followUps.filter((f) => f.kind === kind && followUpDay(f.date) === day)
    const stack = 'flex min-w-0 flex-col gap-2 md:row-span-2 md:grid md:grid-rows-subgrid md:gap-y-2 md:pb-3'

    return (
      <WeekDndProvider tasks={planned} projectNames={names}>
        <div className="grid gap-3 md:grid-cols-2 md:gap-y-0 lg:grid-cols-4 xl:grid-cols-8">
          <div className={stack}>
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
          </div>
          {days.map((day) => {
            const delegated = onDay(day, 'delegated')
            return (
              <div key={day} className={stack}>
                <DayColumn
                  weekStart={weekStart}
                  day={day}
                  isToday={todayInWeek && day === ctx.today}
                  tasks={planned.filter((t) => t.pinnedDay === day)}
                  followUps={onDay(day, 'waiting')}
                  delegatedFollowUps={delegated.length}
                  meetings={eventsOnDay(ctx.events, day)}
                  capacity={dayCapacity(day, ctx.settings, ctx.events).capacity}
                  settings={ctx.settings}
                  projectNames={names}
                />
                {delegated.length > 0 && <DelegatedDayCard day={day} items={delegated} people={ctx.people} />}
              </div>
            )
          })}
        </div>
      </WeekDndProvider>
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
      <TaskDialogHost />
    </Page>
  )
}
