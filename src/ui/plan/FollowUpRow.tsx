import { format, parseISO } from 'date-fns'
import { Clock } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { taskHref, useTaskActions } from '../../data/taskActions'
import type { FollowUpItem } from '../../domain/followups'
import { addDaysISO } from '../../domain/week'

/** One line: "Follow up: X re Y" + grey date. "Still waiting…" (new date) and "Received" appear on hover. */
export function FollowUpRow({ item, today }: { item: FollowUpItem; today: string }) {
  const actions = useTaskActions()
  const [open, setOpen] = useState(false)
  const [date, setDate] = useState(() => addDaysISO(today, 7))

  const dateText = format(parseISO(item.date), 'MMM d')

  return (
    <div
      data-testid="follow-up-row"
      className="group relative flex min-h-10 flex-wrap items-center gap-x-2 py-1.5 md:flex-nowrap"
    >
      <Clock
        className={cn('size-4 shrink-0', item.overdue ? 'text-destructive' : 'text-muted-foreground')}
        aria-hidden
      />
      <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-3 gap-y-0.5">
        <Link to={taskHref(item.task)} className="min-w-0 text-sm underline-offset-4 hover:underline">
          {item.label}
        </Link>
        <span
          className={cn(
            'ml-auto text-xs md:mr-9',
            item.overdue ? 'text-destructive' : 'text-muted-foreground',
          )}
        >
          {item.overdue ? `Overdue · ${dateText}` : dateText}
        </span>
      </div>
      <div
        className={cn(
          '-mt-1 flex basis-full shrink-0 items-center gap-0.5 bg-background pl-6 md:mt-0 md:basis-auto transition-opacity md:absolute md:top-1/2 md:right-0 md:-translate-y-1/2 md:pl-2 md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100 [@media(hover:none)]:opacity-100',
          open && 'md:opacity-100',
        )}
      >
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="xs" className="h-8 text-muted-foreground md:h-6">
              Still waiting…
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="flex w-auto items-center gap-2 p-3">
            <Input
              type="date"
              aria-label="New follow-up date"
              value={date}
              min={today}
              className="h-8 w-40"
              onChange={(e) => setDate(e.target.value)}
            />
            <Button
              size="sm"
              variant="outline"
              disabled={!date}
              onClick={() => {
                void actions.snoozeFollowUp(item.task, date)
                setOpen(false)
              }}
            >
              Save
            </Button>
          </PopoverContent>
        </Popover>
        <Button
          variant="ghost"
          size="xs"
          className="h-8 text-muted-foreground md:h-6"
          onClick={() => void actions.received(item.task)}
        >
          Received
        </Button>
      </div>
    </div>
  )
}
