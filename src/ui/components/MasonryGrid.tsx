import { Children, isValidElement, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** Row unit of the underlying grid; items span as many units as their height needs. */
const ROW_UNIT = 4
/** Vertical gap between items, in px (matches the column gap, `gap-x-4`). */
const GAP = 16

/**
 * Masonry layout that keeps DOM (reading, tab and drag) order: a CSS grid with tiny auto rows where each
 * item spans enough rows for its measured height. Items flow left→right, then fill the shortest gaps.
 * Without ResizeObserver (tests) it degrades to a plain grid.
 */
export function MasonryGrid({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn('grid grid-cols-1 gap-x-4 md:grid-cols-2 xl:grid-cols-3', className)}
      style={{ gridAutoRows: `${ROW_UNIT}px` }}
    >
      {Children.map(children, (child) =>
        child == null || child === false ? null : (
          <MasonryItem key={isValidElement(child) ? (child.key ?? undefined) : undefined}>
            {child}
          </MasonryItem>
        ),
      )}
    </div>
  )
}

function MasonryItem({ children }: { children: ReactNode }) {
  const inner = useRef<HTMLDivElement>(null)
  const [span, setSpan] = useState<number | null>(null)

  useLayoutEffect(() => {
    const el = inner.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const update = () => setSpan(Math.ceil((el.getBoundingClientRect().height + GAP) / ROW_UNIT))
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <div style={span ? { gridRowEnd: `span ${span}` } : { marginBottom: GAP }}>
      <div ref={inner}>{children}</div>
    </div>
  )
}
