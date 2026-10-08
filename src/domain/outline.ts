import { makeChecklistItem, makeMilestone, makeProject, makeTask } from './factories'
import type { DateKind, EntityBundle, ISODate, Milestone, Project, Snapshot, Task, TaskSize } from './types'

// Parser/serializer for the outline format specified in docs/outline-format.md.

export interface OutlineChecklistItem {
  text: string
  done: boolean
}

export interface OutlineTask {
  title: string
  size: TaskSize
  /** Without the leading '#'. */
  key: string | null
  /** Keys (without '#') of explicit blockers. */
  after: string[]
  /**
   * `anytime` token: the task does not follow the previous task in its group (no implied link). Only ever
   * `true` or absent.
   */
  anytime?: true
  doneWhen: string
  notes: string
  checklist: OutlineChecklistItem[]
  /** 1-based source line; absent for docs built in code. Ignored by the serializer. */
  line?: number
}

export interface OutlineMilestone {
  name: string
  targetDate: ISODate | null
  dateKind: DateKind | null
  tasks: OutlineTask[]
  line?: number
}

export interface OutlineDoc {
  name: string
  outcome: string
  targetDate: ISODate | null
  dateKind: DateKind
  weeklyMin: number | null
  /** Tasks before the first milestone. */
  tasks: OutlineTask[]
  milestones: OutlineMilestone[]
}

export interface OutlineIssue {
  /** 1-based line number (0 = whole document). */
  line: number
  message: string
  severity: 'error' | 'warning'
}

export interface ParseResult {
  /** null when there is at least one error. */
  doc: OutlineDoc | null
  issues: OutlineIssue[]
}

// ---------------------------------------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------------------------------------

const SIZE_RE = /^\[(S|M|L|XL)\]$/i
const KEY_TOKEN_RE = /^#([a-z0-9-]+)$/i
const AFTER_RE = /^after:(.*)$/i
const ANYTIME_RE = /^anytime$/i
const KEY_VALUE_RE = /^([A-Za-z][A-Za-z0-9-]*)\s*:\s*(.*)$/
const HEADER_RE = /^#(?!#)(?:\s+(.*))?$/
const MILESTONE_RE = /^##(?!#)(?:\s+(.*))?$/
const TASK_RE = /^-(?:\s+(.*))?$/
const CHECKLIST_RE = /^-\s+\[([ xX])\]\s*(.*)$/
const TARGET_RE = /^(\d{4})-(\d{2})-(\d{2})(?:\s+(\S+))?(?:\s+(.*))?$/

function isValidDate(y: number, m: number, d: number): boolean {
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
}

type TargetResult = { ok: true; date: ISODate; kind: DateKind } | { ok: false; message: string }

function parseTarget(value: string): TargetResult {
  const m = TARGET_RE.exec(value)
  if (!m) {
    return { ok: false, message: `Bad target date "${value}" (expected YYYY-MM-DD, optionally hard or soft)` }
  }
  const [, ys, ms, ds, kindRaw, extra] = m
  if (!isValidDate(Number(ys), Number(ms), Number(ds))) {
    return { ok: false, message: `Bad target date "${ys}-${ms}-${ds}" (not a real calendar date)` }
  }
  let kind: DateKind = 'soft'
  if (kindRaw !== undefined) {
    const k = kindRaw.toLowerCase()
    if ((k !== 'hard' && k !== 'soft') || extra !== undefined) {
      const shown = extra ? `${kindRaw} ${extra}` : kindRaw
      return { ok: false, message: `Bad target kind "${shown}" (expected hard or soft)` }
    }
    kind = k
  }
  return { ok: true, date: `${ys}-${ms}-${ds}`, kind }
}

interface TaskLine {
  title: string
  size: TaskSize | null
  key: string | null
  after: string[]
  anytime: boolean
  errors: string[]
}

