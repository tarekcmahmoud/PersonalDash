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
  /** The milestone's siblings in order, itself included (for move up/down). */
  siblings: Milestone[]
  /** Tasks deleted with it (a workstream's count includes its substreams' tasks). */
  taskCount: number
  /** A workstream's substreams (deleted with it). */
  substreams?: Milestone[]
  /** Focus mode is on for this workstream. */
  focused?: boolean
  /** Turn focus mode on for this workstream (or off when it already is). */
  onToggleFocus?: () => void
}

/**
 * Workstream or substream heading (a card header): name, grey target date, and hover actions: focus (workstreams)
 * and a `…` menu (move, rename, add substream, delete).
 */
export function MilestoneHeader({
  milestone,
  siblings,
  taskCount,
  substreams = [],
  focused,
  onToggleFocus,
}: Props) {
  const apply = useApply()
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [addingSubstream, setAddingSubstream] = useState(false)
  const isSubstream = milestone.parentId !== null
  const kind = isSubstream ? 'substream' : 'workstream'
  const Heading = isSubstream ? 'h4' : 'h3'
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
      <Heading className={cn('min-w-0 truncate font-medium', isSubstream ? 'text-sm' : 'text-base')}>
        {milestone.name}
      </Heading>
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
          label={`${isSubstream ? 'Substream' : 'Workstream'} actions: ${milestone.name}`}
          controls={{ isFirst: index <= 0, isLast: index >= siblings.length - 1, move }}
          extra={
            <>
              <DropdownMenuItem onSelect={() => setEditing(true)}>{`Rename ${kind}…`}</DropdownMenuItem>
              {!isSubstream && (
                <DropdownMenuItem onSelect={() => setAddingSubstream(true)}>Add substream…</DropdownMenuItem>
              )}
              <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(true)}>
                {`Delete ${kind}…`}
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
      {addingSubstream && (
        <MilestoneDialog
          projectId={milestone.projectId}
          parentId={milestone.id}
          nextPosition={substreams.length > 0 ? Math.max(...substreams.map((s) => s.position)) + 1 : 0}
          onClose={() => setAddingSubstream(false)}
        />
      )}
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={`Delete ${kind} “${milestone.name}”?`}
        description={deleteDescription(substreams.length, taskCount)}
        confirmLabel={`Delete ${kind}`}
        destructive
        onConfirm={() => apply({ kind: 'deleteMilestone', id: milestone.id })}
      />
    </div>
  )
}

const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`

/** "This also deletes its 2 substreams and 5 tasks. This cannot be undone." */
function deleteDescription(substreamCount: number, taskCount: number): string {
  const parts = [
    substreamCount > 0 ? plural(substreamCount, 'substream') : '',
    taskCount > 0 ? plural(taskCount, 'task') : '',
  ].filter(Boolean)
  return parts.length > 0
    ? `This also deletes its ${parts.join(' and ')}. This cannot be undone.`
    : 'This cannot be undone.'
}
