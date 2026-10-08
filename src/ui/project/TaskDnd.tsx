import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  pointerWithin,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { useId, useState, type ReactNode } from 'react'
import type { Task } from '../../domain/types'
import { CONTAINER_PREFIX, TaskDndContext, type TaskDrop } from './taskDndContext'

// Prefer the task row under the pointer, then the innermost list under it (a substream card sits inside its
// workstream card); keyboard dragging has no pointer, so it falls back to the closest row.
const collision: CollisionDetection = (args) => {
  const within = pointerWithin(args)
  const rows = within.filter((c) => !String(c.id).startsWith(CONTAINER_PREFIX))
  if (rows.length > 0) return rows
  if (within.length > 0) {
    const area = (id: string | number) => {
      const r = args.droppableRects.get(id)
      return r ? r.width * r.height : Infinity
    }
    return [...within].sort((a, b) => area(a.id) - area(b.id))
  }
  return closestCenter(args)
}

const listOf = (data: unknown): string | undefined =>
  (data as { current?: { list?: string } } | undefined)?.current?.list

/**
 * One drag-and-drop area for every task list of a project page, so a task can be dragged within its list or
 * into another one (a substream, its workstream, another workstream). Lists are SortableLists with `list` set
 * plus a `useTaskDropList` target. `onDrop` gets every drop, including reorders within one list.
 */
export function TaskDndProvider({
  tasks,
  onDrop,
  children,
}: {
  tasks: Task[]
  onDrop: (drop: TaskDrop) => void
  children: ReactNode
}) {
  const dndId = useId()
  const [dragging, setDragging] = useState<{ task: Task; list: string } | null>(null)
  const [targetList, setTargetList] = useState<string | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const reset = () => {
    setDragging(null)
    setTargetList(null)
  }

  const onDragStart = ({ active }: DragStartEvent) => {
    const task = tasks.find((t) => t.id === active.id)
    const list = listOf(active.data)
    if (task && list) setDragging({ task, list })
  }

  const onDragOver = ({ active, over }: DragOverEvent) => {
    const to = over ? listOf(over.data) : undefined
    setTargetList(to && to !== listOf(active.data) ? to : null)
  }

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    reset()
    const from = listOf(active.data)
    const to = over ? listOf(over.data) : undefined
    if (!from || !to || !over || over.id === active.id) return
    const beforeId = String(over.id).startsWith(CONTAINER_PREFIX) ? null : String(over.id)
    onDrop({ taskId: String(active.id), from, to, beforeId })
  }

  return (
    <TaskDndContext.Provider value={{ targetList }}>
      <DndContext
        id={dndId}
        sensors={sensors}
        collisionDetection={collision}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={reset}
      >
        {children}
        <DragOverlay dropAnimation={null}>
          {dragging && (
            <div className="flex size-full items-center truncate rounded-xl bg-popover px-3 text-sm shadow-lg ring-1 ring-foreground/10">
              {dragging.task.title}
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </TaskDndContext.Provider>
  )
}
