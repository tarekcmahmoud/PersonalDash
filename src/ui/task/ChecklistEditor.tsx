import { ChevronDownIcon, ChevronUpIcon, TrashIcon } from '@primer/octicons-react'
import { Checkbox, IconButton, TextInput } from '@primer/react'
import { useState } from 'react'
import { makeChecklistItem } from '../../domain/factories'
import type { ChecklistItem, ID } from '../../domain/types'
import styles from './TaskDialog.module.css'

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
    <div className={styles.checklist}>
      {items.map((item, index) => (
        <div key={item.id} className={styles.checkItem}>
          <label className={styles.checkBox}>
            <Checkbox
              checked={item.done}
              onChange={() => patch(item.id, { done: !item.done })}
              aria-label={`Done: ${item.text}`}
            />
          </label>
          <TextInput
            className={styles.checkText}
            block
            value={item.text}
            aria-label={`Checklist item ${index + 1}`}
            onChange={(e) => patch(item.id, { text: e.target.value })}
          />
          <IconButton
            icon={ChevronUpIcon}
            variant="invisible"
            aria-label={`Move up: ${item.text}`}
            disabled={index === 0}
            onClick={() => move(index, -1)}
          />
          <IconButton
            icon={ChevronDownIcon}
            variant="invisible"
            aria-label={`Move down: ${item.text}`}
            disabled={index === items.length - 1}
            onClick={() => move(index, 1)}
          />
          <IconButton
            icon={TrashIcon}
            variant="invisible"
            aria-label={`Delete: ${item.text}`}
            onClick={() => onChange(items.filter((i) => i.id !== item.id))}
          />
        </div>
      ))}
      <TextInput
        block
        value={text}
        placeholder="Add a checklist item and press Enter"
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
