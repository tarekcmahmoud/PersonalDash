import type { Dependency, ID } from '../../domain/types'

/** One rail: a task (drawn as a dot) joined to the tasks in the same list that wait for it. */
export interface Rail {
  blockerId: ID
  dependentIds: ID[]
  /** Column in the gutter, 0 = leftmost. Rails whose rows overlap get different lanes. */
  lane: number
}

/** Horizontal space per lane, and the margin between the last lane and the rows, in px. */
export const LANE = 10
const EDGE = 10

export const railsWidth = (rails: Rail[]): number =>
  rails.length === 0 ? 0 : (Math.max(...rails.map((r) => r.lane)) + 1) * LANE + EDGE

/**
 * Rails for the links between tasks of one list (`order` = the rows top to bottom). Links to tasks outside the
 * list are left out. Lanes are assigned greedily by span, so rails that don't overlap share a lane, and so do
 * the links of a chain (a → b → c).
 */
export function railLanes(order: ID[], dependencies: Dependency[]): Rail[] {
  const index = new Map(order.map((id, i) => [id, i]))
  const byBlocker = new Map<ID, ID[]>()
  for (const d of dependencies) {
    if (!index.has(d.taskId) || !index.has(d.blockedByTaskId) || d.taskId === d.blockedByTaskId) continue
    const list = byBlocker.get(d.blockedByTaskId) ?? []
    if (!list.includes(d.taskId)) list.push(d.taskId)
    byBlocker.set(d.blockedByTaskId, list)
  }
  const spans = [...byBlocker].map(([blockerId, dependentIds]) => {
    const rows = [blockerId, ...dependentIds].map((id) => index.get(id)!)
    return {
      blockerId,
      dependentIds: dependentIds.sort((a, b) => index.get(a)! - index.get(b)!),
      top: Math.min(...rows),
      bottom: Math.max(...rows),
    }
  })
  spans.sort((a, b) => a.top - b.top || a.bottom - b.bottom)
  const laneEnds: { bottom: number; bottomId: ID }[] = []
  return spans.map(({ blockerId, dependentIds, top, bottom }) => {
    // A lane is free below its last row. A chain (this rail starts at the row where the lane's last rail ended,
    // with this rail's dot) carries on in the same lane, like a git graph.
    const chains = (end: { bottom: number; bottomId: ID }) =>
      end.bottom === top && end.bottomId === blockerId && index.get(blockerId) === top
    let lane = laneEnds.findIndex((end) => end.bottom < top || chains(end))
    if (lane === -1) lane = laneEnds.length
    laneEnds[lane] = { bottom, bottomId: order[bottom]! }
    return { blockerId, dependentIds, lane }
  })
}
