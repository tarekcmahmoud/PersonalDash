import type { ReactNode } from 'react'
import styles from './StepIntro.module.css'

/** Heading + one line of guidance at the top of each review step. */
export function StepIntro({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className={styles.root}>
      <h2 className={styles.title}>{title}</h2>
      {children && <p className={styles.text}>{children}</p>}
    </div>
  )
}
