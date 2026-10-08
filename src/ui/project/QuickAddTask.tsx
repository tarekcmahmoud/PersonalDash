import { Button, Select, TextInput } from '@primer/react'
import { useState, type FormEvent } from 'react'
import type { TaskSize } from '../../domain/types'
import styles from './QuickAddTask.module.css'

/** Inline "add a task" row: title + size; Enter adds. */
export function QuickAddTask({
  groupName,
  onAdd,
}: {
  groupName: string
  onAdd: (title: string, size: TaskSize) => void
}) {
  const [title, setTitle] = useState('')
  const [size, setSize] = useState<TaskSize>('M')

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const t = title.trim()
    if (!t) return
    onAdd(t, size)
    setTitle('')
  }

  return (
    <form className={styles.form} onSubmit={submit}>
      <TextInput
        className={styles.title}
        block
        value={title}
        placeholder="Add a task and press Enter"
        aria-label={`New task in ${groupName}`}
        onChange={(e) => setTitle(e.target.value)}
      />
      <Select
        aria-label={`Size of new task in ${groupName}`}
        value={size}
        onChange={(e) => setSize(e.target.value as TaskSize)}
      >
        <Select.Option value="S">S</Select.Option>
        <Select.Option value="M">M</Select.Option>
        <Select.Option value="L">L</Select.Option>
        <Select.Option value="XL">XL</Select.Option>
      </Select>
      <Button type="submit" disabled={!title.trim()} aria-label={`Add task to ${groupName}`}>
        Add
      </Button>
    </form>
  )
}
