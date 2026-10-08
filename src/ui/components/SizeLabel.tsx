import { Label } from '@primer/react'
import type { TaskSize } from '../../domain/types'

const SIZE_TITLE: Record<TaskSize, string> = {
  S: '≈1h',
  M: '≈half day',
  L: '≈full day',
  XL: 'Too big or unclear — split before scheduling',
}

/** Task size chip. XL means "too big or unclear" and must be split before it can be scheduled. */
export function SizeLabel({ size }: { size: TaskSize }) {
  if (size === 'XL') {
    return (
      <Label variant="attention" title={SIZE_TITLE.XL}>
        XL · split
      </Label>
    )
  }
  return (
    <Label variant="secondary" title={SIZE_TITLE[size]}>
      {size}
    </Label>
  )
}
