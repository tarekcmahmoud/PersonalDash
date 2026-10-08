import { useDroppable } from '@dnd-kit/core'
import { createContext, useContext } from 'react'
import type { ID } from '../../domain/types'

/** A task list's id for drag and drop: its milestone id, or NO_GROUP for the project's workstream-less tasks. */
export const NO_GROUP = 'no-workstream'
export const CONTAINER_PREFIX = 'list:'

/** What a drop means: move `taskId` from list `from` to list `to`, before `beforeId` (null = at the end). */
export interface TaskDrop {
  taskId: ID
  from: string
  to: string
  beforeId: ID | null
}

interface DndState {
  /** The list being dragged over, when it isn't the dragged task's own list. */
  targetList: string | null
}

export const TaskDndContext = createContext<DndState | null>(null)

/**
 * Makes an element (a workstream or substream card) a drop target for its list: dropping on it, rather than on a
 * row, puts the task at the end. `isTarget` is true while another list's task is dragged over it. Outside a
 * TaskDndProvider it does nothing.
 */
export function useTaskDropList(list: string): {
  setNodeRef: (el: HTMLElement | null) => void
  isTarget: boolean
} {
  const state = useContext(TaskDndContext)
  const { setNodeRef } = useDroppable({ id: `${CONTAINER_PREFIX}${list}`, data: { list }, disabled: !state })
  return { setNodeRef, isTarget: state?.targetList === list }
}

/** True inside a TaskDndProvider (lists then share its DndContext instead of creating their own). */
export function useInTaskDnd(): boolean {
  return useContext(TaskDndContext) !== null
}
