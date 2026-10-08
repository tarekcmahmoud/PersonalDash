import { Button, TextInput } from '@primer/react'
import { useState } from 'react'
import { useApply } from '../../data/hooks'
import type { PlanContext } from '../../domain/context'
import { CapacityBar } from '../components/CapacityBar'
import styles from './CapacitySummary.module.css'
import { weekStats } from './weekStats'

/** Sticky weekly capacity bar with an "Adjust" control to override (or reset) the week's capacity. */
export function CapacitySummary({ ctx }: { ctx: PlanContext }) {
  const apply = useApply()
  const { capacity, hours } = weekStats(ctx)
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState('')

  const meta = ctx.weeks.find((w) => w.weekStart === ctx.weekStart)
  const save = (capacityOverride: number | null) => {
    void apply({
      kind: 'saveWeek',
      week: {
        weekStart: ctx.weekStart,
        capacityOverride,
        reviewedAt: meta?.reviewedAt ?? null,
      },
    })
    setEditing(false)
  }

  const parsed = Number(value)
  const valid = value.trim() !== '' && Number.isFinite(parsed) && parsed >= 0

  return (
    <div className={styles.root}>
      <CapacityBar planned={hours} capacity={capacity.capacity} meetingHours={capacity.meetingHours} />
      <div className={styles.row}>
        <span className={styles.note}>
          {capacity.overridden ? 'Capacity set manually' : 'Capacity from your work hours'}
        </span>
        {!editing && (
          <Button
            size="small"
            onClick={() => {
              setValue(String(capacity.capacity))
              setEditing(true)
            }}
          >
            Adjust
          </Button>
        )}
      </div>
      {editing && (
        <form
          className={styles.form}
          onSubmit={(e) => {
            e.preventDefault()
            if (valid) save(parsed)
          }}
        >
          <TextInput
            type="number"
            inputMode="decimal"
            min={0}
            step={0.5}
            aria-label="Capacity override in hours"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            trailingVisual="h"
            className={styles.input}
          />
          <Button type="submit" variant="primary" disabled={!valid}>
            Save
          </Button>
          {capacity.overridden && <Button onClick={() => save(null)}>Reset to computed</Button>}
          <Button variant="invisible" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </form>
      )}
    </div>
  )
}
