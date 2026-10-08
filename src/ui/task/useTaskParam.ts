import { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'

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
