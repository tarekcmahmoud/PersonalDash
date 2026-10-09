import { format, parseISO } from 'date-fns'
import { CalendarDays, Check, MoreHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useTaskActions } from '../../data/taskActions'
import type { ISODate, Task } from '../../domain/types'
import { addDaysISO, todayISO, weekDays, weekStartOf } from '../../domain/week'

/**
 * Menu to move a planned task between the days of its week, or on to the week after.
 * "Pin to day" (Today / Plan) offers Mon..Sun + "No day" + "Next week"; "Move to…" (Week board) offers Mon..Sun +
 * "Any day" + "Next week" + "Unplan". "Next week" plans the task in the following week, without a day.
 */
export function TaskDayMenu({
  task,
  weekStart,
  variant,
}: {
  task: Task
  weekStart: ISODate
  variant: 'pin' | 'move'
}) {
  const actions = useTaskActions()
  const isMove = variant === 'move'
  const label = isMove ? `Move "${task.title}" to…` : `Pin "${task.title}" to a day`
  const Icon = isMove ? MoreHorizontal : CalendarDays
  const current = <Check className="ml-auto size-4" aria-label="current" />
  const following = addDaysISO(weekStart, 7)
  const followingLabel =
    weekStart === weekStartOf(todayISO()) ? 'Next week' : `Week of ${format(parseISO(following), 'MMM d')}`

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className="size-8 text-muted-foreground md:size-7"
          aria-label={label}
          title={isMove ? 'Move to…' : 'Pin to a day'}
        >
          <Icon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-40">
        {weekDays(weekStart).map((day) => (
          <DropdownMenuItem key={day} onSelect={() => void actions.pin(task, day)}>
            {format(parseISO(day), 'EEE MMM d')}
            {task.pinnedDay === day && current}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void actions.pin(task, null)}>
          {isMove ? 'Any day' : 'No day'}
          {task.pinnedDay === null && current}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void actions.plan({ ...task, pinnedDay: null }, following)}>
          {followingLabel}
        </DropdownMenuItem>
        {isMove && (
          <DropdownMenuItem variant="destructive" onSelect={() => void actions.unplan(task)}>
            Unplan
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