function parseTaskLine(rest: string): TaskLine {
  const out: TaskLine = { title: '', size: null, key: null, after: [], anytime: false, errors: [] }
  const titleParts: string[] = []
  let sawAfter = false
  let sawSize = false
  const tokens = rest.trim().split(/\s+/).filter(Boolean)
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i] ?? ''
    const size = SIZE_RE.exec(tok)
    if (size) {
      if (sawSize) out.errors.push('More than one size tag on the task')
      sawSize = true
      out.size = (size[1] ?? '').toUpperCase() as TaskSize
      continue
    }
    const keyTok = KEY_TOKEN_RE.exec(tok)
    if (keyTok) {
      if (out.key !== null) out.errors.push('More than one #key on the task')
      else out.key = (keyTok[1] ?? '').toLowerCase()
      continue
    }
    const afterTok = AFTER_RE.exec(tok)
    if (afterTok) {
      if (sawAfter) out.errors.push('More than one after: on the task')
      sawAfter = true
      let value = afterTok[1] ?? ''
      // Tolerate "after:#a, #b" (a space after a comma).
      while (value.endsWith(',') && i + 1 < tokens.length) value += tokens[++i] ?? ''
      const parts = value.split(',').filter((p) => p !== '')
      if (parts.length === 0) out.errors.push('after: needs at least one #key')
      for (const part of parts) {
        const dep = /^#?([a-z0-9-]+)$/i.exec(part)?.[1]?.toLowerCase()
        if (dep === undefined) out.errors.push(`Bad dependency "${part}" in after: (expected #key)`)
        else if (!out.after.includes(dep)) out.after.push(dep)
      }
      continue
    }
    if (ANYTIME_RE.test(tok)) {
      out.anytime = true
      continue
    }
    titleParts.push(tok)
  }
  if (out.anytime && sawAfter) out.errors.push('Use either anytime or after:, not both')
  out.title = titleParts.join(' ')
  return out
}

