import { X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { orderedProjectTasks, wouldCreateCycle } from '../../domain/order'
import type { Dependency, ID, Milestone, Task } from '../../domain/types'

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

/** Pick the tasks this one waits for, from the same project; loops are rejected with an inline error. */
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
        `This task can't wait for “${blocker?.title ?? 'that task'}”: that task already waits for this one, which would create a loop.`,
      )
      return
    }
    setError(null)
    onChange([...value, blockerId])
  }

  return (
    <div className="grid gap-2">
      {value.length === 0 ? (
        <p className="text-xs text-muted-foreground">Not linked to other tasks, so it can start any time.</p>
      ) : (
        <ul className="grid gap-0.5">
          {value.map((id) => {
            const t = byId.get(id)
            return (
              <li key={id} className="flex items-center justify-between gap-2 text-sm">
                <span
                  className={cn(
                    'min-w-0 truncate',
                    t?.status === 'done' && 'text-muted-foreground line-through',
                  )}
                >
                  {t?.title ?? 'Unknown task'}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="text-muted-foreground"
                  aria-label={`Stop waiting for: ${t?.title ?? id}`}
                  onClick={() => {
                    setError(null)
                    onChange(value.filter((v) => v !== id))
                  }}
                >
                  <X />
                </Button>
              </li>
            )
          })}
        </ul>
      )}
      <Select value="" onValueChange={add} disabled={candidates.length === 0}>
        <SelectTrigger aria-label="Add a task it waits for" className="w-full">
          <SelectValue placeholder="Add a task it waits for…" />
        </SelectTrigger>
        <SelectContent>
          {candidates.map((t) => (
            <SelectItem key={t.id} value={t.id}>
              {milestoneName(t) ? `${milestoneName(t)} · ${t.title}` : t.title}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
