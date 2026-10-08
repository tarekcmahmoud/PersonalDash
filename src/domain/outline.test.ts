import breakdownPromptMd from '../../docs/breakdown-prompt.md?raw'
import outlineFormatMd from '../../docs/outline-format.md?raw'
import { describe, expect, it } from 'vitest'
import { makeChecklistItem, makeMilestone, makeProject, makeTask } from './factories'
import type { Milestone } from './types'
import {
  docToBundle,
  parseOutline,
  projectToDoc,
  serializeOutline,
  type OutlineDoc,
  type OutlineTask,
} from './outline'

const task = (title: string, extra: Partial<OutlineTask> = {}): OutlineTask => ({
  title,
  size: 'S',
  key: null,
  after: [],
  doneWhen: '',
  notes: '',
  checklist: [],
  ...extra,
})

const doc = (extra: Partial<OutlineDoc> = {}): OutlineDoc => ({
  name: 'P',
  outcome: '',
  targetDate: null,
  dateKind: 'soft',
  weeklyMin: null,
  tasks: [],
  milestones: [],
  ...extra,
})

const stripLines = <T>(v: T): T => JSON.parse(JSON.stringify(v, (k, x) => (k === 'line' ? undefined : x)))

function errorsOf(text: string) {
  return parseOutline(text).issues.filter((i) => i.severity === 'error')
}
function warningsOf(text: string) {
  return parseOutline(text).issues.filter((i) => i.severity === 'warning')
}
function parseOk(text: string): OutlineDoc {
  const r = parseOutline(text)
  expect(r.issues.filter((i) => i.severity === 'error')).toEqual([])
  expect(r.doc).not.toBeNull()
  return r.doc as OutlineDoc
}

