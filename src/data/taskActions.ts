import { useMemo } from 'react'
import { receiveWaiting, snoozeFollowUp } from '../domain/followups'
import { nowISO } from '../domain/ids'
import { delegateTask, takeBackTask } from '../domain/delegation'
import { completeTask, reopenTask } from '../domain/review'
import type { ISODate, Task } from '../domain/types'
import { weekStartOf } from '../domain/week'
import { useUpdateTask } from './hooks'

/** Common task state transitions, shared by every screen. All return the write promise. */
export function useTaskActions() {
  const update = useUpdateTask()
  return useMemo(
    () => ({
      toggleDone: (t: Task) => update(t, t.status === 'done' ? reopenTask(t) : completeTask(t, nowISO())),
      /** Plan into a week (default: the week containing `day`, else the given week). */
      plan: (t: Task, weekStart: ISODate) =>
        update(t, {
          weekStart,
          pinnedDay: t.pinnedDay && weekStartOf(t.pinnedDay) === weekStart ? t.pinnedDay : null,
        }),
      unplan: (t: Task) =>
        update(t, { weekStart: null, pinnedDay: null, gcalDirty: t.gcalEventId ? true : t.gcalDirty }),
      /** Pin to a day (also plans it into that day's week). null unpins but keeps it in the week. */
      pin: (t: Task, day: ISODate | null) =>
        update(
          t,
          day
            ? { pinnedDay: day, weekStart: weekStartOf(day), gcalDirty: true }
            : { pinnedDay: null, gcalDirty: t.gcalEventId ? true : t.gcalDirty },
        ),
      setWaiting: (t: Task, waitingOn: string, followUpDate: ISODate | null) =>
        update(t, { status: 'waiting', waitingOn, followUpDate }),
      snoozeFollowUp: (t: Task, date: ISODate) => update(t, snoozeFollowUp(t, date)),
      received: (t: Task) => update(t, receiveWaiting(t)),
      /** Hand the task to a person, to be followed up on `followUpDate`. */
      delegate: (t: Task, personId: string, followUpDate: ISODate | null) =>
        update(t, delegateTask(t, personId, followUpDate)),
      /** Make a delegated task yours again. */
      takeBack: (t: Task) => update(t, takeBackTask(t)),
    }),
    [update],
  )
}

/** Link to a task's detail: the project page (or Inbox) opens the task dialog from the `task` query param. */
export const taskHref = (t: Task): string =>
  t.projectId ? `/projects/${t.projectId}?task=${t.id}` : `/inbox?task=${t.id}`
