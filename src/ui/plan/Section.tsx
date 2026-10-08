import { CounterLabel } from '@primer/react'
import { useId, type ReactNode } from 'react'
import styles from './Section.module.css'

/** A titled block (optionally with a count and trailing actions) used by Plan and Today. */
export function Section({
  title,
  count,
  actions,
  muted,
  children,
}: {
  title: string
  count?: number
  actions?: ReactNode
  /** Subdued card, for read-only info such as meetings. */
  muted?: boolean
  children: ReactNode
}) {
  const id = useId()
  return (
    <section aria-labelledby={id} className={muted ? `${styles.section} ${styles.muted}` : styles.section}>
      <div className={styles.head}>
        <h2 id={id} className={styles.title}>
          {title}
        </h2>
        {count !== undefined && <CounterLabel>{count}</CounterLabel>}
        {actions && <div className={styles.actions}>{actions}</div>}
      </div>
      {children}
    </section>
  )
}
