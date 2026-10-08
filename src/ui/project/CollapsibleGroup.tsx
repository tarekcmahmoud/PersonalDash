import { ChevronRight } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'

/**
 * A quiet, collapsed-by-default group: a grey toggle line ("On hold 2", "3 done") that reveals its content.
 * Use `heading` for a card-title-style toggle, otherwise it is a plain small grey line.
 */
export function CollapsibleGroup({
  label,
  count,
  heading,
  defaultOpen = false,
  className,
  children,
}: {
  label: string
  count?: number
  heading?: boolean
  defaultOpen?: boolean
  className?: string
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <Collapsible open={open} onOpenChange={setOpen} className={className}>
      <CollapsibleTrigger
        className={cn(
          '-ml-1 flex min-h-8 cursor-pointer items-center gap-1 rounded-sm px-1 text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50',
          heading ? 'text-base font-medium text-foreground' : 'text-sm',
        )}
      >
        <ChevronRight
          aria-hidden
          className={cn('size-3.5 shrink-0 transition-transform', open && 'rotate-90')}
        />
        <span>{label}</span>
        {count !== undefined && (
          <>
            {' '}
            <span className="ml-0.5 text-muted-foreground/60">{count}</span>
          </>
        )}
      </CollapsibleTrigger>
      <CollapsibleContent>{children}</CollapsibleContent>
    </Collapsible>
  )
}
