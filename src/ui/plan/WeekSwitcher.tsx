import { ChevronLeftIcon, ChevronRightIcon } from '@primer/octicons-react'
import { Button, IconButton } from '@primer/react'
import type { ISODate } from '../../domain/types'
import { addWeeksISO, formatWeekRange } from '../../domain/week'
import styles from './WeekSwitcher.module.css'

/** ‹ Oct 5 – 11 › with a "This week" reset. Controlled: the caller owns the week state. */
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
    <div className={styles.root} role="group" aria-label="Week">
      <IconButton
        icon={ChevronLeftIcon}
        aria-label="Previous week"
        variant="invisible"
        onClick={() => onChange(addWeeksISO(weekStart, -1))}
      />
      <div className={styles.label} aria-live="polite">
        <strong>{formatWeekRange(weekStart)}</strong>
        {isCurrentWeek && <span className={styles.current}>This week</span>}
      </div>
      <IconButton
        icon={ChevronRightIcon}
        aria-label="Next week"
        variant="invisible"
        onClick={() => onChange(addWeeksISO(weekStart, 1))}
      />
      {!isCurrentWeek && <Button onClick={onReset}>This week</Button>}
    </div>
  )
}
