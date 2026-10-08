import { Label, Text } from '@primer/react'
import type { OutlineDoc, OutlineTask } from '../../domain/outline'
import type { DateKind, ISODate } from '../../domain/types'
import { SizeLabel } from '../components/SizeLabel'
import { formatDate, outlineStats, summaryText } from './outlineStats'
import styles from './OutlinePreview.module.css'

function TaskItem({ task }: { task: OutlineTask }) {
  const meta: string[] = []
  if (task.key) meta.push(`#${task.key}`)
  if (task.after.length > 0) meta.push(`after: ${task.after.join(', ')}`)
  if (task.checklist.length > 0) {
    meta.push(`${task.checklist.length} checklist ${task.checklist.length === 1 ? 'item' : 'items'}`)
  }
  return (
    <li className={styles.task}>
      <div className={styles.taskLine}>
        <span className={styles.taskTitle}>{task.title}</span>
        <SizeLabel size={task.size} />
      </div>
      {meta.length > 0 && <div className={styles.meta}>{meta.join(' · ')}</div>}
      {task.doneWhen && <div className={styles.detail}>Done when: {task.doneWhen}</div>}
      {task.notes && <div className={`${styles.detail} ${styles.notes}`}>{task.notes}</div>}
    </li>
  )
}

function TargetLabel({ date, kind }: { date: ISODate; kind: DateKind | null }) {
  return (
    <Label variant={kind === 'hard' ? 'severe' : 'secondary'}>
      {kind === 'hard' ? 'Deadline' : 'Target'} · {formatDate(date)}
    </Label>
  )
}

/** Read-only rendering of a parsed outline. */
export function OutlinePreview({ doc }: { doc: OutlineDoc | null }) {
  if (!doc) {
    return (
      <div className={styles.root} data-testid="outline-preview">
        <p className={styles.empty}>
          Nothing to preview yet. Fix the errors (or paste an outline) to see the plan.
        </p>
      </div>
    )
  }
  const stats = outlineStats(doc)
  return (
    <div className={styles.root} data-testid="outline-preview">
      <header className={styles.project}>
        <h3 className={styles.projectName}>{doc.name}</h3>
        <div className={styles.projectMeta}>
          {doc.outcome ? (
            <Text className={styles.outcome}>Done when: {doc.outcome}</Text>
          ) : (
            <Text className={styles.outcomeMissing}>No outcome yet</Text>
          )}
          {doc.targetDate ? (
            <TargetLabel date={doc.targetDate} kind={doc.dateKind} />
          ) : (
            <Text className={styles.outcomeMissing}>No target date</Text>
          )}
          {doc.weeklyMin !== null && <Label variant="secondary">Min {doc.weeklyMin} / week</Label>}
        </div>
        <p className={styles.summary}>{summaryText(stats)}</p>
      </header>

      {doc.tasks.length > 0 && (
        <section className={styles.group}>
          {doc.milestones.length > 0 && <h4 className={styles.groupName}>No milestone</h4>}
          <ul className={styles.tasks}>
            {doc.tasks.map((t, i) => (
              <TaskItem key={i} task={t} />
            ))}
          </ul>
        </section>
      )}

      {doc.milestones.map((m, i) => (
        <section key={i} className={styles.group}>
          <h4 className={styles.groupName}>
            <span>{m.name}</span>
            {m.targetDate && <TargetLabel date={m.targetDate} kind={m.dateKind} />}
          </h4>
          {m.tasks.length === 0 ? (
            <p className={styles.empty}>No tasks yet</p>
          ) : (
            <ul className={styles.tasks}>
              {m.tasks.map((t, j) => (
                <TaskItem key={j} task={t} />
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  )
}
