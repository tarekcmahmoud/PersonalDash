import type { OutlineDoc, OutlineTask } from '../../domain/outline'
import type { DateKind, ISODate } from '../../domain/types'
import { SizeLabel } from '../components/SizeLabel'
import { formatDate, outlineStats, summaryText } from './outlineStats'

function TaskItem({ task }: { task: OutlineTask }) {
  const meta: string[] = []
  if (task.after.length > 0) meta.push(`after: ${task.after.join(', ')}`)
  if (task.checklist.length > 0) {
    meta.push(`${task.checklist.length} checklist ${task.checklist.length === 1 ? 'item' : 'items'}`)
  }
  return (
    <li className="py-1.5">
      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
        <span className="min-w-0 text-sm break-words">{task.title}</span>
        <SizeLabel size={task.size} className="text-xs" />
        {meta.map((m) => (
          <span key={m} className="text-xs text-muted-foreground">
            {m}
          </span>
        ))}
      </div>
      {task.doneWhen && <p className="text-xs text-muted-foreground">Done when: {task.doneWhen}</p>}
      {task.notes && <p className="text-xs whitespace-pre-line text-muted-foreground">{task.notes}</p>}
    </li>
  )
}

const targetText = (date: ISODate, kind: DateKind | null) =>
  `${kind === 'hard' ? 'Deadline' : 'Target'} ${formatDate(date)}`

/** Read-only rendering of a parsed outline: plain headings and one-line task rows, no boxes. */
export function OutlinePreview({ doc }: { doc: OutlineDoc | null }) {
  if (!doc) {
    return (
      <div data-testid="outline-preview">
        <p className="text-sm text-muted-foreground">
          Nothing to preview yet. Fix the errors (or paste an outline) to see the plan.
        </p>
      </div>
    )
  }
  const stats = outlineStats(doc)
  const objective = [
    doc.outcome || 'No outcome yet',
    doc.targetDate ? targetText(doc.targetDate, doc.dateKind) : 'No target date',
    doc.weeklyMin !== null ? `Min ${doc.weeklyMin} / week` : null,
  ].filter(Boolean)
  return (
    <div data-testid="outline-preview" className="space-y-6">
      <header>
        <h3 className="text-base font-medium">{doc.name}</h3>
        <p className="mt-0.5 text-sm text-muted-foreground">{objective.join(' · ')}</p>
        <p className="mt-0.5 text-sm text-muted-foreground">{summaryText(stats)}</p>
      </header>

      {doc.tasks.length > 0 && (
        <section>
          {doc.milestones.length > 0 && (
            <h4 className="text-sm font-medium text-muted-foreground">No milestone</h4>
          )}
          <ul className="divide-y divide-border/60">
            {doc.tasks.map((t, i) => (
              <TaskItem key={i} task={t} />
            ))}
          </ul>
        </section>
      )}

      {doc.milestones.map((m, i) => (
        <section key={i}>
          <h4 className="mb-0.5 flex flex-wrap items-baseline gap-x-2 text-sm font-medium">
            <span>{m.name}</span>
            {m.targetDate && (
              <span className="text-xs font-normal text-muted-foreground">
                {targetText(m.targetDate, m.dateKind)}
              </span>
            )}
          </h4>
          {m.tasks.length === 0 ? (
            <p className="text-xs text-muted-foreground">No tasks yet</p>
          ) : (
            <ul className="divide-y divide-border/60">
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
