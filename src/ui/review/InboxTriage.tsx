import { InboxIcon, TrashIcon } from '@primer/octicons-react'
import { Button, ConfirmationDialog } from '@primer/react'
import { Blankslate } from '@primer/react/experimental'
import { useState } from 'react'
import { useApply, useSnapshot } from '../../data/hooks'
import type { Task } from '../../domain/types'
import { TaskRow } from '../components/TaskRow'
import { groupTasks } from '../project/ordering'
import { FileToMenu } from '../task/FileToMenu'
import { StepIntro } from './StepIntro'
import styles from './InboxTriage.module.css'

/** Step 3: file every Inbox task into a project (or Admin / Misc), or delete it. */
export function InboxTriage() {
  const { data } = useSnapshot()
  const apply = useApply()
  const [deleting, setDeleting] = useState<Task | null>(null)

  const inbox = data ? groupTasks(data.tasks, null, null).filter((t) => t.status !== 'done') : []

  return (
    <div>
      <StepIntro title="Inbox">
        {inbox.length === 0
          ? 'Nothing waiting to be filed.'
          : `${inbox.length === 1 ? '1 task is' : `${inbox.length} tasks are`} not in a project yet. File each one, or delete it. Small odds and ends belong in Admin / Misc.`}
      </StepIntro>

      {inbox.length === 0 ? (
        <Blankslate border>
          <Blankslate.Visual>
            <InboxIcon size="medium" />
          </Blankslate.Visual>
          <Blankslate.Heading>Inbox is empty</Blankslate.Heading>
          <Blankslate.Description>
            Everything has a home. Carry on to planning the week.
          </Blankslate.Description>
        </Blankslate>
      ) : (
        <ul className={styles.list}>
          {inbox.map((task) => (
            <li key={task.id} className={styles.item}>
              <TaskRow task={task} />
              <div className={styles.actions}>
                <FileToMenu task={task} />
                <Button
                  size="medium"
                  variant="danger"
                  leadingVisual={TrashIcon}
                  aria-label={`Delete ${task.title}`}
                  onClick={() => setDeleting(task)}
                >
                  Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {deleting && (
        <ConfirmationDialog
          title={`Delete "${deleting.title}"?`}
          confirmButtonContent="Delete"
          confirmButtonType="danger"
          onClose={(gesture) => {
            const target = deleting
            setDeleting(null)
            if (gesture === 'confirm') void apply({ kind: 'deleteTask', id: target.id })
          }}
        >
          This removes the task for good.
        </ConfirmationDialog>
      )}
    </div>
  )
}
