import { XIcon } from '@primer/octicons-react'
import { IconButton, Select } from '@primer/react'
import { InlineMessage } from '@primer/react/experimental'
import { useMemo, useState } from 'react'
import { orderedProjectTasks, wouldCreateCycle } from '../../domain/order'
import type { Dependency, ID, Milestone, Task } from '../../domain/types'
import styles from './TaskDialog.module.css'

interface Props {
  task: Task
  /** The project the task will belong to (blockers must come from it). */
  projectId: ID
  tasks: Task[]
  milestones: Milestone[]
  /** Saved dependencies of the whole snapshot. */
  dependencies: Dependency[]
  /** Explicit blockers currently chosen in the dialog. */
  value: ID[]
  onChange: (ids: ID[]) => void
}

/** Pick explicit "blocked by" tasks from the same project; loops are rejected with an inline error. */
export function BlockedByEditor({
  task,
  projectId,
  tasks,
  milestones,
  dependencies,
  value,
  onChange,
}: Props) {
  const [error, setError] = useState<string | null>(null)
  const byId = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks])
  const milestoneName = (t: Task) => milestones.find((m) => m.id === t.milestoneId)?.name

  const candidates = useMemo(
    () =>
      orderedProjectTasks(projectId, milestones, tasks).filter(
        (t) => t.id !== task.id && !value.includes(t.id) && t.status !== 'done',
      ),
    [projectId, milestones, tasks, task.id, value],
  )

  const add = (blockerId: ID) => {
    if (!blockerId) return
    const blocker = byId.get(blockerId)
    // The graph as it will be once the dialog is saved: this task's own links come from the draft.
    const graph: Dependency[] = [
      ...dependencies.filter((d) => d.taskId !== task.id),
      ...value.map((id) => ({ taskId: task.id, blockedByTaskId: id })),
    ]
    if (wouldCreateCycle(task.id, blockerId, graph)) {
      setError(
        `Can't block this task on “${blocker?.title ?? 'that task'}”: it already depends on this task, which would create a loop.`,
      )
      return
    }
    setError(null)
    onChange([...value, blockerId])
  }

  return (
    <div className={styles.blockers}>
      {value.length === 0 ? (
        <p className={styles.hint}>
          No explicit blockers: this task simply follows the previous task in the project.
        </p>
      ) : (
        <ul className={styles.blockerList}>
          {value.map((id) => {
            const t = byId.get(id)
            return (
              <li key={id} className={styles.blockerItem}>
                <span className={t?.status === 'done' ? styles.doneText : undefined}>
                  {t?.title ?? 'Unknown task'}
                </span>
                <IconButton
                  icon={XIcon}
                  variant="invisible"
                  aria-label={`Remove blocker: ${t?.title ?? id}`}
                  onClick={() => {
                    setError(null)
                    onChange(value.filter((v) => v !== id))
                  }}
                />
              </li>
            )
          })}
        </ul>
      )}
      <Select
        block
        value=""
        aria-label="Add a blocker"
        disabled={candidates.length === 0}
        onChange={(e) => add(e.target.value)}
      >
        <Select.Option value="">Add a blocker…</Select.Option>
        {candidates.map((t) => (
          <Select.Option key={t.id} value={t.id}>
            {milestoneName(t) ? `${milestoneName(t)} · ${t.title}` : t.title}
          </Select.Option>
        ))}
      </Select>
      {error && (
        <InlineMessage variant="critical" role="alert">
          {error}
        </InlineMessage>
      )}
    </div>
  )
}
