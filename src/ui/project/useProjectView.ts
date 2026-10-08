import { useCallback, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { ID } from '../../domain/types'

export type ProjectPane = 'workstreams' | 'resources'

/** Classes that grey a card out in focus mode; pair with `data-dimmed={dimmed}` on the card. */
export const DIMMED_CLASSES =
  'transition-[opacity,filter] duration-300 data-[dimmed=true]:opacity-40 data-[dimmed=true]:grayscale'

function useSetParam() {
  const [, setParams] = useSearchParams()
  return useCallback(
    (key: string, value: string | null) =>
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          if (value === null) next.delete(key)
          else next.set(key, value)
          return next
        },
        { replace: true },
      ),
    [setParams],
  )
}

/** Which pane the phone/tablet layout shows: `?pane=resources`, otherwise workstreams. */
export function useProjectPane(): [ProjectPane, (pane: ProjectPane) => void] {
  const [params] = useSearchParams()
  const setParam = useSetParam()
  const pane: ProjectPane = params.get('pane') === 'resources' ? 'resources' : 'workstreams'
  const setPane = useCallback(
    (next: ProjectPane) => setParam('pane', next === 'workstreams' ? null : next),
    [setParam],
  )
  return [pane, setPane]
}

/**
 * Workstream focus mode, kept in `?focus=<workstreamId>`. An id that is not one of `workstreamIds` is
 * ignored. While focused, Escape exits (unless a dialog, menu or text field has the key).
 */
export function useFocus(workstreamIds: ID[]): {
  focusId: ID | null
  setFocus: (id: ID) => void
  exitFocus: () => void
} {
  const [params] = useSearchParams()
  const setParam = useSetParam()
  const raw = params.get('focus')
  const focusId = raw && workstreamIds.includes(raw) ? raw : null
  const setFocus = useCallback((id: ID) => setParam('focus', id), [setParam])
  const exitFocus = useCallback(() => setParam('focus', null), [setParam])

  useEffect(() => {
    if (!focusId) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return
      const target = e.target as HTMLElement | null
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return
      if (document.querySelector('[role="dialog"], [role="alertdialog"], [role="menu"]')) return
      exitFocus()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [focusId, exitFocus])

  return { focusId, setFocus, exitFocus }
}

/** Whether a resource is greyed out for the current focus: project-wide ones stay in colour. */
export function resourceDimmed(workstreamIds: ID[], focusId: ID | null): boolean {
  return focusId !== null && workstreamIds.length > 0 && !workstreamIds.includes(focusId)
}
