import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { useState } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { makeChecklistItem } from '../../domain/factories'
import type { ChecklistItem, ID } from '../../domain/types'
import { RowMenu } from '../project/RowMenu'

/** Add, toggle, rename, delete and reorder checklist items. Fully controlled; the dialog saves them. */
export function ChecklistEditor({
  taskId,
  items,
  onChange,
}: {
  taskId: ID
  items: ChecklistItem[]
  onChange: (items: ChecklistItem[]) => void
}) {
  const [text, setText] = useState('')

  const patch = (id: ID, p: Partial<ChecklistItem>) =>
    onChange(items.map((i) => (i.id === id ? { ...i, ...p } : i)))
  const move = (index: number, delta: -1 | 1) => {
    const next = [...items]
    const [item] = next.splice(index, 1)
    next.splice(index + delta, 0, item!)
    onChange(next)
  }
  const add = () => {
    const t = text.trim()
    if (!t) return
    onChange([...items, makeChecklistItem({ taskId, text: t, position: items.length })])
    setText('')
  }

  return (
    <div className="grid gap-1">
      {items.map((item, index) => (
        <div key={item.id} className="group flex items-center gap-2">
          <label className="-ml-1 flex size-8 shrink-0 cursor-pointer items-center justify-center">
            <Checkbox
              checked={item.done}
              onCheckedChange={() => patch(item.id, { done: !item.done })}
              aria-label={`Done: ${item.text}`}
            />
          </label>
          <Input
            value={item.text}
            aria-label={`Checklist item ${index + 1}`}
            className="h-8 border-transparent bg-transparent px-2 shadow-none hover:border-input focus-visible:border-ring dark:bg-transparent"
            onChange={(e) => patch(item.id, { text: e.target.value })}
          />
          <RowMenu
            label={`Checklist item actions: ${item.text}`}
            controls={{
              isFirst: index === 0,
              isLast: index === items.length - 1,
              move: (delta) => move(index, delta),
            }}
            extra={
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => onChange(items.filter((i) => i.id !== item.id))}
              >
                Delete item
              </DropdownMenuItem>
            }
          />
        </div>
      ))}
      <Input
        value={text}
        placeholder="Add a checklist item, then Enter"
        aria-label="New checklist item"
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            add()
          }
        }}
      />
    </div>
  )
}
