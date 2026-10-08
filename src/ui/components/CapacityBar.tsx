import { ProgressBar, Stack } from '@primer/react'
import styles from './CapacityBar.module.css'

/** Hours rounded to 1 decimal, without a trailing ".0" (12 -> "12", 12.5 -> "12.5"). */
function formatHours(hours: number): string {
  return String(Math.round(hours * 10) / 10)
}

/** Weekly capacity bar: planned hours against capacity, with over-capacity and meeting hours called out. */
export function CapacityBar({
  planned,
  capacity,
  meetingHours,
}: {
  planned: number
  capacity: number
  meetingHours?: number
}) {
  // Compare in tenths of an hour so float noise cannot show "0h over".
  const overTenths = Math.round(planned * 10) - Math.round(capacity * 10)
  const isOver = overTenths > 0
  const percent = capacity > 0 ? Math.min(100, (planned / capacity) * 100) : planned > 0 ? 100 : 0

  return (
    <Stack gap="condensed">
      <ProgressBar
        aria-label="Capacity used"
        progress={Math.max(0, percent)}
        bg={isOver ? 'danger' : 'accent'}
      />
      <div className={styles.meta}>
        <span>
          {formatHours(planned)}h planned of {formatHours(capacity)}h
        </span>
        {isOver && <span className={styles.over}> · {formatHours(overTenths / 10)}h over</span>}
        {meetingHours !== undefined && meetingHours > 0 && (
          <span> · {formatHours(meetingHours)}h in meetings</span>
        )}
      </div>
    </Stack>
  )
}