export function parseOutline(text: string): ParseResult {
  const issues: OutlineIssue[] = []
  const err = (line: number, message: string) => issues.push({ line, message, severity: 'error' })
  const warn = (line: number, message: string) => issues.push({ line, message, severity: 'warning' })

  const doc: OutlineDoc = {
    name: '',
    outcome: '',
    targetDate: null,
    dateKind: 'soft',
    weeklyMin: null,
    tasks: [],
    milestones: [],
  }

  type Phase = 'header' | 'milestone-head' | 'body'
  let seenHeader = false
  let reportedBeforeHeader = false
  let phase: Phase = 'header'
  let currentMilestone: OutlineMilestone | null = null
  let currentTask: OutlineTask | null = null
  let noteLines: string[] = []
  let sawDone = false
  const seenHeaderKeys = new Set<string>()
  let seenMilestoneTarget = false

  const finishTask = () => {
    if (currentTask) currentTask.notes = noteLines.join('\n')
    currentTask = null
    noteLines = []
    sawDone = false
  }

  const lines = text.split(/\r?\n/)
  lines.forEach((rawLine, idx) => {
    const lineNo = idx + 1
    const line = rawLine.replace(/\t/g, '  ').trimEnd()
    const trimmed = line.trim()
    if (trimmed === '' || trimmed.startsWith('//')) return
    const indented = /^\s/.test(line)

    // --- Project header -------------------------------------------------------------------------------
    if (!indented) {
      const h = HEADER_RE.exec(trimmed)
      if (h) {
        if (seenHeader) {
          err(lineNo, 'Duplicate "# Name" header: there must be exactly one project header')
          return
        }
        seenHeader = true
        doc.name = (h[1] ?? '').trim()
        if (doc.name === '') err(lineNo, 'The project name is empty')
        return
      }
    }
    if (!seenHeader) {
      if (!reportedBeforeHeader) {
        err(lineNo, 'Content before the "# Project name" header (the header must come first)')
        reportedBeforeHeader = true
      }
      return
    }

    if (!indented) {
      // --- Milestone heading --------------------------------------------------------------------------
      const m = MILESTONE_RE.exec(trimmed)
      if (m) {
        finishTask()
        const name = (m[1] ?? '').trim()
        if (name === '') err(lineNo, 'The milestone name is empty')
        currentMilestone = { name, targetDate: null, dateKind: null, tasks: [], line: lineNo }
        doc.milestones.push(currentMilestone)
        phase = 'milestone-head'
        seenMilestoneTarget = false
        return
      }

      // --- Task line ----------------------------------------------------------------------------------
      const t = TASK_RE.exec(trimmed)
      if (t) {
        finishTask()
        phase = 'body'
        const parsed = parseTaskLine(t[1] ?? '')
        for (const message of parsed.errors) err(lineNo, message)
        if (parsed.title === '') err(lineNo, 'The task has no title')
        else if (parsed.size === null) warn(lineNo, `Task "${parsed.title}" has no size tag, assuming M`)
        const task: OutlineTask = {
          title: parsed.title,
          size: parsed.size ?? 'M',
          key: parsed.key,
          after: parsed.after,
          ...(parsed.anytime ? { anytime: true as const } : {}),
          doneWhen: '',
          notes: '',
          checklist: [],
          line: lineNo,
        }
        ;(currentMilestone ? currentMilestone.tasks : doc.tasks).push(task)
        currentTask = task
        return
      }
    }

    // --- Indented checklist item ----------------------------------------------------------------------
    if (indented) {
      const c = CHECKLIST_RE.exec(trimmed)
      if (c) {
        if (!currentTask) {
          err(lineNo, 'Checklist item with no task above it')
        } else if ((c[2] ?? '').trim() === '') {
          err(lineNo, 'The checklist item is empty')
        } else {
          currentTask.checklist.push({ text: (c[2] ?? '').trim(), done: c[1] === 'x' || c[1] === 'X' })
        }
        return
      }
    }

    // --- key: value lines -----------------------------------------------------------------------------
    const kv = KEY_VALUE_RE.exec(trimmed)
    if (kv) {
      const key = (kv[1] ?? '').toLowerCase()
      const value = (kv[2] ?? '').trim()

      if (key === 'done' || key === 'note') {
        if (!currentTask) {
          err(lineNo, `"${key}:" line with no task above it`)
        } else if (!indented) {
          err(lineNo, `"${key}:" must be indented under its task`)
        } else if (key === 'done') {
          if (sawDone) err(lineNo, 'Duplicate "done:" for this task')
          sawDone = true
          currentTask.doneWhen = value
        } else {
          noteLines.push(value)
        }
        return
      }

      if (key === 'outcome' || key === 'target' || key === 'min-per-week') {
        if (phase === 'body' || (phase === 'milestone-head' && key !== 'target')) {
          const where =
            key === 'target'
              ? 'directly under the "# Name" or "## Milestone" heading'
              : 'directly under the "# Name" heading'
          err(lineNo, `"${key}:" is only valid ${where}`)
          return
        }
        if (key === 'target') {
          if (phase === 'header' ? seenHeaderKeys.has(key) : seenMilestoneTarget) {
            err(lineNo, 'Duplicate "target:"')
            return
          }
          const res = parseTarget(value)
          if (!res.ok) {
            err(lineNo, res.message)
            return
          }
          if (phase === 'header') {
            seenHeaderKeys.add(key)
            doc.targetDate = res.date
            doc.dateKind = res.kind
          } else if (currentMilestone) {
            seenMilestoneTarget = true
            currentMilestone.targetDate = res.date
            currentMilestone.dateKind = res.kind
          }
          return
        }
        if (seenHeaderKeys.has(key)) {
          err(lineNo, `Duplicate "${key}:"`)
          return
        }
        seenHeaderKeys.add(key)
        if (key === 'outcome') {
          doc.outcome = value
        } else if (!/^\d+$/.test(value) || Number(value) < 1) {
          err(lineNo, `Bad min-per-week "${value}" (expected a whole number of at least 1)`)
        } else {
          doc.weeklyMin = Number(value)
        }
        return
      }

      warn(lineNo, `Unknown key "${kv[1]}:" ignored`)
      return
    }

    const shown = trimmed.length > 40 ? `${trimmed.slice(0, 40)}…` : trimmed
    warn(lineNo, `Unrecognized line ignored: "${shown}"`)
  })
  finishTask()

  if (!seenHeader) err(0, 'Missing the "# Project name" header')

  checkDependencies(doc, issues)

  issues.sort((a, b) => a.line - b.line)
  const hasError = issues.some((i) => i.severity === 'error')
  return { doc: hasError ? null : doc, issues }
}

