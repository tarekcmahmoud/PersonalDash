import { useCallback } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import type { Task } from '../../domain/types'

/** The `?task=<id>` query param other screens link to (see taskHref): which task dialog is open. */
export function useTaskParam(): { taskId: string | null; open: (id: string) => void; close: () => void } {
  const [params, setParams] = useSearchParams()
  const open = useCallback(
    (id: string) =>
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          next.set('task', id)
          return next
        },
        { replace: false },
      ),
    [setParams],
  )
  const close = useCallback(
    () =>
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          next.delete('task')
          return next
        },
        { replace: true },
      ),
    [setParams],
  )
  return { taskId: params.get('task'), open, close }
}

/**
 * A link that opens a task's dialog on the current screen: the current URL plus `?task=<id>` (other params,
 * such as the week, are kept). The screen must render a `TaskDialogHost`.
 */
export function useTaskLink(): (task: Pick<Task, 'id'>) => string {
  const { pathname, search } = useLocation()
  return useCallback(
    (task) => {
      const params = new URLSearchParams(search)
      params.set('task', task.id)
      return `${pathname}?${params}`
    },
    [pathname, search],
  )
}
