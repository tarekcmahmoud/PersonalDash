import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useTaskActions } from '../../data/taskActions'
import type { Task } from '../../domain/types'
import { addDaysISO } from '../../domain/week'

const QUICK = [
  { label: 'In 3 days', days: 3 },
  { label: 'In 1 week', days: 7 },
  { label: 'In 2 weeks', days: 14 },
]

/**
 * "Still waiting… / Follow up again…": pick when to follow up next (3 days, 1 week, 2 weeks, or a date). The task
 * keeps waiting (or stays delegated) with the new follow-up date.
 */
export function FollowUpAgain({
  task,
  today,
  label,
  onOpenChange,
}: {
  task: Task
  today: string
  label: string
  onOpenChange?: (open: boolean) => void
}) {
  const actions = useTaskActions()
  const [open, setOpen] = useState(false)
  const [date, setDate] = useState(() => addDaysISO(today, 7))

  const toggle = (next: boolean) => {
    setOpen(next)
    onOpenChange?.(next)
  }
  const snooze = (to: string) => {
    void actions.snoozeFollowUp(task, to)
    toggle(false)
  }

  return (
    <Popover open={open} onOpenChange={toggle}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="xs" className="h-8 text-muted-foreground md:h-6">
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="grid w-auto gap-2 p-3">
        <p className="text-xs text-muted-foreground">Follow up again</p>
        <div className="flex flex-wrap gap-1">
          {QUICK.map((q) => (
            <Button
              key={q.days}
              size="sm"
              variant="outline"
              onClick={() => snooze(addDaysISO(today, q.days))}
            >
              {q.label}
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="date"
            aria-label="New follow-up date"
            value={date}
            min={today}
            className="h-8 w-40"
            onChange={(e) => setDate(e.target.value)}
          />
          <Button size="sm" variant="outline" disabled={!date} onClick={() => snooze(date)}>
            Save
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
