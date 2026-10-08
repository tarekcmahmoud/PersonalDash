import { describe, expect, it } from 'vitest'
import { makeTask } from '../../domain/factories'
import { moveIntoGroup, parseSubtasks, renumber, renumberGroup } from './ordering'

describe('parseSubtasks', () => {
  it('parses one subtask per line with an optional trailing size tag (default M)', () => {
    expect(parseSubtasks('Write outline [S]\n\n- Draft chapter [l]\nReview')).toEqual([
      { title: 'Write outline', size: 'S' },
      { title: 'Draft chapter', size: 'L' },
      { title: 'Review', size: 'M' },
    ])
  })

  it('does not treat [XL] or inner brackets as a size tag', () => {
    expect(parseSubtasks('Fix [bug] in parser [XL]')).toEqual([
      { title: 'Fix [bug] in parser [XL]', size: 'M' },
    ])
  })
})

describe('renumberGroup', () => {
  const a = makeTask({ title: 'a', position: 0 })
  const b = makeTask({ title: 'b', position: 1, status: 'done' })
  const c = makeTask({ title: 'c', position: 2 })
  const d = makeTask({ title: 'd', position: 3 })

  it('keeps done tasks in their slots and refills the open slots in the new order', () => {
    const changed = renumberGroup([a, b, c, d], [d, a, c])
    const result = Object.fromEntries(changed.map((t) => [t.title, t.position]))
    // slots: 0 (open) 1 (done b) 2 (open) 3 (open) -> d, b, a, c
    expect(result).toEqual({ d: 0, a: 2, c: 3 })
  })

  it('returns nothing when the order is unchanged', () => {
    expect(renumberGroup([a, b, c, d], [a, c, d])).toEqual([])
  })
})

describe('renumber', () => {
  it('returns only items whose position changed', () => {
    const items = [
      { id: 'x', position: 0 },
      { id: 'y', position: 5 },
    ]
    expect(renumber(items)).toEqual([{ id: 'y', position: 1 }])
  })
})

describe('moveIntoGroup', () => {
  const t = (id: string, position: number, extra = {}) =>
    makeTask({ id, title: id, projectId: 'p', milestoneId: 'sub', position, ...extra })
  const target = [t('a', 0), t('done', 1, { status: 'done' }), t('b', 2)]
  const moving = makeTask({ id: 'x', title: 'x', projectId: 'p', milestoneId: 'ws', position: 5 })

  it('inserts before the task it was dropped on and renumbers the group', () => {
    const saved = moveIntoGroup(target, moving, 'sub', 'b')
    const byId = new Map(saved.map((s) => [s.id, s]))
    expect(byId.get('x')).toMatchObject({ milestoneId: 'sub', position: 2 })
    expect(byId.get('b')!.position).toBe(3)
    expect(byId.has('a')).toBe(false)
  })

  it('appends when dropped on the group itself', () => {
    const saved = moveIntoGroup(target, moving, 'sub', null)
    expect(saved).toEqual([{ ...moving, milestoneId: 'sub', position: 3 }])
  })

  it('still saves the move when the position happens to stay the same', () => {
    const lone = makeTask({ id: 'y', title: 'y', projectId: 'p', milestoneId: 'ws', position: 0 })
    expect(moveIntoGroup([], lone, 'sub', null)).toEqual([{ ...lone, milestoneId: 'sub' }])
  })
})
