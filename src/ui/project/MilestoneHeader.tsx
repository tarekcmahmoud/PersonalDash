import { KebabHorizontalIcon } from '@primer/octicons-react'
import { ActionList, ActionMenu, IconButton, Label, useConfirm } from '@primer/react'
import { format, parseISO } from 'date-fns'
import { useState } from 'react'
import { useApply } from '../../data/hooks'
import type { Milestone } from '../../domain/types'
import { MilestoneDialog } from './MilestoneDialog'
import { renumber } from './ordering'
import styles from './MilestoneHeader.module.css'

interface Props {
  milestone: Milestone
  /** All milestones of the project in order (for move up/down). */
  siblings: Milestone[]
  taskCount: number
}

/** Milestone title row: name, target date, and a menu to rename / reorder / delete. */
export function MilestoneHeader({ milestone, siblings, taskCount }: Props) {
  const apply = useApply()
  const confirm = useConfirm()
  const [editing, setEditing] = useState(false)
  const index = siblings.findIndex((m) => m.id === milestone.id)

  const move = (delta: -1 | 1) => {
    const next = [...siblings]
    const [m] = next.splice(index, 1)
    next.splice(index + delta, 0, m!)
    const changed = renumber(next)
    if (changed.length > 0) void apply({ kind: 'saveMilestones', milestones: changed })
  }

  const remove = async () => {
    const ok = await confirm({
      title: `Delete milestone “${milestone.name}”?`,
      content:
        taskCount > 0
          ? `This also deletes its ${taskCount} task${taskCount === 1 ? '' : 's'}. This cannot be undone.`
          : 'This cannot be undone.',
      confirmButtonContent: 'Delete milestone',
      confirmButtonType: 'danger',
    })
    if (ok) await apply({ kind: 'deleteMilestone', id: milestone.id })
  }

  return (
    <div className={styles.header}>
      <h2 className={styles.name}>{milestone.name}</h2>
      {milestone.targetDate && (
        <Label variant={milestone.dateKind === 'hard' ? 'severe' : 'secondary'}>
          {`${milestone.dateKind === 'hard' ? 'Deadline' : 'Target'} · ${format(parseISO(milestone.targetDate), 'MMM d')}`}
        </Label>
      )}
      <ActionMenu>
        <ActionMenu.Anchor>
          <IconButton
            className={styles.menu}
            icon={KebabHorizontalIcon}
            variant="invisible"
            aria-label={`Milestone actions: ${milestone.name}`}
          />
        </ActionMenu.Anchor>
        <ActionMenu.Overlay width="small">
          <ActionList>
            <ActionList.Item onSelect={() => setEditing(true)}>Rename / edit…</ActionList.Item>
            <ActionList.Item disabled={index <= 0} onSelect={() => move(-1)}>
              Move up
            </ActionList.Item>
            <ActionList.Item disabled={index >= siblings.length - 1} onSelect={() => move(1)}>
              Move down
            </ActionList.Item>
            <ActionList.Divider />
            <ActionList.Item variant="danger" onSelect={() => void remove()}>
              Delete milestone…
            </ActionList.Item>
          </ActionList>
        </ActionMenu.Overlay>
      </ActionMenu>
      {editing && (
        <MilestoneDialog
          projectId={milestone.projectId}
          milestone={milestone}
          onClose={() => setEditing(false)}
        />
      )}
    </div>
  )
}
