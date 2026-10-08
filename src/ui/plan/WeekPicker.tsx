import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { usePlanContext, useSnapshot } from '../../data/hooks'
import { buildPickList, PICK_LIST_DEPTH } from '../../domain/planning'
import type { ISODate } from '../../domain/types'
import { CapacitySummary } from './CapacitySummary'
import { PickGroupCard } from './PickGroupCard'
import { weekStats } from './weekStats'

const SHOW_MORE_STEP = 3

const linkClass = 'underline-offset-4 hover:text-foreground hover:underline'

/**
 * Hand-pick the week's tasks: capacity line, then one group per project with a "plan this week" checkbox
 * per task, and one quiet line about follow-ups and the Inbox. Embedded by the weekly review as its last step.
 */
export function WeekPicker({ weekStart }: { weekStart: ISODate }) {
  const ctx = usePlanContext(weekStart)
  const { isError, error } = useSnapshot()
  const [depth, setDepth] = useState<Record<string, number>>({})

  const groups = useMemo(() => (ctx ? buildPickList(ctx, depth) : []), [ctx, depth])

  if (isError)
    return (
      <Alert variant="destructive">
        <AlertDescription>{`Could not load your data: ${String(error)}`}</AlertDescription>
      </Alert>
    )
  if (!ctx)
    return (
      <div role="status" aria-label="Loading" className="flex flex-col gap-3">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    )

  const { followUps } = weekStats(ctx)
  const inboxCount = ctx.tasks.filter((t) => t.projectId === null && t.status !== 'done').length

  return (
    <div>
      <CapacitySummary ctx={ctx} />

      <div className="divide-y">
        {groups.map((group) => (
          <PickGroupCard
            key={group.project.id}
            group={group}
            weekStart={weekStart}
            onShowMore={() =>
              setDepth((d) => ({
                ...d,
                [group.project.id]: (d[group.project.id] ?? PICK_LIST_DEPTH) + SHOW_MORE_STEP,
              }))
            }
          />
        ))}
      </div>

      {(followUps.length > 0 || inboxCount > 0) && (
        <p className="mt-8 text-sm text-muted-foreground">
          {followUps.length > 0 && (
            <Link to="/" className={linkClass}>
              {followUps.length} {followUps.length === 1 ? 'follow-up' : 'follow-ups'} due
            </Link>
          )}
          {followUps.length > 0 && inboxCount > 0 && ' · '}
          {inboxCount > 0 && (
            <Link to="/inbox" className={linkClass}>
              {inboxCount} in Inbox
            </Link>
          )}
        </p>
      )}
    </div>
  )
}
