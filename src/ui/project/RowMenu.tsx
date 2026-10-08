import { MoreHorizontal } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import type { SortableControls } from './SortableList'

/**
 * A row's `…` menu: optional Move up / Move down (the phone and keyboard way to reorder) plus any extra
 * items (rename, delete, …). `extra` is rendered after a separator.
 */
export function RowMenu({
  label,
  controls,
  extra,
  className,
}: {
  /** Accessible name of the trigger, e.g. "Task actions: Draft sitemap". */
  label: string
  controls?: Pick<SortableControls, 'isFirst' | 'isLast' | 'move'>
  extra?: ReactNode
  className?: string
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={label}
          className={cn('shrink-0 text-muted-foreground', className)}
        >
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {controls && (
          <>
            <DropdownMenuItem disabled={controls.isFirst} onSelect={() => controls.move(-1)}>
              Move up
            </DropdownMenuItem>
            <DropdownMenuItem disabled={controls.isLast} onSelect={() => controls.move(1)}>
              Move down
            </DropdownMenuItem>
          </>
        )}
        {controls && extra && <DropdownMenuSeparator />}
        {extra}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