function allTasks(doc: OutlineDoc): OutlineTask[] {
  return [...doc.tasks, ...doc.milestones.flatMap((m) => m.tasks)]
}

/** Duplicate keys, unknown `after:` references and dependency cycles. */
function checkDependencies(doc: OutlineDoc, issues: OutlineIssue[]): void {
  const err = (line: number, message: string) => issues.push({ line, message, severity: 'error' })
  const byKey = new Map<string, OutlineTask>()
  const tasks = allTasks(doc)
  for (const task of tasks) {
    if (task.key === null) continue
    if (byKey.has(task.key)) err(task.line ?? 0, `Duplicate key #${task.key}`)
    else byKey.set(task.key, task)
  }
  for (const task of tasks) {
    for (const k of task.after) {
      if (!byKey.has(k)) err(task.line ?? 0, `Unknown key #${k} in after:`)
    }
  }

  // Cycle detection (DFS with colours) over keyed tasks.
  const state = new Map<string, 'visiting' | 'done'>()
  const stack: string[] = []
  const visit = (key: string) => {
    state.set(key, 'visiting')
    stack.push(key)
    const task = byKey.get(key)
    for (const next of task?.after ?? []) {
      if (!byKey.has(next)) continue
      if (next === key) {
        err(task?.line ?? 0, `Task #${key} depends on itself`)
      } else if (state.get(next) === 'visiting') {
        const cycle = [...stack.slice(stack.indexOf(next)), next].map((k) => `#${k}`).join(' → ')
        err(task?.line ?? 0, `Dependency cycle: ${cycle}`)
      } else if (!state.has(next)) {
        visit(next)
      }
    }
    stack.pop()
    state.set(key, 'done')
  }
  for (const key of byKey.keys()) if (!state.has(key)) visit(key)
}

// ---------------------------------------------------------------------------------------------------------
// Serializing
// ---------------------------------------------------------------------------------------------------------

const oneLine = (s: string): string => s.replace(/\s*\r?\n\s*/g, ' ').trim()

/** Canonical text. parseOutline(serializeOutline(d)).doc equals d (ignoring `line`). */
export function serializeOutline(doc: OutlineDoc): string {
  const out: string[] = []
  const blank = () => {
    if (out.length > 0 && out[out.length - 1] !== '') out.push('')
  }

  const pushTask = (t: OutlineTask) => {
    let line = `- ${oneLine(t.title)} [${t.size}]`
    if (t.key) line += ` #${t.key}`
    if (t.after.length > 0) line += ` after:${t.after.map((k) => `#${k}`).join(',')}`
    if (t.anytime) line += ' anytime'
    out.push(line)
    if (t.doneWhen.trim() !== '') out.push(`  done: ${oneLine(t.doneWhen)}`)
    if (t.notes !== '') {
      for (const note of t.notes.split(/\r?\n/)) out.push(`  note: ${note.trim()}`.trimEnd())
    }
    for (const c of t.checklist) out.push(`  - [${c.done ? 'x' : ' '}] ${oneLine(c.text)}`)
  }

  out.push(`# ${oneLine(doc.name)}`)
  if (doc.outcome.trim() !== '') out.push(`outcome: ${oneLine(doc.outcome)}`)
  if (doc.targetDate) out.push(`target: ${doc.targetDate} ${doc.dateKind}`)
  if (doc.weeklyMin !== null) out.push(`min-per-week: ${doc.weeklyMin}`)
  blank()
  for (const t of doc.tasks) pushTask(t)
  for (const m of doc.milestones) {
    blank()
    out.push(`## ${oneLine(m.name)}`)
    if (m.targetDate) out.push(`target: ${m.targetDate} ${m.dateKind ?? 'soft'}`)
    for (const t of m.tasks) pushTask(t)
  }
  while (out.length > 0 && out[out.length - 1] === '') out.pop()
  return out.join('\n') + '\n'
}

