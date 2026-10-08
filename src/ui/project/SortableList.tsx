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
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ChevronDownIcon, ChevronUpIcon, GrabberIcon } from '@primer/octicons-react'
import { IconButton } from '@primer/react'
import { useId, type ReactNode } from 'react'
import styles from './SortableList.module.css'

interface SortableListProps<T extends { id: string }> {
  items: T[]
  /** Called with the full list in its new order. */
  onReorder: (items: T[]) => void
  /** Accessible name of an item, used in the button labels. */
  label: (item: T) => string
  /** `controls` = drag handle + up/down buttons; put it wherever the row wants them. */
  renderItem: (item: T, controls: ReactNode) => ReactNode
}

/**
 * Vertical sortable list. Reordering works by pointer drag, keyboard (focus the handle, Space, arrows) and
 * up/down buttons (the buttons are the touch fallback and hidden on wide screens).
 */
export function SortableList<T extends { id: string }>({
  items,
  onReorder,
  label,
  renderItem,
}: SortableListProps<T>) {
  const dndId = useId()
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

  return (
    <DndContext id={dndId} sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        {items.map((item, index) => (
          <SortableRow
            key={item.id}
            id={item.id}
            name={label(item)}
            isFirst={index === 0}
            isLast={index === items.length - 1}
            onMove={(delta) => move(index, index + delta)}
          >
            {(controls) => renderItem(item, controls)}
          </SortableRow>
        ))}
      </SortableContext>
    </DndContext>
  )
}

function SortableRow({
  id,
  name,
  isFirst,
  isLast,
  onMove,
  children,
}: {
  id: string
  name: string
  isFirst: boolean
  isLast: boolean
  onMove: (delta: -1 | 1) => void
  children: (controls: ReactNode) => ReactNode
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id })

  const controls = (
    <span className={styles.controls}>
      <IconButton
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        className={styles.handle}
        icon={GrabberIcon}
        variant="invisible"
        aria-label={`Drag to reorder: ${name}`}
      />
      <IconButton
        className={styles.arrow}
        icon={ChevronUpIcon}
        variant="invisible"
        aria-label={`Move up: ${name}`}
        disabled={isFirst}
        onClick={() => onMove(-1)}
      />
      <IconButton
        className={styles.arrow}
        icon={ChevronDownIcon}
        variant="invisible"
        aria-label={`Move down: ${name}`}
        disabled={isLast}
        onClick={() => onMove(1)}
      />
    </span>
  )

  return (
    <div
      ref={setNodeRef}
      className={isDragging ? `${styles.item} ${styles.dragging}` : styles.item}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      {children(controls)}
    </div>
  )
}
