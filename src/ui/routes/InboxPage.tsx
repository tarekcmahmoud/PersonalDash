import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useApply, useSnapshot } from '../../data/hooks'
import { useTaskActions } from '../../data/taskActions'
import { makeTask } from '../../domain/factories'
import type { Task } from '../../domain/types'
import { Page } from '../components/Page'
import { TaskRow } from '../components/TaskRow'
import { CollapsibleGroup } from '../project/CollapsibleGroup'
import { endPosition, groupTasks } from '../project/ordering'
import { FileToMenu } from '../task/FileToMenu'
import { TaskDialogHost } from '../task/TaskDialogHost'
import { useTaskParam } from '../task/useTaskParam'

export function InboxPage() {
  const { data } = useSnapshot()
  const apply = useApply()
  const actions = useTaskActions()
  const { open } = useTaskParam()
  const [title, setTitle] = useState('')

  const capture = (e: FormEvent) => {
    e.preventDefault()
    const t = title.trim()
    if (!t || !data) return
    setTitle('')
    void apply({
      kind: 'saveTasks',
      tasks: [
        makeTask({ title: t, size: 'S', projectId: null, position: endPosition(data.tasks, null, null) }),
      ],
    })
  }

  const inbox = data ? groupTasks(data.tasks, null, null) : []
  const openTasks = inbox.filter((t) => t.status !== 'done')
  const doneTasks = inbox.filter((t) => t.status === 'done')
  const checklistOf = (taskId: string) => {
    const items = data?.checklist.filter((c) => c.taskId === taskId) ?? []
    return { done: items.filter((c) => c.done).length, total: items.length }
  }

  const row = (t: Task, withFileTo: boolean) => (
    <TaskRow
      key={t.id}
      task={t}
      checklist={checklistOf(t.id)}
      onToggleDone={(task) => void actions.toggleDone(task)}
      onOpen={(task) => open(task.id)}
      actions={withFileTo ? <FileToMenu task={t} /> : undefined}
    />
  )

  return (
    <Page title="Inbox">
      <form className="mb-4 flex items-center gap-2" onSubmit={capture}>
        <Input
          value={title}
          placeholder="Capture a task, then Enter"
          aria-label="Capture a task"
          className="h-10"
          onChange={(e) => setTitle(e.target.value)}
        />
        <Button type="submit" variant="ghost" disabled={!title.trim()} className="shrink-0">
          Add
        </Button>
      </form>

      {!data ? (
        <div role="status" aria-label="Loading inbox" className="grid gap-3">
          <Skeleton className="h-8" />
          <Skeleton className="h-8" />
        </div>
      ) : (
        <Card size="sm" className="py-2">
          <CardContent>
            {openTasks.length === 0 ? (
              <p className="py-2 text-sm text-muted-foreground">Inbox zero. Nothing waiting to be filed.</p>
            ) : (
              <div className="divide-y">{openTasks.map((t) => row(t, true))}</div>
            )}

            {doneTasks.length > 0 && (
              <CollapsibleGroup label={`${doneTasks.length} done`} className="mt-1">
                <div className="divide-y">{doneTasks.map((t) => row(t, false))}</div>
              </CollapsibleGroup>
            )}
          </CardContent>
        </Card>
      )}

      <TaskDialogHost />
    </Page>
  )
}