// ---------------------------------------------------------------------------------------------------------
// Doc <-> entities
// ---------------------------------------------------------------------------------------------------------

export interface DocToBundleOptions {
  /** Rank for the new project (caller passes max existing rank + 1). */
  rank: number
  /** Field overrides for the new project (e.g. name/outcome/target chosen in the "new from template" form). */
  project?: Partial<Pick<Project, 'name' | 'outcome' | 'targetDate' | 'dateKind' | 'weeklyMin' | 'status'>>
}

/**
 * New entities for a project created from a doc: one Project, its Milestones (position = order),
 * Tasks (position = order within group, status todo), Dependencies, ChecklistItems.
 * Dependencies: a task with `after:` waits for exactly those tasks; otherwise it waits for the previous task
 * in its group, unless it is marked `anytime` (or is the group's first task).
 * Uses the factories in ./factories (fresh ids).
 */
export function docToBundle(doc: OutlineDoc, opts: DocToBundleOptions): EntityBundle {
  const overrides = Object.fromEntries(
    Object.entries(opts.project ?? {}).filter(([, v]) => v !== undefined),
  ) as NonNullable<DocToBundleOptions['project']>
  const project = makeProject({
    name: doc.name,
    outcome: doc.outcome,
    targetDate: doc.targetDate,
    dateKind: doc.dateKind,
    weeklyMin: doc.weeklyMin,
    ...overrides,
    rank: opts.rank,
  })

  const bundle: EntityBundle = {
    projects: [project],
    milestones: [],
    tasks: [],
    dependencies: [],
    checklist: [],
  }
  const idByKey = new Map<string, string>()
  const pending: { taskId: string; after: string[] }[] = []

  const addTasks = (tasks: OutlineTask[], milestoneId: string | null) => {
    let previousId: string | null = null
    tasks.forEach((t, position) => {
      const task = makeTask({
        projectId: project.id,
        milestoneId,
        title: t.title,
        notes: t.notes,
        doneWhen: t.doneWhen,
        size: t.size,
        position,
        status: 'todo',
      })
      bundle.tasks.push(task)
      if (t.key !== null && !idByKey.has(t.key)) idByKey.set(t.key, task.id)
      if (t.after.length > 0) pending.push({ taskId: task.id, after: t.after })
      else if (previousId !== null && !t.anytime)
        bundle.dependencies.push({ taskId: task.id, blockedByTaskId: previousId })
      previousId = task.id
      t.checklist.forEach((c, i) => {
        bundle.checklist.push(makeChecklistItem({ taskId: task.id, text: c.text, done: c.done, position: i }))
      })
    })
  }

  addTasks(doc.tasks, null)
  doc.milestones.forEach((m, position) => {
    const milestone = makeMilestone({
      projectId: project.id,
      name: m.name,
      position,
      targetDate: m.targetDate,
      dateKind: m.dateKind,
    })
    bundle.milestones.push(milestone)
    addTasks(m.tasks, milestone.id)
  })

  for (const { taskId, after } of pending) {
    for (const key of after) {
      const blockedByTaskId = idByKey.get(key)
      if (blockedByTaskId !== undefined && blockedByTaskId !== taskId) {
        bundle.dependencies.push({ taskId, blockedByTaskId })
      }
    }
  }
  return bundle
}

