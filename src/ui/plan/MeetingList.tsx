import type { CalendarEvent } from '../../domain/types'
import { eventTimeText } from './events'
import styles from './MeetingList.module.css'

/** Read-only, muted list of calendar events. Renders nothing when there are none. */
export function MeetingList({ events, compact }: { events: CalendarEvent[]; compact?: boolean }) {
  if (events.length === 0) return null
  return (
    <ul className={compact ? `${styles.list} ${styles.compact}` : styles.list} aria-label="Meetings">
      {events.map((ev) => (
        <li key={ev.id} className={styles.item}>
          <span className={styles.time}>{eventTimeText(ev)}</span>
          <span className={styles.title}>{ev.title}</span>
        </li>
      ))}
    </ul>
  )
}
