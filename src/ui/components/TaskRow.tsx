import { format, parseISO } from 'date-fns'
import { Clock } from 'lucide-react'
import type { ReactNode } from 'react'
import type { Task } from '../../domain/types'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import { SizeLabel } from './SizeLabel'

const SLIP_WARNING_AT = 2

export interface TaskRowProps {
  task: Task
  /** Shown as grey metadata. */
  projectName?: string
  /** Shows "done/total" as grey metadata when total > 0. */
  checklist?: { done: number; total: number }
  /** When given, renders a checkbox (checked = status done). */
  onToggleDone?: (task: Task) => void
  /** When given, the title is a button that calls it. */
  onOpen?: (task: Task) => void
  /** Row actions (icon buttons, menus). Revealed on hover on desktop; always visible on touch screens. */
  actions?: ReactNode
  /** @deprecated alias of `actions`. */
  trailing?: ReactNode
  /** Extra grey metadata items appended after the built-in ones (e.g. "Next"). */
  meta?: ReactNode[]
  /** Greyed out (e.g. blocked). */
  muted?: boolean
  /** Small grey line under the title (e.g. "After: Draft sitemap"). */
  note?: ReactNode
  /** Hide the pinned-day metadata (e.g. inside a day column). */
  hideDay?: boolean
  className?: string
}

const Dot = () => <span className="text-muted-foreground/50">·</span>

/**
 * One task line: checkbox · title · grey metadata (project, size, day, checklist, waiting) · hover actions.
 * Colour only for attention: XL size and repeated slips.
 */
export function TaskRow({
  task,
  projectName,
  checklist,
  onToggleDone,
  onOpen,
  actions,
  trailing,
  meta = [],
  muted,
  note,
  hideDay,
  className,
}: TaskRowProps) {
  const done = task.status === 'done'
  const rowActions = actions ?? trailing

  const items: ReactNode[] = []
  if (projectName)
    items.push(
      <span key="p" className="truncate">
        {projectName}
      </span>,
    )
  items.push(<SizeLabel key="s" size={task.size} />)
  if (task.pinnedDay && !hideDay) items.push(<span key="d">{format(parseISO(task.pinnedDay), 'EEE')}</span>)
  if (checklist && checklist.total > 0)
    items.push(<span key="c" className="tabular-nums">{`${checklist.done}/${checklist.total}`}</span>)
  if (task.status === 'waiting')
    items.push(
      <span key="w" className="inline-flex items-center gap-1">
        <Clock className="size-3" aria-hidden />
        {task.waitingOn ? `Waiting on ${task.waitingOn}` : 'Waiting'}
        {task.followUpDate && ` · ${format(parseISO(task.followUpDate), 'MMM d')}`}
      </span>,
    )
  if (task.slipCount >= SLIP_WARNING_AT)
    items.push(<span key="x" className="text-warning">{`Slipped ×${task.slipCount}`}</span>)
  items.push(...meta.map((m, i) => <span key={`m${i}`}>{m}</span>))

  const titleClass = cn('min-w-0 text-left text-sm', done && 'text-muted-foreground line-through')
  const title = onOpen ? (
    <button
      type="button"
      className={cn(titleClass, 'cursor-pointer hover:underline underline-offset-4')}
      title={task.doneWhen || undefined}
      onClick={() => onOpen(task)}
    >
      {task.title}
    </button>
  ) : (
    <span className={titleClass} title={task.doneWhen || undefined}>
      {task.title}
    </span>
  )

  return (
    <div
      data-testid="task-row"
      data-status={task.status}
      className={cn('group flex min-h-10 items-start gap-2 py-1.5', muted && 'opacity-50', className)}
    >
      {onToggleDone && (
        // The label widens the tap target to 32px around the checkbox.
        <label className="-my-1 -ml-2 flex size-8 shrink-0 cursor-pointer items-center justify-center">
          <Checkbox
            checked={done}
            onCheckedChange={() => onToggleDone(task)}
            aria-label={`Mark "${task.title}" done`}
          />
        </label>
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-0.5">
          {title}
          <span className="ml-auto inline-flex min-w-0 flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
            {items.flatMap((item, i) => (i === 0 ? [item] : [<Dot key={`dot${i}`} />, item]))}
          </span>
        </div>
        {note && <div className="text-xs text-muted-foreground">{note}</div>}
      </div>
      {rowActions && (
        <div className="-my-1 flex shrink-0 items-center gap-0.5 opacity-100 transition-opacity md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100 [@media(hover:none)]:opacity-100">
          {rowActions}
        </div>
      )}
    </div>
  )
}
