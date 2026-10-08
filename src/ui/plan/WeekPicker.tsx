import { Flash, Spinner } from '@primer/react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { usePlanContext, useSnapshot } from '../../data/hooks'
import { buildPickList, PICK_LIST_DEPTH } from '../../domain/planning'
import type { ISODate } from '../../domain/types'
import { CapacitySummary } from './CapacitySummary'
import { FollowUpRow } from './FollowUpRow'
import { PickGroupCard } from './PickGroupCard'
import { PlannedList } from './PlannedList'
import { Section } from './Section'
import styles from './WeekPicker.module.css'
import { weekStats } from './weekStats'

const SHOW_MORE_STEP = 3

/**
 * Hand-pick the week's tasks: sticky capacity summary, what is planned so far, the per-project pick list,
 * follow-ups and the inbox count. Embedded by the weekly review as its last step.
 */
export function WeekPicker({ weekStart }: { weekStart: ISODate }) {
  const ctx = usePlanContext(weekStart)
  const { isError, error } = useSnapshot()
  const [depth, setDepth] = useState<Record<string, number>>({})

  const groups = useMemo(() => (ctx ? buildPickList(ctx, depth) : []), [ctx, depth])

  if (isError) return <Flash variant="danger">{`Could not load your data: ${String(error)}`}</Flash>
  if (!ctx) return <Spinner aria-label="Loading" />

  const { planned, followUps } = weekStats(ctx)
  const inboxCount = ctx.tasks.filter((t) => t.projectId === null && t.status !== 'done').length

  return (
    <div className={styles.root}>
      <CapacitySummary ctx={ctx} />

      <PlannedList ctx={ctx} planned={planned} />

      <div className={styles.groups}>
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

      {followUps.length > 0 && (
        <Section title="Follow-ups this week" count={followUps.length}>
          {followUps.map((item) => (
            <FollowUpRow key={item.task.id} item={item} today={ctx.today} />
          ))}
        </Section>
      )}

      {inboxCount > 0 && (
        <Section title="Inbox" count={inboxCount}>
          <p className={styles.inbox}>
            {inboxCount === 1 ? '1 task is' : `${inboxCount} tasks are`} not filed into a project yet.{' '}
            <Link to="/inbox">Go to Inbox</Link>
          </p>
        </Section>
      )}
    </div>
  )
}
