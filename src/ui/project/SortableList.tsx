import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'
import { useId, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { useInTaskDnd } from './taskDndContext'
import { cn } from '@/lib/utils'

/** What a sortable row gets to render: the drag handle and the state/actions for Move up / Move down menus. */
export interface SortableControls {
  /** Drag handle (pointer drag, or focus + Space + arrows). Hidden on phones, where menus move rows. */
  handle: ReactNode
  isFirst: boolean
  isLast: boolean
  move: (delta: -1 | 1) => void
}

interface SortableListProps<T extends { id: string }> {
  items: T[]
  /** Called with the full list in its new order. */
  onReorder: (items: T[]) => void
  /** Accessible name of an item, used in the handle label. */
  label: (item: T) => string
  renderItem: (item: T, controls: SortableControls) => ReactNode
  className?: string
  /** 'grid' for 2-D layouts (e.g. a masonry of cards); default 'vertical'. */
  layout?: 'vertical' | 'grid'
  /** Wraps the rendered items (default: a div with `className`). Use it to lay items out, e.g. MasonryGrid. */
  container?: (items: ReactNode[]) => ReactNode
  /**
   * Inside a TaskDndProvider: this list's id. Rows then join the provider's drag area (so they can be dropped
   * into other lists) and the provider handles drops; `onReorder` is still used by Move up / Move down.
   */
  list?: string
}

/** Sortable list or grid: drag handle (pointer + keyboard) plus `move` for "Move up/down" menu items. */
export function SortableList<T extends { id: string }>({
  items,
  onReorder,
  label,
  renderItem,
  className,
  layout = 'vertical',
  container,
  list,
}: SortableListProps<T>) {
  const dndId = useId()
  const shared = useInTaskDnd() && list !== undefined
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const move = (from: number, to: number) => {
    if (from === to || to < 0 || to >= items.length) return
    onReorder(arrayMove(items, from, to))
  }

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    move(
      items.findIndex((i) => i.id === active.id),
      items.findIndex((i) => i.id === over.id),
    )
  }

  const sortable = (
    <SortableContext
      items={items.map((i) => i.id)}
      strategy={layout === 'grid' ? rectSortingStrategy : verticalListSortingStrategy}
    >
      {(container ?? ((rows) => <div className={className}>{rows}</div>))(
        items.map((item, index) => (
          <SortableRow
            key={item.id}
            id={item.id}
            list={shared ? list : undefined}
            name={label(item)}
            isFirst={index === 0}
            isLast={index === items.length - 1}
            onMove={(delta) => move(index, index + delta)}
          >
            {(controls) => renderItem(item, controls)}
          </SortableRow>
        )),
      )}
    </SortableContext>
  )
  if (shared) return sortable
  return (
    <DndContext id={dndId} sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      {sortable}
    </DndContext>
  )
}

function SortableRow({
  id,
  list,
  name,
  isFirst,
  isLast,
  onMove,
  children,
}: {
  id: string
  /** Set in a shared TaskDndProvider area: the row's list. */
  list?: string
  name: string
  isFirst: boolean
  isLast: boolean
  onMove: (delta: -1 | 1) => void
  children: (controls: SortableControls) => ReactNode
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
    active,
  } = useSortable({ id, data: list === undefined ? undefined : { list } })
  // A task from another list dragged over this row lands just above it: show a line there.
  const dropAbove = list !== undefined && isOver && active?.data.current?.list !== list

  const handle = (
    <Button
      ref={setActivatorNodeRef}
      {...attributes}
      {...listeners}
      type="button"
      variant="ghost"
      size="icon-xs"
      aria-label={`Drag to reorder: ${name}`}
      className="hidden shrink-0 cursor-grab touch-none text-muted-foreground active:cursor-grabbing md:inline-flex"
    >
      <GripVertical />
    </Button>
  )

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'relative',
        isDragging && 'z-10 bg-card opacity-90 shadow-sm',
        dropAbove &&
          'before:absolute before:inset-x-0 before:-top-px before:h-0.5 before:rounded-full before:bg-foreground/30',
      )}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      {children({ handle, isFirst, isLast, move: onMove })}
    </div>
  )
}
