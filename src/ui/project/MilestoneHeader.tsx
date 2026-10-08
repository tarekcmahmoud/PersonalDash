import { format, parseISO } from 'date-fns'
import { Crosshair } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { useApply } from '../../data/hooks'
import type { Milestone } from '../../domain/types'
import { ConfirmDialog } from './ConfirmDialog'
import { MilestoneDialog } from './MilestoneDialog'
import { renumber } from './ordering'
import { RowMenu } from './RowMenu'

interface Props {
  milestone: Milestone
  /** All milestones of the project in order (for move up/down). */
  siblings: Milestone[]
  taskCount: number
  /** Focus mode is on for this workstream. */
  focused?: boolean
  /** Turn focus mode on for this workstream (or off when it already is). */
  onToggleFocus?: () => void
}

/** Workstream heading (a card header): name, grey target date, and hover actions: focus and a `…` menu. */
export function MilestoneHeader({ milestone, siblings, taskCount, focused, onToggleFocus }: Props) {
  const apply = useApply()
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const index = siblings.findIndex((m) => m.id === milestone.id)

  const move = (delta: -1 | 1) => {
    const next = [...siblings]
    const [m] = next.splice(index, 1)
    next.splice(index + delta, 0, m!)
    const changed = renumber(next)
    if (changed.length > 0) void apply({ kind: 'saveMilestones', milestones: changed })
  }

  return (
    <div className="group flex min-h-8 items-center gap-3">
      <h3 className="min-w-0 truncate text-base font-medium">{milestone.name}</h3>
      {milestone.targetDate && (
        <span className="shrink-0 text-xs text-muted-foreground">
          {`${milestone.dateKind === 'hard' ? 'Deadline' : 'Target'} ${format(parseISO(milestone.targetDate), 'MMM d')}`}
        </span>
      )}
      <div
        className={cn(
          'ml-auto flex items-center opacity-100 transition-opacity md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100 [@media(hover:none)]:opacity-100',
          focused && 'md:opacity-100',
        )}
      >
        {onToggleFocus && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={focused ? `Exit focus on ${milestone.name}` : `Focus on ${milestone.name}`}
            aria-pressed={focused}
            className={cn('shrink-0 text-muted-foreground', focused && 'bg-muted text-foreground')}
            onClick={onToggleFocus}
          >
            <Crosshair />
          </Button>
        )}
        <RowMenu
          label={`Workstream actions: ${milestone.name}`}
          controls={{ isFirst: index <= 0, isLast: index >= siblings.length - 1, move }}
          extra={
            <>
              <DropdownMenuItem onSelect={() => setEditing(true)}>Rename workstream…</DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(true)}>
                Delete workstream…
              </DropdownMenuItem>
            </>
          }
        />
      </div>
      {editing && (
        <MilestoneDialog
          projectId={milestone.projectId}
          milestone={milestone}
          onClose={() => setEditing(false)}
        />
      )}
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={`Delete workstream “${milestone.name}”?`}
        description={
          taskCount > 0
            ? `This also deletes its ${taskCount} task${taskCount === 1 ? '' : 's'}. This cannot be undone.`
            : 'This cannot be undone.'
        }
        confirmLabel="Delete workstream"
        destructive
        onConfirm={() => apply({ kind: 'deleteMilestone', id: milestone.id })}
      />
    </div>
  )
}
