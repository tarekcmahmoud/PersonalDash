import { Plus } from 'lucide-react'
import { useState, type KeyboardEvent, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { TaskSize } from '../../domain/types'

/**
 * Ghost "+ Add task" row that turns into an inline input: Enter adds (size M) and keeps the input open for
 * the next one, Escape (or leaving it empty) closes it. `extra` (e.g. "+ Add substream") sits next to the button
 * and is hidden while typing.
 */
export function AddTaskRow({
  groupName,
  onAdd,
  extra,
}: {
  groupName: string
  onAdd: (title: string, size: TaskSize) => void
  extra?: ReactNode
}) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState('')

  const close = () => {
    setTitle('')
    setEditing(false)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      close()
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const t = title.trim()
      if (!t) return
      onAdd(t, 'M')
      setTitle('')
    }
  }

  if (!editing) {
    return (
      <div className="flex flex-wrap items-center gap-x-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label={`Add task to ${groupName}`}
          className="-ml-2 h-8 justify-start px-2 font-normal text-muted-foreground"
          onClick={() => setEditing(true)}
        >
          <Plus /> Add task
        </Button>
        {extra}
      </div>
    )
  }

  return (
    <Input
      autoFocus
      value={title}
      aria-label={`New task in ${groupName}`}
      placeholder="Task title, then Enter"
      className="h-9"
      onChange={(e) => setTitle(e.target.value)}
      onKeyDown={onKeyDown}
      onBlur={() => {
        if (!title.trim()) close()
      }}
    />
  )
}
