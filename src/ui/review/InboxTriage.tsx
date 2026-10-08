import { Trash2 } from 'lucide-react'
import { useState } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { useApply, useSnapshot } from '../../data/hooks'
import type { Task } from '../../domain/types'
import { TaskRow } from '../components/TaskRow'
import { groupTasks } from '../project/ordering'
import { FileToMenu } from '../task/FileToMenu'
import { StepIntro } from './StepIntro'

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
          ? 'Inbox is empty'
          : `${inbox.length === 1 ? '1 task is' : `${inbox.length} tasks are`} not in a project yet. File each one, or delete it. Small odds and ends belong in Admin / Misc.`}
      </StepIntro>

      {inbox.length > 0 && (
        <ul className="divide-y">
          {inbox.map((task) => (
            <li key={task.id} className="flex flex-wrap items-center gap-x-3 py-1">
              <TaskRow className="min-w-0 flex-1 basis-64" task={task} />
              <div className="flex shrink-0 items-center gap-1 pb-1 sm:pb-0">
                <FileToMenu task={task} />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-muted-foreground"
                  aria-label={`Delete ${task.title}`}
                  onClick={() => setDeleting(task)}
                >
                  <Trash2 />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{`Delete "${deleting?.title ?? ''}"?`}</AlertDialogTitle>
            <AlertDialogDescription>This removes the task for good.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (deleting) void apply({ kind: 'deleteTask', id: deleting.id })
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
