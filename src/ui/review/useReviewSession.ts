import { useCallback, useState } from 'react'
import { useApply, useSnapshot, useUpdateTasks } from '../../data/hooks'
import { carryOver, returnToProject, weekRetro, type WeekRetro } from '../../domain/review'
import type { ID, ISODate, Task } from '../../domain/types'

export interface Decision {
  kind: 'carry' | 'return'
  /** The task as it was before the decision, for Undo. */
  before: Task
}

interface Session {
  key: string
  retro: WeekRetro
  decisions: Record<ID, Decision>
}

export interface ReviewSession {
  /** The retro of the reviewed week, frozen when the review opened (so decided tasks keep their row). */
  retro: WeekRetro
  decisions: Record<ID, Decision>
  undecided: Task[]
  carry: (task: Task) => Promise<void>
  giveBack: (task: Task) => Promise<void>
  carryAll: () => Promise<void>
  returnAll: () => Promise<void>
  undo: (task: Task) => Promise<void>
}

/**
 * Review state shared by the steps. The retro is computed once per (past week, new week) pair: carrying a
 * task over changes its weekStart, so recomputing would make decided rows vanish from the Leftovers step.
 * Decisions are written straight to the data; this hook only remembers them for display and Undo.
 */
export function useReviewSession(pastWeek: ISODate, newWeek: ISODate): ReviewSession | null {
  const { data } = useSnapshot()
  const updateTasks = useUpdateTasks()
  const apply = useApply()
  const key = `${pastWeek}|${newWeek}`
  const [session, setSession] = useState<Session | null>(null)

  if (data && session?.key !== key) {
    setSession({ key, retro: weekRetro(data, pastWeek), decisions: {} })
  }

  const decide = useCallback(
    async (kind: Decision['kind'], tasks: Task[]) => {
      if (!data || tasks.length === 0) return
      const live = tasks.map((t) => data.tasks.find((x) => x.id === t.id) ?? t)
      setSession((s) =>
        s
          ? {
              ...s,
              decisions: {
                ...s.decisions,
                ...Object.fromEntries(live.map((before) => [before.id, { kind, before }])),
              },
            }
          : s,
      )
      await updateTasks(
        live.map((task) => ({
          task,
          patch: kind === 'carry' ? carryOver(task, newWeek) : returnToProject(task),
        })),
      )
    },
    [data, newWeek, updateTasks],
  )

  const undo = useCallback(
    async (task: Task) => {
      const decision = session?.decisions[task.id]
      if (!decision) return
      setSession((s) => {
        if (!s) return s
        const decisions = { ...s.decisions }
        delete decisions[task.id]
        return { ...s, decisions }
      })
      await apply({ kind: 'saveTasks', tasks: [decision.before] })
    },
    [apply, session],
  )

  if (!session || session.key !== key) return null
  const undecided = session.retro.leftovers.filter((t) => !session.decisions[t.id])
  return {
    retro: session.retro,
    decisions: session.decisions,
    undecided,
    carry: (task) => decide('carry', [task]),
    giveBack: (task) => decide('return', [task]),
    carryAll: () => decide('carry', undecided),
    returnAll: () => decide('return', undecided),
    undo,
  }
}
