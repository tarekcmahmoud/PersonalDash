import { ClockIcon } from '@primer/octicons-react'
import { Button, TextInput } from '@primer/react'
import { format, parseISO } from 'date-fns'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { taskHref, useTaskActions } from '../../data/taskActions'
import type { FollowUpItem } from '../../domain/followups'
import { addDaysISO } from '../../domain/week'
import styles from './FollowUpRow.module.css'

/** A "Follow up: X re Y" item with "Still waiting → new date" and "Received" actions. */
export function FollowUpRow({ item, today }: { item: FollowUpItem; today: string }) {
  const actions = useTaskActions()
  const [snoozing, setSnoozing] = useState(false)
  const [date, setDate] = useState(() => addDaysISO(today, 7))

  const dateText = format(parseISO(item.date), 'EEE MMM d')

  return (
    <div className={styles.row} data-testid="follow-up-row">
      <div className={styles.main}>
        <ClockIcon className={item.overdue ? styles.overdue : styles.icon} />
        <div className={styles.text}>
          <Link to={taskHref(item.task)} className={styles.label}>
            {item.label}
          </Link>
          <span className={item.overdue ? styles.overdue : styles.date}>
            {item.overdue ? `Overdue since ${dateText}` : dateText}
          </span>
        </div>
      </div>
      <div className={styles.actions}>
        {snoozing ? (
          <>
            <TextInput
              type="date"
              aria-label="New follow-up date"
              value={date}
              min={today}
              onChange={(e) => setDate(e.target.value)}
            />
            <Button
              variant="primary"
              disabled={!date}
              onClick={() => {
                void actions.snoozeFollowUp(item.task, date)
                setSnoozing(false)
              }}
            >
              Save
            </Button>
            <Button variant="invisible" onClick={() => setSnoozing(false)}>
              Cancel
            </Button>
          </>
        ) : (
          <>
            <Button onClick={() => setSnoozing(true)}>Still waiting…</Button>
            <Button onClick={() => void actions.received(item.task)}>Received</Button>
          </>
        )}
      </div>
    </div>
  )
}
