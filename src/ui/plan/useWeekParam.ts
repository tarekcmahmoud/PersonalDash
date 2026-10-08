import { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useToday } from '../../data/hooks'
import type { ISODate } from '../../domain/types'
import { fromISODate, weekStartOf } from '../../domain/week'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/** Parses the `?week=` value: any valid date snaps to its Monday; anything else is null. */
function parseWeek(value: string | null): ISODate | null {
  if (!value || !ISO_DATE.test(value)) return null
  return Number.isNaN(fromISODate(value).getTime()) ? null : weekStartOf(value)
}

/** The viewed week (Monday), kept in the `?week=YYYY-MM-DD` query param. No param = the current week. */
export function useWeekParam(): {
  weekStart: ISODate
  setWeek: (weekStart: ISODate) => void
  /** Back to the current week. */
  resetWeek: () => void
  today: ISODate
  isCurrentWeek: boolean
} {
  const today = useToday()
  const [params, setParams] = useSearchParams()
  const current = weekStartOf(today)
  const weekStart = parseWeek(params.get('week')) ?? current

  const setWeek = useCallback(
    (next: ISODate) => {
      setParams(
        (prev) => {
          const out = new URLSearchParams(prev)
          if (next === current) out.delete('week')
          else out.set('week', next)
          return out
        },
        { replace: true },
      )
    },
    [setParams, current],
  )

  const resetWeek = useCallback(() => setWeek(current), [setWeek, current])

  return { weekStart, setWeek, resetWeek, today, isCurrentWeek: weekStart === current }
}
