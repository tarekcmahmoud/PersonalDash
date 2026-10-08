import { CounterLabel, Details, Label } from '@primer/react'
import type { WeekRetro } from '../../domain/review'
import type { ID, Project } from '../../domain/types'
import { formatWeekRange } from '../../domain/week'
import { Section } from '../plan/Section'
import styles from './LookBack.module.css'
import { StepIntro } from './StepIntro'

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`

/** Step 1: a minimal look at last week. Numbers and lists only. */
export function LookBack({ retro, projects }: { retro: WeekRetro; projects: Project[] }) {
  const nameOf = new Map<ID | null, string>(projects.map((p) => [p.id, p.name]))
  const { totalDone, doneByProject, leftovers, untouched } = retro

  return (
    <div className={styles.root}>
      <StepIntro title="Look back">{`Here is how ${formatWeekRange(retro.weekStart)} went.`}</StepIntro>

      <div className={styles.tiles}>
        <div className={styles.tile}>
          <span className={styles.big}>{totalDone}</span>
          <span className={styles.caption}>{totalDone === 1 ? 'task done' : 'tasks done'}</span>
        </div>
        <div className={styles.tile}>
          <span className={styles.big}>{leftovers.length}</span>
          <span className={styles.caption}>left over</span>
        </div>
        <div className={styles.tile}>
          <span className={styles.big}>{untouched.length}</span>
          <span className={styles.caption}>
            {untouched.length === 1 ? 'project untouched' : 'projects untouched'}
          </span>
        </div>
      </div>

      <Section title="Done" count={totalDone}>
        {totalDone === 0 ? (
          <p className={styles.note}>
            Nothing was ticked off last week. A fresh start is fine, so let us plan a good one.
          </p>
        ) : (
          <>
            <p className={styles.note}>Nice work. Here is where it went.</p>
            {doneByProject.map((group) => (
              <Details key={group.projectId ?? 'inbox'} className={styles.group}>
                <Details.Summary className={styles.summary}>
                  <span className={styles.name}>{nameOf.get(group.projectId) ?? 'Inbox'}</span>
                  <CounterLabel>{group.tasks.length}</CounterLabel>
                </Details.Summary>
                <ul className={styles.titles}>
                  {group.tasks.map((t) => (
                    <li key={t.id}>{t.title}</li>
                  ))}
                </ul>
              </Details>
            ))}
          </>
        )}
      </Section>

      <Section title="Left over" count={leftovers.length}>
        <p className={styles.note}>
          {leftovers.length === 0
            ? 'Everything you planned got done.'
            : `${plural(leftovers.length, 'planned task is', 'planned tasks are')} still open. You will decide what happens to ${leftovers.length === 1 ? 'it' : 'them'} next.`}
        </p>
      </Section>

      <Section title="Untouched projects" count={untouched.length}>
        {untouched.length === 0 ? (
          <p className={styles.note}>Every active project moved forward. </p>
        ) : (
          <ul className={styles.untouched}>
            {untouched.map((p) => (
              <li key={p.id} className={styles.untouchedRow}>
                <span className={styles.name}>{p.name}</span>
                <Label variant="attention">No progress</Label>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  )
}
