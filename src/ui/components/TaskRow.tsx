import { Checkbox, Label } from '@primer/react'
import { ChecklistIcon, ClockIcon, PinIcon } from '@primer/octicons-react'
import { format, parseISO } from 'date-fns'
import type { ReactNode } from 'react'
import type { Task } from '../../domain/types'
import { SizeLabel } from './SizeLabel'
import styles from './TaskRow.module.css'

export interface TaskRowProps {
  task: Task
  /** Shown as muted secondary text when given. */
  projectName?: string
  /** Shows "done/total" with a checklist icon when total > 0. */
  checklist?: { done: number; total: number }
  /** When given, renders a checkbox (checked = status done). */
  onToggleDone?: (task: Task) => void
  /** When given, the title becomes a button that calls it. */
  onOpen?: (task: Task) => void
  /** Action buttons or other controls, rendered at the end of the row. */
  trailing?: ReactNode
  /** Greyed out, e.g. blocked. */
  muted?: boolean
  /** Small secondary line under the title, e.g. "Blocked by: X". */
  note?: ReactNode
}

const cx = (...names: (string | false | null | undefined)[]): string => names.filter(Boolean).join(' ')

const SLIP_WARNING_AT = 2

/** One task line, used everywhere tasks are listed. Meta badges wrap on narrow screens. */
export function TaskRow({
  task,
  projectName,
  checklist,
  onToggleDone,
  onOpen,
  trailing,
  muted,
  note,
}: TaskRowProps) {
  const done = task.status === 'done'
  const waiting = task.status === 'waiting'
  const tooltip = task.doneWhen || undefined

  const titleClass = cx(styles.title, done && styles.done)
  const title = onOpen ? (
    <button
      type="button"
      className={cx(titleClass, styles.titleButton)}
      title={tooltip}
      onClick={() => onOpen(task)}
    >
      {task.title}
    </button>
  ) : (
    <span className={titleClass} title={tooltip}>
      {task.title}
    </span>
  )

  const waitingText = [
    task.waitingOn ? `Waiting on ${task.waitingOn}` : 'Waiting',
    task.followUpDate ? ` · follow up ${format(parseISO(task.followUpDate), 'MMM d')}` : '',
  ].join('')

  return (
    <div data-testid="task-row" data-status={task.status} className={cx(styles.row, muted && styles.muted)}>
      {onToggleDone && (
        <div className={styles.checkbox}>
          <Checkbox
            checked={done}
            onChange={() => onToggleDone?.(task)}
            aria-label={`Mark "${task.title}" done`}
          />
        </div>
      )}
      <div className={styles.body}>
        <div className={styles.titleLine}>
          {title}
          <div className={styles.meta}>
            <SizeLabel size={task.size} />
            {task.pinnedDay && (
              <span className={styles.metaItem} title="Pinned to this day">
                <PinIcon />
                <span>{format(parseISO(task.pinnedDay), 'EEE')}</span>
              </span>
            )}
            {waiting && (
              <span className={cx(styles.metaItem, styles.waiting)}>
                <ClockIcon />
                <span>{waitingText}</span>
              </span>
            )}
            {task.slipCount >= SLIP_WARNING_AT && (
              <Label variant="attention">{`Slipped ×${task.slipCount}`}</Label>
            )}
            {checklist && checklist.total > 0 && (
              <span className={styles.metaItem}>
                <ChecklistIcon />
                <span>{`${checklist.done}/${checklist.total}`}</span>
              </span>
            )}
          </div>
        </div>
        {projectName && <div className={styles.secondary}>{projectName}</div>}
        {note && <div className={styles.secondary}>{note}</div>}
      </div>
      {trailing && <div className={styles.trailing}>{trailing}</div>}
    </div>
  )
}