describe('parseOutline: valid input', () => {
  it('parses the example from docs/outline-format.md with no errors', () => {
    const md = outlineFormatMd
    const example = /```\n([\s\S]*?)\n```/.exec(md)?.[1]
    expect(example).toBeTruthy()
    const r = parseOutline(example as string)
    expect(r.issues.filter((i) => i.severity === 'error')).toEqual([])
    const d = r.doc as OutlineDoc
    expect(d.name).toBe('Website redesign')
    expect(d.outcome).toBe('Live site signed off by the client')
    expect(d.targetDate).toBe('2026-12-15')
    expect(d.dateKind).toBe('hard')
    expect(d.weeklyMin).toBe(2)
    expect(d.tasks.map((t) => t.title)).toEqual(['Confirm budget with finance'])
    expect(d.milestones.map((m) => m.name)).toEqual(['Discovery', 'Build'])
    expect(d.milestones[0]).toMatchObject({ targetDate: '2026-10-31', dateKind: 'soft' })
    const audit = d.milestones[0]!.tasks[1]!
    expect(audit.notes).toBe('include mobile analytics')
    expect(audit.checklist).toEqual([
      { text: 'Analytics export', done: false },
      { text: 'Page inventory', done: true },
    ])
    expect(d.milestones[0]!.tasks[0]!.doneWhen).toBe('agenda sent, notes shared')
    expect(d.milestones[0]!.tasks[2]!).toMatchObject({ key: 'sitemap', size: 'L' })
    expect(d.milestones[1]!.tasks[0]!).toMatchObject({ size: 'XL', after: ['sitemap'] })
  })

  it('parses a minimal document and records line numbers', () => {
    const r = parseOutline('\n// comment\n# Tiny\n\n## M1\n- Do it [S]\n')
    expect(r.issues).toEqual([])
    expect(r.doc?.name).toBe('Tiny')
    expect(r.doc?.milestones[0]!.line).toBe(5)
    expect(r.doc?.milestones[0]!.tasks[0]!.line).toBe(6)
  })

  it('applies defaults: soft kind, null milestone date, empty outcome', () => {
    const d = parseOk('# P\ntarget: 2026-05-01\n## M\ntarget: 2026-04-01\n- a [S]')
    expect(d.outcome).toBe('')
    expect(d.targetDate).toBe('2026-05-01')
    expect(d.dateKind).toBe('soft')
    expect(d.weeklyMin).toBeNull()
    expect(d.milestones[0]).toMatchObject({ targetDate: '2026-04-01', dateKind: 'soft' })
    const d2 = parseOk('# P\n## M\n- a [S]')
    expect(d2.targetDate).toBeNull()
    expect(d2.milestones[0]).toMatchObject({ targetDate: null, dateKind: null })
  })

  it('accepts a template without outcome and target', () => {
    const r = parseOutline('# Template\n- a [S]\n')
    expect(r.issues).toEqual([])
  })

  it('handles CRLF, tabs, and case-insensitive keys, kinds and sizes', () => {
    const text =
      '# P\r\nOutcome: x\r\nTARGET: 2026-01-02 HARD\r\nMin-Per-Week: 3\r\n\r\n- a [xl]\r\n\tDone: d\r\n\tNOTE: n\r\n\t- [X] c\r\n'
    const d = parseOk(text)
    expect(d).toMatchObject({ outcome: 'x', targetDate: '2026-01-02', dateKind: 'hard', weeklyMin: 3 })
    expect(d.tasks[0]).toMatchObject({ size: 'XL', doneWhen: 'd', notes: 'n' })
    expect(d.tasks[0]!.checklist).toEqual([{ text: 'c', done: true }])
  })

  it('parses task tokens in any order and strips them from the title', () => {
    const d = parseOk('# P\n- one [M] #a\n- after:#a #b [L] Write the thing now\n')
    expect(d.tasks[1]).toMatchObject({ title: 'Write the thing now', size: 'L', key: 'b', after: ['a'] })
  })

  it('supports multiple after keys, forward references, and a space after the comma', () => {
    const d = parseOk('# P\n- first [S] after:#c, #b\n- second [S] #b\n- third [S] #c\n')
    expect(d.tasks[0]!.after).toEqual(['c', 'b'])
  })

  it('joins several note lines with newlines and ignores comments inside tasks', () => {
    const d = parseOk('# P\n- a [S]\n  note: one\n  // hidden\n  note: two\n  done: fin\n')
    expect(d.tasks[0]!.notes).toBe('one\ntwo')
    expect(d.tasks[0]!.doneWhen).toBe('fin')
  })

  it('keeps tasks before the first milestone ungrouped', () => {
    const d = parseOk('# P\n- a [S]\n- b [S]\n## M\n- c [S]\n')
    expect(d.tasks.map((t) => t.title)).toEqual(['a', 'b'])
    expect(d.milestones[0]!.tasks.map((t) => t.title)).toEqual(['c'])
  })

  it('treats a task title that merely looks like a heading word normally', () => {
    const d = parseOk('# P\n- Fix the # symbol bug [S]\n')
    expect(d.tasks[0]!.title).toBe('Fix the # symbol bug')
  })
})

