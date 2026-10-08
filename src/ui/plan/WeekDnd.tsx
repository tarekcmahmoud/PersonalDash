import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  pointerWithin,
  rectIntersection,
  useDraggable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { format, parseISO } from 'date-fns'
import { GripVertical } from 'lucide-react'
import { useId, useState, type PointerEventHandler, type ReactNode, type TouchEventHandler } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useTaskActions } from '../../data/taskActions'
import type { Task } from '../../domain/types'

// Prefer the column under the pointer; fall back to overlap (keyboard dragging has no pointer).
const collision: CollisionDetection = (args) => {
  const hits = pointerWithin(args)
  return hits.length > 0 ? hits : rectIntersection(args)
}

/**
 * Drag-and-drop for the week board: drop a task on a day column to pin it to that day, or on "Any day" to
 * keep it in the week without a day. Mouse: drag after moving 6px (so clicks still work). Touch: press and
 * hold, then drag (so the page still scrolls). Keyboard: focus a task's handle, Space, arrows, Space.
 */
export function WeekDndProvider({
  tasks,
  projectNames,
  children,
}: {
  tasks: Task[]
  projectNames: Map<string, string>
  children: ReactNode
}) {
  const actions = useTaskActions()
  const dndId = useId()
  const [dragging, setDragging] = useState<Task | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  )

  const onDragStart = ({ active }: DragStartEvent) =>
    setDragging(tasks.find((t) => t.id === active.id) ?? null)

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setDragging(null)
    const task = tasks.find((t) => t.id === active.id)
    if (!task || !over) return
    const target = over.id === 'any' ? null : String(over.id)
    if ((task.pinnedDay ?? null) === target) return
    void actions.pin(task, target)
  }

  return (
    <DndContext
      id={dndId}
      sensors={sensors}
      collisionDetection={collision}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setDragging(null)}
      accessibility={{
        announcements: {
          onDragStart: ({ active }) => `Picked up ${titleOf(tasks, active.id)}.`,
          onDragOver: ({ over }) => (over ? `Over ${labelOf(String(over.id))}.` : 'Not over a day.'),
          onDragEnd: ({ active, over }) =>
            over ? `Moved ${titleOf(tasks, active.id)} to ${labelOf(String(over.id))}.` : 'Move cancelled.',
          onDragCancel: () => 'Move cancelled.',
        },
      }}
    >
      {children}
      <DragOverlay dropAnimation={null}>
        {dragging && (
          <div className="w-56 rounded-xl bg-popover px-3 py-2 text-sm shadow-lg ring-1 ring-foreground/10">
            <div className="truncate">{dragging.title}</div>
            <div className="truncate text-xs text-muted-foreground">
              {dragging.projectId ? (projectNames.get(dragging.projectId) ?? '') : 'Inbox'}
            </div>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}

const titleOf = (tasks: Task[], id: string | number) => tasks.find((t) => t.id === id)?.title ?? 'task'
const labelOf = (id: string) => (id === 'any' ? 'any day' : format(parseISO(id), 'EEEE MMMM d'))

/**
 * Wraps a task row so it can be dragged. The whole row starts a mouse/touch drag; keyboard users get a
 * grip handle (shown on hover/focus, like the other row actions) to pick it up with Space.
 */
export function DraggableTask({
  task,
  children,
}: {
  task: Task
  children: (handle: ReactNode) => ReactNode
}) {
  const { setNodeRef, setActivatorNodeRef, listeners, attributes, isDragging } = useDraggable({
    id: task.id,
  })
  // Keyboard activation only from the handle, so Space on the checkbox still ticks it.
  const pointerListeners = {
    onPointerDown: listeners?.onPointerDown as PointerEventHandler<HTMLDivElement> | undefined,
    onTouchStart: listeners?.onTouchStart as TouchEventHandler<HTMLDivElement> | undefined,
  }

  const handle = (
    <Button
      ref={setActivatorNodeRef}
      {...attributes}
      {...listeners}
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={`Drag "${task.title}" to another day`}
      className="hidden size-7 cursor-grab text-muted-foreground active:cursor-grabbing md:inline-flex"
    >
      <GripVertical />
    </Button>
  )

  return (
    <div
      ref={setNodeRef}
      {...pointerListeners}
      data-dragging={isDragging ? '' : undefined}
      className={cn('cursor-grab active:cursor-grabbing', isDragging && 'opacity-40')}
    >
      {children(handle)}
    </div>
  )
}
