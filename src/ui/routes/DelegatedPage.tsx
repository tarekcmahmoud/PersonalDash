import { format, parseISO } from 'date-fns'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { usePlanContext, useSnapshot } from '../../data/hooks'
import { useTaskActions } from '../../data/taskActions'
import { delegationByPerson, type DelegatedItem } from '../../domain/delegation'
import { CardSection, Page } from '../components/Page'
import { TaskRow } from '../components/TaskRow'
import { FollowUpAgain } from '../plan/FollowUpAgain'
import { TaskDialogHost } from '../task/TaskDialogHost'
import { useTaskParam } from '../task/useTaskParam'

/**
 * Everything you've handed off, grouped by person: people with follow-ups due first. Tick a task when they're
 * done, or "Follow up again…" to set the next check-in.
 */
export function DelegatedPage() {
  const ctx = usePlanContext()
  const { isError, error } = useSnapshot()
  const actions = useTaskActions()
  const { open } = useTaskParam()

  if (isError)
    return (
      <Alert variant="destructive">
        <AlertDescription>{`Could not load your data: ${String(error)}`}</AlertDescription>
      </Alert>
    )
  if (!ctx)
    return (
      <Page title="Delegated">
        <div role="status" aria-label="Loading" className="grid gap-3">
          <Skeleton className="h-8" />
          <Skeleton className="h-8" />
        </div>
      </Page>
    )

  const groups = delegationByPerson(ctx.tasks, ctx.people, ctx.today)
  const projectName = (id: string | null) => ctx.projects.find((p) => p.id === id)?.name ?? 'Inbox'
  const dueCount = groups.reduce((n, g) => n + g.dueCount, 0)

  const followUpText = ({ task, due, overdue }: DelegatedItem) => {
    if (!task.followUpDate) return <span>No follow-up date</span>
    const date = format(parseISO(task.followUpDate), 'MMM d')
    if (overdue) return <span className="text-destructive">{`Follow up · overdue since ${date}`}</span>
    return <span>{due ? 'Follow up today' : `Follow up ${date}`}</span>
  }

  return (
    <Page
      title="Delegated"
      description={
        groups.length === 0
          ? 'Tasks you hand off to collaborators, by person.'
          : dueCount > 0
            ? `${dueCount} follow-up${dueCount === 1 ? '' : 's'} due`
            : 'No follow-ups due today'
      }
    >
      {groups.length === 0 ? (
        <Card>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Nothing delegated. Add collaborators to a project (its … menu), then delegate a task from its …
              menu or in the task dialog.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map(({ person, items }) => (
            <CardSection key={person.id} title={person.name} count={items.length}>
              <div className="divide-y">
                {items.map((item) => (
                  <TaskRow
                    key={item.task.id}
                    task={item.task}
                    hideAssignee
                    projectName={projectName(item.task.projectId)}
                    meta={[followUpText(item)]}
                    onToggleDone={(t) => void actions.toggleDone(t)}
                    onOpen={(t) => open(t.id)}
                    actions={<FollowUpAgain task={item.task} today={ctx.today} label="Follow up again…" />}
                  />
                ))}
              </div>
            </CardSection>
          ))}
        </div>
      )}
      <TaskDialogHost />
    </Page>
  )
}
