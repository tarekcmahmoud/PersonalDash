import { describe, expect, it } from 'vitest'
import { railLanes, railsWidth } from './links'

const dep = (taskId: string, blockedByTaskId: string) => ({ taskId, blockedByTaskId })

describe('railLanes', () => {
  it('makes one rail per task that others in the list wait for, dependents in row order', () => {
    const rails = railLanes(['a', 'b', 'c', 'd'], [dep('d', 'a'), dep('c', 'a')])
    expect(rails).toEqual([{ blockerId: 'a', dependentIds: ['c', 'd'], lane: 0 }])
  })

  it('leaves out links to tasks outside the list', () => {
    expect(railLanes(['a', 'b'], [dep('b', 'elsewhere'), dep('elsewhere', 'a')])).toEqual([])
    expect(railsWidth([])).toBe(0)
  })

  it('gives overlapping rails different lanes and reuses lanes that are free again', () => {
    // a→c overlaps b→d; e→f starts below both and can reuse lane 0.
    const rails = railLanes(['a', 'b', 'c', 'd', 'e', 'f'], [dep('c', 'a'), dep('d', 'b'), dep('f', 'e')])
    expect(rails.map((r) => [r.blockerId, r.lane])).toEqual([
      ['a', 0],
      ['b', 1],
      ['e', 0],
    ])
    expect(railsWidth(rails)).toBe(30)
  })

  it('keeps a chain in one lane, but not a task that waits for two others', () => {
    const chain = railLanes(['a', 'b', 'c'], [dep('b', 'a'), dep('c', 'b')])
    expect(chain.map((r) => [r.blockerId, r.lane])).toEqual([
      ['a', 0],
      ['b', 0],
    ])
    // b waits for a and for c (listed below it): two rails meeting at b, not a chain.
    const merge = railLanes(['a', 'b', 'c'], [dep('b', 'a'), dep('b', 'c')])
    expect(merge.map((r) => r.lane)).toEqual([0, 1])
  })

  it('handles a blocker listed below the task that waits for it', () => {
    expect(railLanes(['a', 'b'], [dep('a', 'b')])).toEqual([{ blockerId: 'b', dependentIds: ['a'], lane: 0 }])
  })
})
