import { useLayoutEffect, useState } from 'react'
import type { ID } from '../../domain/types'
import { LANE, railsWidth, type Rail } from './links'

/**
 * Draws `rails` in the left gutter of `container`: a grey line per rail, a dot at the task others wait for, and a
 * short branch into each task that waits for it. Rows are found by `data-task-id`; their checkbox (or the row's
 * first line) sets the height of each branch. Redraws when the rows move or resize.
 */
export function LinkRails({ container, rails }: { container: HTMLElement | null; rails: Rail[] }) {
  const [rows, setRows] = useState<{ ys: Map<ID, number>; height: number }>({ ys: new Map(), height: 0 })
  const width = railsWidth(rails)

  // Rows move when the list changes (reorder, notes, edits) or wraps differently: observers re-measure, and
  // state only changes when a position does. ResizeObserver also reports once right after observe().
  useLayoutEffect(() => {
    const el = container
    if (!el || typeof ResizeObserver === 'undefined') return
    const measure = () => {
      const top = el.getBoundingClientRect().top
      const ys = new Map<ID, number>()
      for (const row of el.querySelectorAll<HTMLElement>('[data-task-id]')) {
        const anchor = row.querySelector('label') ?? row
        const box = anchor.getBoundingClientRect()
        const y = box.height > 0 ? box.top - top + box.height / 2 : row.getBoundingClientRect().top - top + 20
        ys.set(row.dataset.taskId!, Math.round(y))
      }
      const height = Math.round(el.getBoundingClientRect().height)
      setRows((prev) =>
        prev.height === height &&
        prev.ys.size === ys.size &&
        [...ys].every(([id, y]) => prev.ys.get(id) === y)
          ? prev
          : { ys, height },
      )
    }
    const resize = new ResizeObserver(measure)
    resize.observe(el)
    const mutation = new MutationObserver(measure)
    mutation.observe(el, { childList: true, subtree: true, characterData: true })
    return () => {
      resize.disconnect()
      mutation.disconnect()
    }
  }, [container])

  if (rails.length === 0 || rows.height === 0) return null
  const end = width - 3
  const r = 4 // corner radius
  return (
    <svg
      aria-hidden
      data-testid="link-rails"
      width={width}
      height={rows.height}
      className="pointer-events-none absolute top-0 left-0 text-muted-foreground/50"
    >
      {rails.map(({ blockerId, dependentIds, lane }) => {
        const x = 4 + lane * LANE
        const from = rows.ys.get(blockerId)
        const tos = dependentIds.map((id) => rows.ys.get(id)).filter((y): y is number => y !== undefined)
        if (from === undefined || tos.length === 0) return null
        const ys = [from, ...tos]
        const top = Math.min(...ys)
        const bottom = Math.max(...ys)
        // Each row joins the vertical line with a rounded corner (up at the top row, down at the bottom one).
        const branch = (y: number) => {
          const dir = y === top ? 1 : y === bottom ? -1 : 0
          return dir === 0
            ? `M ${x} ${y} H ${end}`
            : `M ${end} ${y} H ${x + r} Q ${x} ${y} ${x} ${y + dir * r}`
        }
        return (
          <g key={blockerId} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
            <path d={`M ${x} ${top + r} V ${bottom - r}`} />
            {ys.map((y, i) => (
              <path key={i} d={branch(y)} />
            ))}
            <circle cx={end} cy={from} r={3} fill="currentColor" stroke="none" />
          </g>
        )
      })}
    </svg>
  )
}