describe('parseOutline: errors', () => {
  it('flags a missing header (line 0)', () => {
    const r = parseOutline('- a [S]\n')
    expect(r.doc).toBeNull()
    expect(r.issues.some((i) => i.severity === 'error' && i.line === 0)).toBe(true)
    expect(errorsOf('')).toHaveLength(1)
    expect(errorsOf('// only a comment\n')[0]!.line).toBe(0)
  })

  it('flags content before the header at its line', () => {
    const r = parseOutline('\n- a [S]\n# P\n')
    expect(r.doc).toBeNull()
    expect(errorsOf('\n- a [S]\n# P\n')).toEqual([expect.objectContaining({ line: 2 })])
  })

  it('flags a duplicate header', () => {
    const errs = errorsOf('# P\n- a [S]\n# Q\n')
    expect(errs).toEqual([expect.objectContaining({ line: 3 })])
    expect(parseOutline('# P\n# Q').doc).toBeNull()
  })

  it('flags an empty project, milestone and task title', () => {
    expect(errorsOf('# \n')).toEqual([expect.objectContaining({ line: 1 })])
    expect(errorsOf('# P\n## \n')).toEqual([expect.objectContaining({ line: 2 })])
    expect(errorsOf('# P\n- [S] #k\n')).toEqual([expect.objectContaining({ line: 2 })])
    expect(errorsOf('# P\n- \n')).toEqual([expect.objectContaining({ line: 2 })])
  })

  it('flags outcome / min-per-week outside the project header block', () => {
    expect(errorsOf('# P\n- a [S]\noutcome: late\n')).toEqual([expect.objectContaining({ line: 3 })])
    expect(errorsOf('# P\n- a [S]\nmin-per-week: 2\n')).toEqual([expect.objectContaining({ line: 3 })])
    expect(errorsOf('# P\n## M\noutcome: nope\n')).toEqual([expect.objectContaining({ line: 3 })])
    expect(errorsOf('# P\n## M\nmin-per-week: 2\n')).toEqual([expect.objectContaining({ line: 3 })])
    expect(errorsOf('# P\n- a [S]\n  outcome: indented\n')).toEqual([expect.objectContaining({ line: 3 })])
  })

  it('flags target outside a header block', () => {
    expect(errorsOf('# P\n- a [S]\ntarget: 2026-01-01\n')).toEqual([expect.objectContaining({ line: 3 })])
    expect(errorsOf('# P\n## M\n- a [S]\ntarget: 2026-01-01\n')).toEqual([
      expect.objectContaining({ line: 4 }),
    ])
  })

  it('flags bad dates', () => {
    for (const v of ['2026-13-01', '2026-02-30', '26-01-01', 'tomorrow', '', '2026-1-1', '2025-02-29']) {
      expect(errorsOf(`# P\ntarget: ${v}\n`), v).toEqual([expect.objectContaining({ line: 2 })])
    }
    expect(errorsOf('# P\ntarget: 2024-02-29\n')).toEqual([])
    expect(errorsOf('# P\n## M\ntarget: 2026-04-31\n')).toEqual([expect.objectContaining({ line: 3 })])
  })

  it('flags bad kinds', () => {
    expect(errorsOf('# P\ntarget: 2026-01-01 firm\n')).toEqual([expect.objectContaining({ line: 2 })])
    expect(errorsOf('# P\ntarget: 2026-01-01 hard extra\n')).toEqual([expect.objectContaining({ line: 2 })])
    expect(errorsOf('# P\n## M\ntarget: 2026-01-01 maybe\n')).toEqual([expect.objectContaining({ line: 3 })])
  })

  it('flags bad min-per-week', () => {
    for (const v of ['0', '-1', '1.5', 'two', '']) {
      expect(errorsOf(`# P\nmin-per-week: ${v}\n`), v).toEqual([expect.objectContaining({ line: 2 })])
    }
    expect(parseOk('# P\nmin-per-week: 12\n').weeklyMin).toBe(12)
  })

  it('flags duplicate header keys and duplicate done', () => {
    expect(errorsOf('# P\noutcome: a\noutcome: b\n')).toEqual([expect.objectContaining({ line: 3 })])
    expect(errorsOf('# P\ntarget: 2026-01-01\ntarget: 2026-01-02\n')).toEqual([
      expect.objectContaining({ line: 3 }),
    ])
    expect(errorsOf('# P\nmin-per-week: 1\nmin-per-week: 2\n')).toEqual([
      expect.objectContaining({ line: 3 }),
    ])
    expect(errorsOf('# P\n## M\ntarget: 2026-01-01\ntarget: 2026-01-02\n')).toEqual([
      expect.objectContaining({ line: 4 }),
    ])
    expect(errorsOf('# P\n- a [S]\n  done: x\n  done: y\n')).toEqual([expect.objectContaining({ line: 4 })])
  })

  it('flags duplicate task keys and duplicate tokens', () => {
    expect(errorsOf('# P\n- a [S] #k\n- b [S] #k\n')).toEqual([expect.objectContaining({ line: 3 })])
    expect(errorsOf('# P\n- a [S] [M]\n')).toHaveLength(1)
    expect(errorsOf('# P\n- a [S] #x #y\n')).toHaveLength(1)
    expect(errorsOf('# P\n- a [S] #x\n- b [S] after:#x after:#x\n')).toHaveLength(1)
  })

  it('flags unknown after keys', () => {
    expect(errorsOf('# P\n- a [S] after:#nope\n')).toEqual([expect.objectContaining({ line: 2 })])
    expect(errorsOf('# P\n- a [S] #a\n- b [S] after:#a,#nope\n')).toEqual([
      expect.objectContaining({ line: 3 }),
    ])
    expect(errorsOf('# P\n- a [S] after:\n')).toHaveLength(1)
  })

  it('flags dependency cycles, including self cycles', () => {
    expect(errorsOf('# P\n- a [S] #a after:#a\n')).toEqual([expect.objectContaining({ line: 2 })])
    const two = errorsOf('# P\n- a [S] #a after:#b\n- b [S] #b after:#a\n')
    expect(two).toHaveLength(1)
    expect(two[0]!.message).toMatch(/cycle/i)
    const three = errorsOf('# P\n- a [S] #a after:#c\n- b [S] #b after:#a\n- c [S] #c after:#b\n')
    expect(three).toHaveLength(1)
    // A diamond is not a cycle.
    expect(
      errorsOf('# P\n- a [S] #a\n- b [S] #b after:#a\n- c [S] #c after:#a\n- d [S] after:#b,#c\n'),
    ).toEqual([])
    expect(parseOutline('# P\n- a [S] #a after:#a\n').doc).toBeNull()
  })

  it('flags detail and checklist lines with no task above', () => {
    expect(errorsOf('# P\n  done: x\n')).toEqual([expect.objectContaining({ line: 2 })])
    expect(errorsOf('# P\n  note: x\n')).toEqual([expect.objectContaining({ line: 2 })])
    expect(errorsOf('# P\n  - [ ] x\n')).toEqual([expect.objectContaining({ line: 2 })])
    // A milestone heading ends the previous task.
    expect(errorsOf('# P\n- a [S]\n## M\n  note: orphan\n')).toEqual([expect.objectContaining({ line: 4 })])
  })

  it('flags unindented done/note and empty checklist items', () => {
    expect(errorsOf('# P\n- a [S]\ndone: x\n')).toEqual([expect.objectContaining({ line: 3 })])
    expect(errorsOf('# P\n- a [S]\n  - [ ]\n')).toEqual([expect.objectContaining({ line: 3 })])
  })

  it('returns doc null whenever there is an error, and doc otherwise', () => {
    expect(parseOutline('# P\n- a [S] after:#x\n').doc).toBeNull()
    expect(parseOutline('# P\n- a [S]\n').doc).not.toBeNull()
  })

  it('reports multiple errors in line order', () => {
    const errs = errorsOf('# P\ntarget: bad\n- a [S] after:#zz\n  done: ok\n## \n')
    expect(errs.map((e) => e.line)).toEqual([2, 3, 5])
  })
})

