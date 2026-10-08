import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import { formatHours } from './format'

/** One grey line: "22 of 31h this week" — red when over capacity. */
export function CapacityLine({
  planned,
  capacity,
  suffix = '',
  className,
}: {
  planned: number
  capacity: number
  suffix?: string
  className?: string
}) {
  const over = Math.round(planned * 10) - Math.round(capacity * 10)
  return (
    <span
      className={cn(
        'text-sm tabular-nums',
        over > 0 ? 'text-destructive' : 'text-muted-foreground',
        className,
      )}
    >
      {formatHours(planned)} of {formatHours(capacity)}h{suffix}
      {over > 0 && ` · ${formatHours(over / 10)}h over`}
    </span>
  )
}

/** Thin capacity bar (yellow fill, red when over) + the grey capacity line. */
export function CapacityBar({
  planned,
  capacity,
  meetingHours,
}: {
  planned: number
  capacity: number
  meetingHours?: number
}) {
  const over = Math.round(planned * 10) > Math.round(capacity * 10)
  const percent = capacity > 0 ? Math.min(100, (planned / capacity) * 100) : planned > 0 ? 100 : 0
  return (
    <div className="flex flex-col gap-1.5">
      <Progress
        aria-label="Capacity used"
        value={percent}
        className={cn('h-1', over && '[&>[data-slot=progress-indicator]]:bg-destructive')}
      />
      <div className="flex flex-wrap gap-x-1">
        <CapacityLine planned={planned} capacity={capacity} suffix=" planned" />
        {meetingHours !== undefined && meetingHours > 0 && (
          <span className="text-sm text-muted-foreground">· {formatHours(meetingHours)}h in meetings</span>
        )}
      </div>
    </div>
  )
}
