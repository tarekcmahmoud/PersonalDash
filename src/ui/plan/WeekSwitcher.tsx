import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ISODate } from '../../domain/types'
import { addWeeksISO, formatWeekRange } from '../../domain/week'

/** ‹ Oct 5 – 11 › with a grey "This week" link when another week is shown. Controlled by the caller. */
export function WeekSwitcher({
  weekStart,
  isCurrentWeek,
  onChange,
  onReset,
}: {
  weekStart: ISODate
  isCurrentWeek: boolean
  onChange: (weekStart: ISODate) => void
  /** Jump back to the current week. */
  onReset: () => void
}) {
  return (
    <div className="flex items-center gap-1" role="group" aria-label="Week">
      <Button
        variant="ghost"
        size="icon-sm"
        className="text-muted-foreground"
        aria-label="Previous week"
        onClick={() => onChange(addWeeksISO(weekStart, -1))}
      >
        <ChevronLeft />
      </Button>
      <span className="min-w-24 text-center text-sm font-medium tabular-nums" aria-live="polite">
        {formatWeekRange(weekStart)}
      </span>
      <Button
        variant="ghost"
        size="icon-sm"
        className="text-muted-foreground"
        aria-label="Next week"
        onClick={() => onChange(addWeeksISO(weekStart, 1))}
      >
        <ChevronRight />
      </Button>
      {!isCurrentWeek && (
        <Button variant="link" size="sm" className="text-muted-foreground" onClick={onReset}>
          This week
        </Button>
      )}
    </div>
  )
}