describe('parseOutline: warnings', () => {
  it('warns about unknown key: value lines but still parses', () => {
    const r = parseOutline('# P\nowner: me\n- a [S]\n  priority: high\n')
    expect(r.doc).not.toBeNull()
    expect(r.issues.map((i) => [i.line, i.severity])).toEqual([
      [2, 'warning'],
      [4, 'warning'],
    ])
  })

  it('warns about a missing size and defaults to M', () => {
    const r = parseOutline('# P\n- Think about it\n')
    expect(r.issues).toEqual([expect.objectContaining({ line: 2, severity: 'warning' })])
    expect(r.doc?.tasks[0]!.size).toBe('M')
  })

  it('warns about unrecognized lines (including indented list items)', () => {
    expect(warningsOf('# P\nrandom text\n')).toHaveLength(1)
    expect(warningsOf('# P\n- a [S]\n  - not a checklist\n')).toHaveLength(1)
    expect(warningsOf('# P\n### deep\n')).toHaveLength(1)
  })
})

describe('serializeOutline', () => {
  it('produces the canonical form', () => {
    const d = doc({
      name: 'Website',
      outcome: 'Live site',
      targetDate: '2026-12-15',
      dateKind: 'hard',
      weeklyMin: 2,
      tasks: [task('Confirm budget', { size: 'S' })],
      milestones: [
        {
          name: 'Discovery',
          targetDate: '2026-10-31',
          dateKind: 'soft',
          tasks: [
            task('Kickoff', { doneWhen: 'notes shared' }),
            task('Audit', {
              size: 'M',
              key: 'audit',
              notes: 'line one\nline two',
              checklist: [
                { text: 'Export', done: false },
                { text: 'Inventory', done: true },
              ],
            }),
          ],
        },
        {
          name: 'Build',
          targetDate: null,
          dateKind: null,
          tasks: [task('Home', { size: 'XL', after: ['audit', 'x'] })],
        },
      ],
    })
    expect(serializeOutline(d)).toBe(
      [
        '# Website',
        'outcome: Live site',
        'target: 2026-12-15 hard',
        'min-per-week: 2',
        '',
        '- Confirm budget [S]',
        '',
        '## Discovery',
        'target: 2026-10-31 soft',
        '- Kickoff [S]',
        '  done: notes shared',
        '- Audit [M] #audit',
        '  note: line one',
        '  note: line two',
        '  - [ ] Export',
        '  - [x] Inventory',
        '',
        '## Build',
        '- Home [XL] after:#audit,#x',
        '',
      ].join('\n'),
    )
  })

  it('omits optional header lines and handles empty docs', () => {
    expect(serializeOutline(doc())).toBe('# P\n')
    expect(serializeOutline(doc({ tasks: [task('a')] }))).toBe('# P\n\n- a [S]\n')
    expect(
      serializeOutline(doc({ milestones: [{ name: 'M', targetDate: null, dateKind: null, tasks: [] }] })),
    ).toBe('# P\n\n## M\n')
  })

  it('always writes the kind with a target date', () => {
    expect(serializeOutline(doc({ targetDate: '2026-01-01' }))).toContain('target: 2026-01-01 soft')
  })

  it('ignores line fields', () => {
    expect(serializeOutline(doc({ tasks: [task('a', { line: 99 })] }))).toBe('# P\n\n- a [S]\n')
  })
})

