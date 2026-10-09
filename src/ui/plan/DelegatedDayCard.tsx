import { format, parseISO } from 'date-fns'
import { Clock } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { FollowUpItem } from '../../domain/followups'
import type { Person } from '../../domain/types'
import { SECONDARY_CARD } from '../components/Page'
import { useTaskLink } from '../task/useTaskParam'

/**
 * The week board's quieter card under a day: follow-ups due that day on tasks you delegated, each as the task
 * title over the person's name (and "Overdue · date" for one carried over from an earlier week).
 */
export function DelegatedDayCard({
  day,
  items,
  people,
  className,
}: {
  day: string
  items: FollowUpItem[]
  people: Person[]
  className?: string
}) {
  const taskLink = useTaskLink()
  const nameOf = (id: string | null) => people.find((p) => p.id === id)?.name

  return (
    <Card
      size="sm"
      role="region"
      aria-label={`Delegated, ${format(parseISO(day), 'EEEE MMMM d')}`}
      className={cn('min-w-0 gap-2 rounded-2xl xl:[--card-spacing:--spacing(3)]', SECONDARY_CARD, className)}
    >
      <h3 className="px-(--card-spacing) text-xs font-medium text-muted-foreground">Delegated</h3>
      <ul className="flex flex-col gap-2 px-(--card-spacing)">
        {items.map((item) => (
          <li key={item.task.id} className="flex items-start gap-1.5">
            <Clock
              className={cn(
                'mt-0.5 size-3 shrink-0',
                item.overdue ? 'text-destructive' : 'text-muted-foreground',
              )}
              aria-hidden
            />
            <div className="flex min-w-0 flex-col">
              <Link
                to={taskLink(item.task)}
                className="min-w-0 text-xs underline-offset-4 hover:underline"
                aria-label={item.label}
              >
                {item.task.title}
              </Link>
              <span className="text-xs text-muted-foreground">
                {nameOf(item.task.assigneeId) ?? 'Someone'}
                {item.overdue && (
                  <span className="text-destructive">{` · Overdue · ${format(parseISO(item.date), 'MMM d')}`}</span>
                )}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  )
}
