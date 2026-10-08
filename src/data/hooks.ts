import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { PlanContext } from '../domain/context'
import type { ISODate, Resource, Snapshot, Task } from '../domain/types'
import { todayISO, weekStartOf } from '../domain/week'
import { useCalendarEvents } from '../integrations/gcal/useCalendarEvents'
import { applyChange, type Change } from './changes'
import { useServices } from './services'

export const SNAPSHOT_KEY = ['snapshot'] as const

/** The whole user dataset. */
export function useSnapshot(): UseQueryResult<Snapshot> {
  const { repo } = useServices()
  return useQuery({ queryKey: SNAPSHOT_KEY, queryFn: () => repo.loadSnapshot(), staleTime: 30_000 })
}

/**
 * Apply a Change: optimistic update of the cached snapshot, then persist.
 * On failure the cache is rolled back and the promise rejects.
 */
export function useApply(): (change: Change) => Promise<void> {
  const { repo } = useServices()
  const qc = useQueryClient()
  const m = useMutation({
    mutationFn: (change: Change) => repo.apply(change),
    onMutate: async (change) => {
      await qc.cancelQueries({ queryKey: SNAPSHOT_KEY })
      const prev = qc.getQueryData<Snapshot>(SNAPSHOT_KEY)
      if (prev) qc.setQueryData<Snapshot>(SNAPSHOT_KEY, applyChange(prev, change))
      return { prev }
    },
    onError: (_err, _change, ctx) => {
      if (ctx?.prev) qc.setQueryData(SNAPSHOT_KEY, ctx.prev)
    },
  })
  const { mutateAsync } = m
  return useCallback((change: Change) => mutateAsync(change), [mutateAsync])
}

/** Patch one or more tasks in a single write. */
export function useUpdateTasks(): (updates: { task: Task; patch: Partial<Task> }[]) => Promise<void> {
  const apply = useApply()
  return useCallback(
    (updates) =>
      apply({ kind: 'saveTasks', tasks: updates.map(({ task, patch }) => ({ ...task, ...patch })) }),
    [apply],
  )
}

export function useUpdateTask(): (task: Task, patch: Partial<Task>) => Promise<void> {
  const updateTasks = useUpdateTasks()
  return useCallback((task, patch) => updateTasks([{ task, patch }]), [updateTasks])
}

/** Today's date; refreshes when the window regains focus (e.g. phone left open overnight). */
export function useToday(): ISODate {
  const [today, setToday] = useState(todayISO())
  useEffect(() => {
    const onFocus = () => setToday(todayISO())
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onFocus)
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onFocus)
    }
  }, [])
  return today
}

/** Snapshot + week + today + calendar events, for the domain computations. null while loading. */
export function usePlanContext(weekStart?: ISODate): PlanContext | null {
  const { data } = useSnapshot()
  const today = useToday()
  const ws = weekStart ?? weekStartOf(today)
  const events = useCalendarEvents(ws)
  return useMemo(() => (data ? { ...data, weekStart: ws, today, events } : null), [data, ws, today, events])
}

/**
 * A displayable src for a resource image: the uploaded image (resolved through the Repo, cached ~50 min since
 * signed URLs expire) or the pasted link. null while resolving or when there is no image.
 */
export function useImageSrc(resource: Pick<Resource, 'imagePath' | 'imageUrl'>): string | null {
  const { repo } = useServices()
  const path = resource.imagePath
  const { data } = useQuery({
    queryKey: ['image', path],
    queryFn: () => repo.imageUrl(path!),
    enabled: !!path,
    staleTime: 50 * 60_000,
  })
  return path ? (data ?? null) : resource.imageUrl
}