describe('round trip', () => {
  const docs: Record<string, OutlineDoc> = {
    minimal: doc(),
    tasksOnly: doc({ tasks: [task('a'), task('b', { size: 'L' }), task('c', { size: 'XL' })] }),
    full: doc({
      name: 'Big project',
      outcome: 'Done when everything works',
      targetDate: '2026-12-31',
      dateKind: 'hard',
      weeklyMin: 3,
      tasks: [task('Pre-work', { size: 'M', doneWhen: 'paid', notes: 'a\nb' })],
      milestones: [
        {
          name: 'One',
          targetDate: '2026-06-01',
          dateKind: 'soft',
          tasks: [
            task('x', {
              key: 'x',
              checklist: [
                { text: 'c1', done: true },
                { text: 'c2', done: false },
              ],
            }),
            task('y', { key: 'y', after: ['x'] }),
          ],
        },
        {
          name: 'Two',
          targetDate: '2026-09-09',
          dateKind: 'hard',
          tasks: [task('z', { size: 'L', after: ['y', 'x'], notes: 'waiting on Sam' })],
        },
        { name: 'Empty', targetDate: null, dateKind: null, tasks: [] },
      ],
    }),
    forwardRefs: doc({
      tasks: [task('first', { after: ['last'] }), task('last', { key: 'last' })],
    }),
    emptyMilestoneFirst: doc({
      milestones: [
        { name: 'A', targetDate: null, dateKind: null, tasks: [] },
        {
          name: 'B',
          targetDate: '2026-02-02',
          dateKind: 'soft',
          tasks: [task('t', { key: 'k-1', doneWhen: 'x: y' })],
        },
      ],
    }),
    unicodeAndPunctuation: doc({
      name: 'Café "plan" - v2: draft',
      outcome: 'Résumé — ready',
      tasks: [task('Email Zoë: re. "budget" (urgent) & more', { notes: 'x: y\n- dash\n// not a comment' })],
    }),
  }

  for (const [name, d] of Object.entries(docs)) {
    it(`parse(serialize(doc)) equals doc: ${name}`, () => {
      const text = serializeOutline(d)
      const r = parseOutline(text)
      expect(r.issues.filter((i) => i.severity === 'error')).toEqual([])
      expect(stripLines(r.doc)).toEqual(stripLines(d))
      // Canonical text is a fixed point.
      expect(serializeOutline(r.doc as OutlineDoc)).toBe(text)
    })
  }

  it('round-trips the same docs with every size', () => {
    for (const size of ['S', 'M', 'L', 'XL'] as const) {
      const d = doc({ tasks: [task('t', { size })] })
      expect(stripLines(parseOk(serializeOutline(d)))).toEqual(d)
    }
  })

  it('serialized text parses without warnings', () => {
    for (const d of Object.values(docs)) expect(warningsOf(serializeOutline(d))).toEqual([])
  })
})

