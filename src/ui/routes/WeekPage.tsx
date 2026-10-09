import { Alert, AlertDescription } from '@/components/ui/alert'
import { useState, type MouseEvent } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { useMediaQuery } from '@/lib/useMediaQuery'
import { cn } from '@/lib/utils'
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
 * At 1280px and up, one column (and the cards stacked in it) is twice as wide as the others: today's
 * by default (also after switching weeks); click another column (or its day name) to widen that one instead, and
 * its name again to go back to today.
 * The narrow columns are greyed out and their tasks have no checkboxes.
 */
export function WeekPage() {
  const { weekStart, setWeek, resetWeek, isCurrentWeek } = useWeekParam()
  const ctx = usePlanContext(weekStart)
  const { isError, error } = useSnapshot()
  // Only the 8-column board (xl, 1280px) lays days side by side, so only there can a column be widened.
  const sideBySide = useMediaQuery('(min-width: 80rem)')
  // The column picked instead of the default (today's): a day or 'any'. Cleared when the week changes, so the
  // board always opens with today wide.
  const [picked, setPicked] = useState<{ weekStart: string; column: string } | null>(null)
  const changeWeek = (next: string) => {
    setPicked(null)
    setWeek(next)
  }
  const backToThisWeek = () => {
    setPicked(null)
    resetWeek()
  }

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
    // Today is wide by default; narrowing a picked column goes back to that default.
    const defaultColumn = todayInWeek ? ctx.today : null
    const expanded = picked?.weekStart === weekStart ? picked.column : defaultColumn
    const toggle = (column: string) => setPicked(expanded === column ? null : { weekStart, column })
    // A click on a column's background widens it; clicks on its tasks, links and buttons keep their own meaning.
    const expandOnClick = (column: string) => (e: MouseEvent) => {
      const target = e.target as Element
      if (!sideBySide || column === expanded) return
      if (target.closest('a, button, input, label, [role="checkbox"], [data-testid="task-row"]')) return
      setPicked({ weekStart, column })
    }
    const stack = (column: string) =>
      cn(
        'flex min-w-0 flex-col gap-2 md:row-span-2 md:grid md:grid-rows-subgrid md:gap-y-2 md:pb-3 xl:col-span-2',
        expanded === column && 'xl:col-span-4',
        // The other columns are greyed out until hovered (or dragged over).
        sideBySide && expanded && expanded !== column && 'opacity-60 transition-opacity hover:opacity-100',
      )
    const expandProps = (column: string) => ({
      expanded: sideBySide && expanded === column,
      onToggleExpand: sideBySide ? () => toggle(column) : undefined,
    })

    return (
      <WeekDndProvider tasks={planned} projectNames={names}>
        {/* Eight columns of two tracks each, plus two more tracks for the wide column. */}
        <div
          className={cn(
            'grid gap-3 md:grid-cols-2 md:gap-y-0 lg:grid-cols-4',
            expanded ? 'xl:grid-cols-18' : 'xl:grid-cols-16',
          )}
        >
          <div className={stack('any')} onClick={expandOnClick('any')}>
            <DayColumn
              weekStart={weekStart}
              day={null}
              tasks={planned.filter((t) => t.pinnedDay === null || !days.includes(t.pinnedDay))}
              followUps={[]}
              meetings={[]}
              capacity={null}
              settings={ctx.settings}
              projectNames={names}
              {...expandProps('any')}
            />
          </div>
          {days.map((day) => {
            const delegated = onDay(day, 'delegated')
            return (
              <div key={day} className={stack(day)} onClick={expandOnClick(day)}>
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
                  {...expandProps(day)}
                />
                {delegated.length > 0 && (
                  <DelegatedDayCard
                    day={day}
                    items={delegated}
                    people={ctx.people}
                    projects={ctx.projects}
                    milestones={ctx.milestones}
                  />
                )}
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
        onChange={changeWeek}
        onReset={backToThisWeek}
      />
      <div className="mt-4">{body}</div>
      <TaskDialogHost />
    </Page>
  )
}
