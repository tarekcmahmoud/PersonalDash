import { format, parseISO } from 'date-fns'
import { Clock } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useTaskActions } from '../../data/taskActions'
import type { FollowUpItem } from '../../domain/followups'
import { useTaskLink } from '../task/useTaskParam'
import { FollowUpAgain } from './FollowUpAgain'

/**
 * "Follow up: X re Y" (wrapping) with the grey date beside its first line, and optionally where the task lives
 * underneath. On hover: "Still waiting…" (new date) and "Received" for a task you
 * wait on; "Follow up again…" and "Done" for a delegated one.
 */
export function FollowUpRow({
  item,
  today,
  quiet = false,
  place,
}: {
  item: FollowUpItem
  today: string
  /** Grey label, for a secondary list (the Delegated card on Today). */
  quiet?: boolean
  /** A small grey line under the label: where the task lives (see taskPlace). */
  place?: string
}) {
  const actions = useTaskActions()
  const taskLink = useTaskLink()
  const [open, setOpen] = useState(false)
  const delegated = item.kind === 'delegated'
  const dateText = format(parseISO(item.date), 'MMM d')

  return (
    <div
      data-testid="follow-up-row"
      className="group relative flex min-h-10 flex-wrap items-start gap-x-2 py-1.5 md:flex-nowrap"
    >
      {/* Same 32px slot as TaskRow's checkbox, so titles line up with the task rows around it. */}
      <span className="-my-1 -ml-2 flex size-8 shrink-0 items-center justify-center">
        <Clock
          className={cn('size-4', item.overdue ? 'text-destructive' : 'text-muted-foreground')}
          aria-hidden
        />
      </span>
      {/* Title (wraps) and date share the first line; where the task lives sits under the title. */}
      <div className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 gap-y-0.5">
        <Link
          to={taskLink(item.task)}
          className={cn(
            'min-w-0 text-sm text-pretty underline-offset-4 hover:underline',
            quiet && 'text-muted-foreground',
          )}
        >
          {item.label}
        </Link>
        <span
          className={cn(
            'text-xs whitespace-nowrap md:mr-9',
            item.overdue ? 'text-destructive' : 'text-muted-foreground',
          )}
        >
          {item.overdue ? `Overdue · ${dateText}` : dateText}
        </span>
        {place && <span className="truncate text-xs text-muted-foreground/60">{place}</span>}
      </div>
      <div
        className={cn(
          'mt-0.5 flex basis-full shrink-0 items-center gap-0.5 bg-(--surface,var(--color-card)) pl-6 md:mt-0 md:basis-auto transition-opacity md:absolute md:top-1 md:right-0 md:pl-2 md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100 [@media(hover:none)]:opacity-100',
          open && 'md:opacity-100',
        )}
      >
        <FollowUpAgain
          task={item.task}
          today={today}
          label={delegated ? 'Follow up again…' : 'Still waiting…'}
          onOpenChange={setOpen}
        />
        <Button
          variant="ghost"
          size="xs"
          className="h-8 text-muted-foreground md:h-6"
          onClick={() => void (delegated ? actions.toggleDone(item.task) : actions.received(item.task))}
        >
          {delegated ? 'Done' : 'Received'}
        </Button>
      </div>
    </div>
  )
}