describe('docToBundle', () => {
  const source = doc({
    name: 'Site',
    outcome: 'Live',
    targetDate: '2026-12-15',
    dateKind: 'hard',
    weeklyMin: 2,
    tasks: [task('pre-a'), task('pre-b', { size: 'M' })],
    milestones: [
      {
        name: 'M1',
        targetDate: '2026-10-01',
        dateKind: 'soft',
        tasks: [
          task('a', {
            key: 'a',
            doneWhen: 'dw',
            notes: 'n1\nn2',
            checklist: [
              { text: 'c0', done: true },
              { text: 'c1', done: false },
            ],
          }),
          task('b', { key: 'b', after: ['a', 'later'] }),
        ],
      },
      {
        name: 'M2',
        targetDate: null,
        dateKind: null,
        tasks: [task('later', { key: 'later', size: 'XL' }), task('z')],
      },
    ],
  })

  it('creates the project from the doc with the rank from opts', () => {
    const b = docToBundle(source, { rank: 7 })
    expect(b.projects).toHaveLength(1)
    expect(b.projects[0]).toMatchObject({
      name: 'Site',
      outcome: 'Live',
      targetDate: '2026-12-15',
      dateKind: 'hard',
      weeklyMin: 2,
      rank: 7,
      status: 'active',
      isSystem: false,
    })
  })

  it('applies opts.project overrides, ignoring undefined values', () => {
    const b = docToBundle(source, {
      rank: 1,
      project: {
        name: 'Renamed',
        targetDate: '2027-01-01',
        dateKind: 'soft',
        weeklyMin: null,
        status: 'on_hold',
        outcome: undefined,
      },
    })
    expect(b.projects[0]).toMatchObject({
      name: 'Renamed',
      outcome: 'Live',
      targetDate: '2027-01-01',
      dateKind: 'soft',
      weeklyMin: null,
      status: 'on_hold',
      rank: 1,
    })
  })

  it('creates milestones with positions 0..n and project ids', () => {
    const b = docToBundle(source, { rank: 0 })
    const pid = b.projects[0]!.id
    expect(b.milestones.map((m) => [m.name, m.position, m.projectId, m.targetDate, m.dateKind])).toEqual([
      ['M1', 0, pid, '2026-10-01', 'soft'],
      ['M2', 1, pid, null, null],
    ])
  })

  it('creates tasks with positions within each group, status todo, and group membership', () => {
    const b = docToBundle(source, { rank: 0 })
    const pid = b.projects[0]!.id
    const [m1, m2] = b.milestones as [Milestone, Milestone]
    const view = b.tasks.map((t) => [t.title, t.milestoneId, t.position, t.size, t.status, t.projectId])
    expect(view).toEqual([
      ['pre-a', null, 0, 'S', 'todo', pid],
      ['pre-b', null, 1, 'M', 'todo', pid],
      ['a', m1.id, 0, 'S', 'todo', pid],
      ['b', m1.id, 1, 'S', 'todo', pid],
      ['later', m2.id, 0, 'XL', 'todo', pid],
      ['z', m2.id, 1, 'S', 'todo', pid],
    ])
    const a = b.tasks.find((t) => t.title === 'a')
    expect(a).toMatchObject({ doneWhen: 'dw', notes: 'n1\nn2' })
    expect(new Set(b.tasks.map((t) => t.id)).size).toBe(b.tasks.length)
  })

  it('creates dependencies from after keys (forward references included)', () => {
    const b = docToBundle(source, { rank: 0 })
    const id = (title: string) => b.tasks.find((t) => t.title === title)?.id
    expect(b.dependencies).toEqual([
      { taskId: id('b'), blockedByTaskId: id('a') },
      { taskId: id('b'), blockedByTaskId: id('later') },
    ])
  })

  it('creates checklist items with positions 0..n and done flags', () => {
    const b = docToBundle(source, { rank: 0 })
    const a = b.tasks.find((t) => t.title === 'a')
    expect(b.checklist.map((c) => [c.taskId, c.text, c.done, c.position])).toEqual([
      [a?.id, 'c0', true, 0],
      [a?.id, 'c1', false, 1],
    ])
  })

  it('generates fresh ids on every call', () => {
    const one = docToBundle(source, { rank: 0 })
    const two = docToBundle(source, { rank: 0 })
    expect(one.projects[0]!.id).not.toBe(two.projects[0]!.id)
    expect(one.tasks[0]!.id).not.toBe(two.tasks[0]!.id)
  })

  it('works on a parsed document end to end', () => {
    const d = parseOk(
      '# P\ntarget: 2026-05-05 hard\n## M\n- a [S] #a\n- b [L] after:#a\n  - [x] done thing\n',
    )
    const b = docToBundle(d, { rank: 3 })
    expect(b.tasks).toHaveLength(2)
    expect(b.dependencies).toHaveLength(1)
    expect(b.checklist[0]).toMatchObject({ text: 'done thing', done: true })
  })
})

