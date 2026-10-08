import type { TaskSize } from '../../domain/types'
import { cn } from '@/lib/utils'

const TITLES: Record<TaskSize, string> = {
  S: '≈1h',
  M: '≈half day',
  L: '≈full day',
  XL: 'Too big or unclear — split before scheduling',
}

/** Task size as quiet grey text. XL is the only one that draws attention (it can't be planned). */
export function SizeLabel({ size, className }: { size: TaskSize; className?: string }) {
  return (
    <span
      title={TITLES[size]}
      className={cn(
        'tabular-nums',
        size === 'XL' ? 'font-medium text-warning' : 'text-muted-foreground',
        className,
      )}
    >
      {size === 'XL' ? 'XL · split' : size}
    </span>
  )
}
