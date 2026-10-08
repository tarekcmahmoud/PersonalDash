import { InboxIcon, PlusIcon } from '@primer/octicons-react'
import { Button, Details, Spinner, TextInput } from '@primer/react'
import { Blankslate } from '@primer/react/experimental'
import { useState, type FormEvent } from 'react'
import { useApply, useSnapshot } from '../../data/hooks'
import { useTaskActions } from '../../data/taskActions'
import { makeTask } from '../../domain/factories'
import { Page } from '../components/Page'
import { TaskRow } from '../components/TaskRow'
import { endPosition, groupTasks } from '../project/ordering'
import { FileToMenu } from '../task/FileToMenu'
import { TaskDialogHost } from '../task/TaskDialogHost'
import { useTaskParam } from '../task/useTaskParam'
import styles from './InboxPage.module.css'

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

  const row = (t: (typeof inbox)[number], withFileTo: boolean) => (
    <div key={t.id} className={styles.item}>
      <TaskRow
        task={t}
        checklist={checklistOf(t.id)}
        onToggleDone={(task) => void actions.toggleDone(task)}
        onOpen={(task) => open(task.id)}
        trailing={withFileTo ? <FileToMenu task={t} /> : undefined}
      />
    </div>
  )

  return (
    <Page
      title="Inbox"
      description="Capture now, decide later. File tasks into a project when you know where they belong."
    >
      <form className={styles.capture} onSubmit={capture}>
        <TextInput
          className={styles.captureInput}
          block
          size="large"
          leadingVisual={PlusIcon}
          value={title}
          placeholder="Capture a task and press Enter"
          aria-label="Capture a task"
          onChange={(e) => setTitle(e.target.value)}
        />
        <Button type="submit" variant="primary" size="large" disabled={!title.trim()}>
          Add
        </Button>
      </form>

      {!data ? (
        <Spinner aria-label="Loading inbox" />
      ) : openTasks.length === 0 ? (
        <Blankslate border>
          <Blankslate.Visual>
            <InboxIcon size="medium" />
          </Blankslate.Visual>
          <Blankslate.Heading>Inbox zero</Blankslate.Heading>
          <Blankslate.Description>
            Nothing waiting to be filed. Capture new ideas above.
          </Blankslate.Description>
        </Blankslate>
      ) : (
        <div>{openTasks.map((t) => row(t, true))}</div>
      )}

      {doneTasks.length > 0 && (
        <Details className={styles.doneDetails}>
          <Details.Summary className={styles.summary}>{`${doneTasks.length} done`}</Details.Summary>
          {doneTasks.map((t) => row(t, false))}
        </Details>
      )}

      <TaskDialogHost />
    </Page>
  )
}