describe('projectToDoc', () => {
  function buildProject() {
    const project = makeProject({
      name: 'Proj',
      outcome: 'Out',
      targetDate: '2026-11-11',
      dateKind: 'hard',
      weeklyMin: 4,
    })
    const other = makeProject({ name: 'Other' })
    // Milestones deliberately listed out of position order.
    const m2 = makeMilestone({
      projectId: project.id,
      name: 'Second',
      position: 1,
      targetDate: '2026-11-01',
      dateKind: 'hard',
    })
    const m1 = makeMilestone({ projectId: project.id, name: 'First', position: 0 })
    const mo = makeMilestone({ projectId: other.id, name: 'Foreign', position: 0 })
    const mk = (title: string, milestoneId: string | null, position: number, extra = {}) =>
      makeTask({ projectId: project.id, milestoneId, title, position, ...extra })
    const loose2 = mk('loose 2', null, 1, { status: 'done', size: 'L' })
    const loose1 = mk('loose 1', null, 0, { notes: 'a\nb', doneWhen: 'dw' })
    const s2 = mk('s2', m2.id, 1)
    const s1 = mk('s1', m2.id, 0, { size: 'XL' })
    const f1 = mk('f1', m1.id, 0, { status: 'waiting', waitingOn: 'Sam' })
    const f2 = mk('f2', m1.id, 1)
    const foreign = makeTask({ projectId: other.id, milestoneId: mo.id, title: 'foreign' })
    const inbox = makeTask({ title: 'inbox' })
    const dependencies = [
      { taskId: s1.id, blockedByTaskId: f2.id },
      { taskId: s2.id, blockedByTaskId: f2.id },
      { taskId: s2.id, blockedByTaskId: loose1.id },
      { taskId: foreign.id, blockedByTaskId: f1.id }, // cross-project: ignored
    ]
    const checklist = [
      makeChecklistItem({ taskId: f1.id, text: 'second', done: true, position: 1 }),
      makeChecklistItem({ taskId: f1.id, text: 'first', done: false, position: 0 }),
    ]
    return {
      project,
      snapshot: {
        projects: [other, project],
        milestones: [m2, mo, m1],
        tasks: [s2, foreign, f2, inbox, loose2, s1, f1, loose1],
        dependencies,
        checklist,
      },
    }
  }

  it('describes project fields and orders milestones by position', () => {
    const { project, snapshot } = buildProject()
    const d = projectToDoc(project.id, snapshot)
    expect(d).toMatchObject({
      name: 'Proj',
      outcome: 'Out',
      targetDate: '2026-11-11',
      dateKind: 'hard',
      weeklyMin: 4,
    })
    expect(d.milestones.map((m) => m.name)).toEqual(['First', 'Second'])
    expect(d.milestones[1]).toMatchObject({ targetDate: '2026-11-01', dateKind: 'hard' })
    expect(d.milestones[0]).toMatchObject({ targetDate: null, dateKind: null })
  })

  it('uses workflow order: milestone-less tasks first, then milestones; tasks by position; every status', () => {
    const { project, snapshot } = buildProject()
    const d = projectToDoc(project.id, snapshot)
    expect(d.tasks.map((t) => t.title)).toEqual(['loose 1', 'loose 2'])
    expect(d.milestones[0]!.tasks.map((t) => t.title)).toEqual(['f1', 'f2'])
    expect(d.milestones[1]!.tasks.map((t) => t.title)).toEqual(['s1', 's2'])
    expect(d.tasks[0]).toMatchObject({ notes: 'a\nb', doneWhen: 'dw', size: 'S' })
    expect(d.tasks[1]!.size).toBe('L')
    expect(d.milestones[1]!.tasks[0]!.size).toBe('XL')
  })

  it('generates keys t1, t2 only for blockers, in workflow order, and fills after', () => {
    const { project, snapshot } = buildProject()
    const d = projectToDoc(project.id, snapshot)
    // loose 1 is first in workflow order, f2 second.
    expect(d.tasks[0]!.key).toBe('t1')
    expect(d.tasks[1]!.key).toBeNull()
    expect(d.milestones[0]!.tasks.map((t) => t.key)).toEqual([null, 't2'])
    const [s1, s2] = d.milestones[1]!.tasks
    expect(s1).toMatchObject({ key: null, after: ['t2'] })
    expect(s2).toMatchObject({ key: null, after: ['t1', 't2'] })
    expect(d.tasks[0]!.after).toEqual([])
  })

  it('keeps checklist order and done flags', () => {
    const { project, snapshot } = buildProject()
    const d = projectToDoc(project.id, snapshot)
    expect(d.milestones[0]!.tasks[0]!.checklist).toEqual([
      { text: 'first', done: false },
      { text: 'second', done: true },
    ])
  })

  it('serializes to text that parses back to the same doc', () => {
    const { project, snapshot } = buildProject()
    const d = projectToDoc(project.id, snapshot)
    const r = parseOutline(serializeOutline(d))
    expect(r.issues.filter((i) => i.severity === 'error')).toEqual([])
    expect(stripLines(r.doc)).toEqual(d)
  })

  it('round-trips with docToBundle', () => {
    const source = parseOk(
      '# P\noutcome: o\ntarget: 2026-03-03 hard\n- pre [S]\n## A\n- a [M] #t1\n  note: hi\n  - [x] c\n## B\n- b [L] after:#t1\n- c [S]\n',
    )
    const bundle = docToBundle(source, { rank: 0 })
    const back = projectToDoc(bundle.projects[0]!.id, { ...bundle })
    expect(stripLines(back)).toEqual(stripLines(source))
  })

  it('throws for an unknown project', () => {
    expect(() =>
      projectToDoc('nope', { projects: [], milestones: [], tasks: [], dependencies: [], checklist: [] }),
    ).toThrow()
  })
})

