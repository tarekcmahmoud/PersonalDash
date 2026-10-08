import type { HealthFlag } from '../../domain/health'
import { cn } from '@/lib/utils'
import { topSignal } from './format'

/** One quiet signal: a small coloured dot + text for attention, plain grey text otherwise. */
export function ProjectSignal({ flags, className }: { flags: HealthFlag[]; className?: string }) {
  const signal = topSignal(flags)
  if (!signal) return null
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-xs whitespace-nowrap',
        signal.tone === 'danger' && 'text-destructive',
        signal.tone === 'warning' && 'text-warning',
        signal.tone === 'muted' && 'text-muted-foreground',
        className,
      )}
    >
      {signal.tone !== 'muted' && <span aria-hidden className="size-1.5 rounded-full bg-current" />}
      {signal.text}
    </span>
  )
}

/** @deprecated Use ProjectSignal — kept so unmigrated screens compile. Shows the single top signal. */
export function HealthBadges(props: { flags: HealthFlag[]; className?: string }) {
  return <ProjectSignal {...props} />
}
