import { describe, expect, it } from 'vitest'
import { delegateTask, delegationByPerson, takeBackTask } from './delegation'
import { makePerson, makeTask } from './factories'
import { followUpsForWeek } from './followups'

const TODAY = '2026-10-08' // Thursday; week starts 2026-10-05
const sam = makePerson({ name: 'Sam' })
const priya = makePerson({ name: 'Priya' })
const ana = makePerson({ name: 'Ana' })

describe('delegationByPerson', () => {
  const tasks = [
    makeTask({ title: 'Later', assigneeId: sam.id, followUpDate: '2026-10-20' }),
    makeTask({ title: 'No date', assigneeId: sam.id }),
    makeTask({ title: 'Overdue', assigneeId: priya.id, followUpDate: '2026-10-06' }),
    makeTask({ title: 'Today', assigneeId: priya.id, followUpDate: TODAY }),
    makeTask({ title: 'Finished', assigneeId: ana.id, status: 'done' }),
    makeTask({ title: 'Mine', followUpDate: TODAY }),
  ]

  it('groups open delegated tasks by person, people with follow-ups due first', () => {
    const groups = delegationByPerson(tasks, [sam, priya, ana], TODAY)
    expect(groups.map((g) => g.person.name)).toEqual(['Priya', 'Sam'])
    expect(groups[0]!.items.map((i) => [i.task.title, i.due, i.overdue])).toEqual([
      ['Overdue', true, true],
      ['Today', true, false],
    ])
    expect(groups[0]!.dueCount).toBe(2)
    expect(groups[1]!.items.map((i) => i.task.title)).toEqual(['Later', 'No date'])
  })
})

describe('delegating', () => {
  it('takes the task out of your weeks and out of waiting', () => {
    const task = makeTask({
      title: 'T',
      status: 'waiting',
      waitingOn: 'Bob',
      weekStart: '2026-10-05',
      pinnedDay: TODAY,
    })
    expect(delegateTask(task, sam.id, '2026-10-11')).toEqual({
      assigneeId: sam.id,
      followUpDate: '2026-10-11',
      weekStart: null,
      pinnedDay: null,
      status: 'todo',
      waitingOn: null,
    })
    expect(takeBackTask(task)).toEqual({ assigneeId: null, followUpDate: null })
  })

  it("puts due delegated follow-ups in the week's follow-ups, named after the person", () => {
    const delegated = makeTask({ title: 'Mockups', assigneeId: priya.id, followUpDate: TODAY })
    const [item] = followUpsForWeek([delegated], '2026-10-05', TODAY, [priya])
    expect(item).toMatchObject({ kind: 'delegated', label: 'Follow up: Priya re Mockups', overdue: false })
  })
})