/**
 * Doc describing an existing project (used for "save as template"). Includes every task regardless of
 * status, in workflow order. Links are written so that docToBundle recreates them (see linkKind below); tasks
 * referenced by an after: list get generated keys (t1, t2, …).
 * Checklist items keep their done flag; milestone order follows position.
 */
export function projectToDoc(
  projectId: string,
  snapshot: Pick<Snapshot, 'projects' | 'milestones' | 'tasks' | 'dependencies' | 'checklist'>,
): OutlineDoc {
  const project = snapshot.projects.find((p) => p.id === projectId)
  if (!project) throw new Error(`Project not found: ${projectId}`)

  const milestones = snapshot.milestones
    .filter((m) => m.projectId === projectId)
    .sort((a, b) => a.position - b.position)
  const projectTasks = snapshot.tasks.filter((t) => t.projectId === projectId)
  const byPosition = (a: Task, b: Task) => a.position - b.position
  const ungrouped = projectTasks.filter((t) => t.milestoneId === null).sort(byPosition)
  const groups: { milestone: Milestone; tasks: Task[] }[] = milestones.map((m) => ({
    milestone: m,
    tasks: projectTasks.filter((t) => t.milestoneId === m.id).sort(byPosition),
  }))

  const ordered = [...ungrouped, ...groups.flatMap((g) => g.tasks)]
  const inProject = new Set(ordered.map((t) => t.id))
  const deps = snapshot.dependencies.filter(
    (d) => inProject.has(d.taskId) && inProject.has(d.blockedByTaskId) && d.taskId !== d.blockedByTaskId,
  )
  const orderIndex = new Map(ordered.map((t, i) => [t.id, i]))
  const blockersOf = (t: Task): string[] => [
    ...new Set(
      deps
        .filter((d) => d.taskId === t.id)
        .map((d) => d.blockedByTaskId)
        .sort((a, b) => (orderIndex.get(a) ?? 0) - (orderIndex.get(b) ?? 0)),
    ),
  ]
  // How each task's links are written: a lone link to the previous task in its group is the format's default;
  // no links after a previous task is `anytime`; anything else is an explicit after: list.
  const linkKind = new Map<string, 'default' | 'anytime' | string[]>()
  for (const group of [ungrouped, ...groups.map((g) => g.tasks)]) {
    group.forEach((t, i) => {
      const blockers = blockersOf(t)
      const previous = group[i - 1]
      if (previous && blockers.length === 1 && blockers[0] === previous.id) linkKind.set(t.id, 'default')
      else if (blockers.length === 0) linkKind.set(t.id, previous ? 'anytime' : 'default')
      else linkKind.set(t.id, blockers)
    })
  }
  const referenced = new Set([...linkKind.values()].flatMap((k) => (Array.isArray(k) ? k : [])))
  const keyById = new Map<string, string>()
  for (const t of ordered) if (referenced.has(t.id)) keyById.set(t.id, `t${keyById.size + 1}`)

  const toOutlineTask = (t: Task): OutlineTask => {
    const kind = linkKind.get(t.id)
    return {
      title: t.title,
      size: t.size,
      key: keyById.get(t.id) ?? null,
      after: Array.isArray(kind) ? kind.map((id) => keyById.get(id) as string) : [],
      ...(kind === 'anytime' ? { anytime: true as const } : {}),
      doneWhen: t.doneWhen,
      notes: t.notes,
      checklist: snapshot.checklist
        .filter((c) => c.taskId === t.id)
        .sort((a, b) => a.position - b.position)
        .map((c) => ({ text: c.text, done: c.done })),
    }
  }

  return {
    name: project.name,
    outcome: project.outcome,
    targetDate: project.targetDate,
    dateKind: project.dateKind,
    weeklyMin: project.weeklyMin,
    tasks: ungrouped.map(toOutlineTask),
    milestones: groups.map((g) => ({
      name: g.milestone.name,
      targetDate: g.milestone.targetDate,
      dateKind: g.milestone.dateKind,
      tasks: g.tasks.map(toOutlineTask),
    })),
  }
}
