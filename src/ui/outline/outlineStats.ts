import { format, parseISO } from 'date-fns'
import type { OutlineDoc, OutlineTask } from '../../domain/outline'
import type { ISODate } from '../../domain/types'

export function allOutlineTasks(doc: OutlineDoc): OutlineTask[] {
  return [...doc.tasks, ...doc.milestones.flatMap((m) => m.tasks)]
}

export interface OutlineStats {
  milestones: number
  tasks: number
  xl: number
  dependencies: number
}

export function outlineStats(doc: OutlineDoc): OutlineStats {
  const tasks = allOutlineTasks(doc)
  return {
    milestones: doc.milestones.length,
    tasks: tasks.length,
    xl: tasks.filter((t) => t.size === 'XL').length,
    dependencies: tasks.reduce((n, t) => n + t.after.length, 0),
  }
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

/** "4 workstreams · 23 tasks · 2 XL to split · 3 dependencies" (XL / dependencies are left out when zero). */
export function summaryText(stats: OutlineStats): string {
  const parts = [plural(stats.milestones, 'workstream'), plural(stats.tasks, 'task')]
  if (stats.xl > 0) parts.push(`${stats.xl} XL to split`)
  if (stats.dependencies > 0) parts.push(plural(stats.dependencies, 'dependency', 'dependencies'))
  return parts.join(' · ')
}

/** "Dec 15, 2026". */
export function formatDate(date: ISODate): string {
  return format(parseISO(date), 'MMM d, yyyy')
}

/** Character range [start, end) of the 1-based `line` in `text`. */
export function lineRange(text: string, line: number): [number, number] {
  let start = 0
  for (let i = 1; i < line; i++) {
    const nl = text.indexOf('\n', start)
    if (nl === -1) return [text.length, text.length]
    start = nl + 1
  }
  const nl = text.indexOf('\n', start)
  return [start, nl === -1 ? text.length : nl]
}