describe('docs/breakdown-prompt.md', () => {
  const md = breakdownPromptMd
  const exampleOutput = () => {
    const after = md.slice(md.indexOf('## Worked example'))
    const blocks = [...after.matchAll(/```text\n([\s\S]*?)\n```/g)].map((m) => m[1])
    return blocks[blocks.length - 1] ?? ''
  }

  it('has a worked example output that parses with zero errors and zero warnings', () => {
    const text = exampleOutput()
    expect(text).toBeTruthy()
    const r = parseOutline(text)
    expect(r.issues).toEqual([])
    expect(r.doc).not.toBeNull()
  })

  it('worked example showcases the product conventions', () => {
    const d = parseOk(exampleOutput())
    expect(d.milestones.length).toBeGreaterThanOrEqual(3)
    expect(d.milestones.length).toBeLessThanOrEqual(7)
    const all = [...d.tasks, ...d.milestones.flatMap((m) => m.tasks)]
    expect(all.some((t) => t.after.length > 0)).toBe(true)
    expect(all.some((t) => t.size === 'XL')).toBe(true)
    expect(all.some((t) => /waiting on/.test(t.notes))).toBe(true)
    expect(all.some((t) => t.doneWhen !== '')).toBe(true)
    expect(all[0]!.size === 'S' || all[0]!.size === 'M').toBe(true)
    // The example output is canonical enough to survive a round trip.
    expect(stripLines(parseOk(serializeOutline(d)))).toEqual(stripLines(d))
  })

  it('contains the placeholders the user is meant to fill in', () => {
    const placeholders = md.match(/\{\{[^}]+\}\}/g) ?? []
    expect(placeholders.length).toBeGreaterThanOrEqual(6)
  })
})
