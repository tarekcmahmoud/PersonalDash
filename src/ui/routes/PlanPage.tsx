import { Page } from '../components/Page'
import { useWeekParam } from '../plan/useWeekParam'
import { WeekPicker } from '../plan/WeekPicker'
import { WeekSwitcher } from '../plan/WeekSwitcher'

/** "Plan the week": pick by hand which tasks to do this week, from a list grouped by project. */
export function PlanPage() {
  const { weekStart, setWeek, resetWeek, isCurrentWeek } = useWeekParam()
  return (
    <Page title="Plan the week" description="Pick the tasks you will do this week.">
      <WeekSwitcher
        weekStart={weekStart}
        isCurrentWeek={isCurrentWeek}
        onChange={setWeek}
        onReset={resetWeek}
      />
      <WeekPicker weekStart={weekStart} />
    </Page>
  )
}
