import styles from './Stepper.module.css'
import { REVIEW_STEPS } from './steps'

/**
 * Step indicator. On wide screens: four numbered buttons (earlier steps are clickable to go back).
 * On phones: a compact "Step 2 of 4 · Leftovers" line with a progress bar (the Back button does the rest).
 */
export function Stepper({ current, onSelect }: { current: number; onSelect: (step: number) => void }) {
  return (
    <nav aria-label="Review steps" className={styles.root}>
      <ol className={styles.list}>
        {REVIEW_STEPS.map((label, i) => {
          const step = i + 1
          const state = step === current ? styles.current : step < current ? styles.done : styles.todo
          return (
            <li key={label} className={styles.item}>
              <button
                type="button"
                className={`${styles.button} ${state}`}
                aria-current={step === current ? 'step' : undefined}
                disabled={step > current}
                onClick={() => onSelect(step)}
              >
                <span className={styles.number} aria-hidden="true">
                  {step}
                </span>
                <span className={styles.label}>{label}</span>
              </button>
            </li>
          )
        })}
      </ol>
      <div className={styles.compact} aria-hidden="true">
        <span>{`Step ${current} of ${REVIEW_STEPS.length} · ${REVIEW_STEPS[current - 1]}`}</span>
        <div className={styles.bar}>
          <div className={styles.fill} style={{ width: `${(current / REVIEW_STEPS.length) * 100}%` }} />
        </div>
      </div>
    </nav>
  )
}
