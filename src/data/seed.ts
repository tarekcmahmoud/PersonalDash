import {
  makeChecklistItem,
  makeMilestone,
  makeProject,
  makeSystemProject,
  makeTask,
  makeTemplate,
} from '../domain/factories'
import { addDaysISO, addWeeksISO, isInWeek, weekStartOf } from '../domain/week'
import { DEFAULT_SETTINGS, type Dependency, type Snapshot } from '../domain/types'

/**
 * Demo data for memory mode, relative to `today`: 4 active projects (one with a hard deadline within
 * 10 days, one with weeklyMin 2, one with no tasks planned this week → neglected), 1 on-hold project, the
 * system Admin/Misc project, milestones, ~30 tasks across sizes incl. one XL, one waiting task with a
 * follow-up date this week, a few done last week, some planned this week (one pinned to today), one
 * explicit dependency, a checklist, 2 Inbox tasks, 1 template, DEFAULT_SETTINGS.
 */
export function seedSnapshot(today: string): Snapshot {
  const ws = weekStartOf(today)
  const lastWeek = addWeeksISO(ws, -1)
  // A completion timestamp on a day of last week.
  const doneLastWeek = (dayOffset: number): string => `${addDaysISO(lastWeek, dayOffset)}T16:00:00.000Z`

  // --- 1. Client website redesign (hard deadline in 9 days) -------------------------------------------
  const system = makeSystemProject()
  const website = makeProject({
    name: 'Client website redesign',
    outcome: 'New site is live and signed off by the client',
    targetDate: addDaysISO(today, 9),
    dateKind: 'hard',
    rank: 1,
  })
  const discovery = makeMilestone({
    projectId: website.id,
    name: 'Discovery',
    position: 0,
    targetDate: addDaysISO(lastWeek, 4),
    dateKind: 'soft',
  })
  const design = makeMilestone({
    projectId: website.id,
    name: 'Design',
    position: 1,
    targetDate: addDaysISO(today, 3),
    dateKind: 'soft',
  })
  const build = makeMilestone({
    projectId: website.id,
    name: 'Build',
    position: 2,
    targetDate: addDaysISO(today, 9),
    dateKind: 'hard',
  })

  const kickoff = makeTask({
    projectId: website.id,
    milestoneId: discovery.id,
    title: 'Kickoff call with client',
    size: 'S',
    position: 0,
    status: 'done',
    weekStart: lastWeek,
    completedAt: doneLastWeek(1),
  })
  const audit = makeTask({
    projectId: website.id,
    milestoneId: discovery.id,
    title: 'Audit current site',
    size: 'M',
    position: 1,
    status: 'done',
    weekStart: lastWeek,
    completedAt: doneLastWeek(2),
  })
  const interviews = makeTask({
    projectId: website.id,
    milestoneId: discovery.id,
    title: 'Stakeholder interviews',
    size: 'M',
    position: 2,
    status: 'done',
    weekStart: lastWeek,
    completedAt: doneLastWeek(3),
  })
  const sitemap = makeTask({
    projectId: website.id,
    milestoneId: design.id,
    title: 'Draft sitemap',
    size: 'M',
    position: 0,
    weekStart: ws,
    notes: 'Use the audit export to decide which legacy pages survive.',
  })
  const homepageDesign = makeTask({
    projectId: website.id,
    milestoneId: design.id,
    title: 'Design homepage',
    size: 'L',
    position: 1,
    weekStart: ws,
    pinnedDay: today,
  })
  const contentTemplates = makeTask({
    projectId: website.id,
    milestoneId: design.id,
    title: 'Design content page templates',
    size: 'M',
    position: 2,
  })
  const stagingSetup = makeTask({
    projectId: website.id,
    milestoneId: build.id,
    title: 'Set up staging environment',
    size: 'S',
    position: 0,
  })
  const cmsIntegration = makeTask({
    projectId: website.id,
    milestoneId: build.id,
    title: 'Build CMS integration',
    size: 'XL',
    position: 1,
    notes: 'Too big to schedule as is. Split into content model, editor and publishing first.',
  })
  const buildHomepage = makeTask({
    projectId: website.id,
    milestoneId: build.id,
    title: 'Build homepage',
    size: 'L',
    position: 2,
  })
  const buildContentPages = makeTask({
    projectId: website.id,
    milestoneId: build.id,
    title: 'Build content pages',
    size: 'M',
    position: 3,
  })

  const sitemapChecklist = [
    makeChecklistItem({ taskId: sitemap.id, text: 'Review analytics with client', done: true, position: 0 }),
    makeChecklistItem({ taskId: sitemap.id, text: 'List every existing URL', done: true, position: 1 }),
    makeChecklistItem({ taskId: sitemap.id, text: 'Agree page hierarchy', position: 2 }),
  ]

  // --- 2. Quarterly board report (soft target, weeklyMin 2, one waiting task) ---------------------------
  const board = makeProject({
    name: 'Quarterly board report',
    outcome: 'Board pack sent with Q3 numbers and a clear risk summary',
    targetDate: addDaysISO(today, 30),
    dateKind: 'soft',
    rank: 2,
    weeklyMin: 2,
  })
  const revenueNumbers = makeTask({
    projectId: board.id,
    title: 'Pull Q3 revenue numbers',
    size: 'M',
    position: 0,
    weekStart: ws,
  })
  const riskSummary = makeTask({
    projectId: board.id,
    title: 'Draft risk summary',
    size: 'M',
    position: 1,
  })
  const costFigures = makeTask({
    projectId: board.id,
    title: 'Collect final cost figures',
    size: 'S',
    position: 2,
    status: 'waiting',
    waitingOn: 'Finance team',
    followUpDate: isInWeek(addDaysISO(today, 1), ws) ? addDaysISO(today, 1) : today,
  })
  const kpiSlides = makeTask({
    projectId: board.id,
    title: 'Update KPI slides',
    size: 'S',
    position: 3,
  })

  // --- 3. Hire a designer (soft target, nothing planned this week) --------------------------------------
  const designer = makeProject({
    name: 'Hire a designer',
    outcome: 'An offer is accepted by a designer who can start in November',
    targetDate: addDaysISO(today, 45),
    dateKind: 'soft',
    rank: 3,
  })
  const budget = makeTask({
    projectId: designer.id,
    title: 'Agree budget and contract type',
    size: 'S',
    position: 0,
    // Left over from last week (and the week before): shows up in the weekly review.
    weekStart: lastWeek,
    slipCount: 1,
  })
  const publishPost = makeTask({
    projectId: designer.id,
    title: 'Publish job post',
    size: 'S',
    position: 1,
  })
  const writeInterviewPlan = makeTask({
    projectId: designer.id,
    title: 'Write interview plan',
    size: 'M',
    position: 2,
  })
  const reviewApplications = makeTask({
    projectId: designer.id,
    title: 'Review applications and shortlist',
    size: 'M',
    position: 3,
  })
  const runInterviews = makeTask({
    projectId: designer.id,
    title: 'Run interviews with shortlisted candidates',
    size: 'L',
    position: 4,
  })
  const makeOffer = makeTask({
    projectId: designer.id,
    title: 'Make offer and sign contract',
    size: 'S',
    position: 5,
  })

  // --- 4. Personal: run a half marathon (one planned this week) -----------------------------------------
  const marathon = makeProject({
    name: 'Personal: run a half marathon',
    outcome: 'Finish a half marathon in under two hours',
    targetDate: addDaysISO(today, 120),
    dateKind: 'soft',
    rank: 4,
  })
  const trainingPlan = makeTask({
    projectId: marathon.id,
    title: 'Pick a training plan',
    size: 'S',
    position: 0,
    weekStart: lastWeek, // left over from last week
  })
  const shoes = makeTask({
    projectId: marathon.id,
    title: 'Buy proper running shoes',
    size: 'S',
    position: 1,
  })
  const longRun = makeTask({
    projectId: marathon.id,
    title: 'Long run: 12 km',
    size: 'M',
    position: 2,
    weekStart: ws,
  })
  const bookRace = makeTask({
    projectId: marathon.id,
    title: 'Book race entry',
    size: 'S',
    position: 3,
  })
  const build15 = makeTask({
    projectId: marathon.id,
    title: 'Build up to a 15 km long run',
    size: 'L',
    position: 4,
  })

  // --- 5. Kitchen renovation (on hold) ------------------------------------------------------------------
  const kitchen = makeProject({
    name: 'Kitchen renovation',
    outcome: 'New kitchen installed and the old one fully removed',
    targetDate: addDaysISO(today, 200),
    dateKind: 'soft',
    status: 'on_hold',
    rank: 5,
  })
  const quotes = makeTask({
    projectId: kitchen.id,
    title: 'Get three quotes from contractors',
    size: 'M',
    position: 0,
  })
  const colours = makeTask({
    projectId: kitchen.id,
    title: 'Choose cabinet and worktop colours',
    size: 'S',
    position: 1,
  })
  const electrician = makeTask({
    projectId: kitchen.id,
    title: 'Confirm electrician schedule',
    size: 'S',
    position: 2,
  })

  // --- Admin / Misc (system project) and Inbox ----------------------------------------------------------
  const dentist = makeTask({
    projectId: system.id,
    title: 'Book dentist appointment',
    size: 'S',
    position: 0,
    weekStart: ws,
  })
  const insurance = makeTask({
    projectId: system.id,
    title: 'Renew car insurance',
    size: 'S',
    position: 1,
  })
  const passport = makeTask({ projectId: null, title: 'Renew passport', size: 'S', position: 0 })
  const replySam = makeTask({
    projectId: null,
    title: 'Reply to Sam about conference',
    size: 'S',
    position: 1,
  })

  const dependencies: Dependency[] = [{ taskId: reviewApplications.id, blockedByTaskId: publishPost.id }]

  const template = makeTemplate({
    name: 'Client engagement',
    outline: [
      '# Client engagement',
      'outcome: Client has signed off the deliverables and the final invoice is paid',
      '',
      '## Kickoff',
      '- Send kickoff agenda and access request [S]',
      '- Hold kickoff call with client [M]',
      '  done: agenda agreed and owners named',
      '- Set up shared project folder [S]',
      '',
      '## Discovery',
      '- Review brief and existing materials [M]',
      '- Stakeholder interviews [L]',
      '  - [ ] Schedule interviews',
      '- Write discovery summary [M] #summary',
      '',
      '## Delivery',
      '- Draft proposal and scope [L]',
      '- Produce first deliverable [XL] after:#summary',
      '- Client review round [M]',
      '',
      '## Wrap-up',
      '- Collect client feedback [S]',
      '- Archive project files [S]',
      '- Send final invoice [S]',
    ].join('\n'),
  })

  return {
    projects: [system, website, board, designer, marathon, kitchen],
    milestones: [discovery, design, build],
    tasks: [
      kickoff,
      audit,
      interviews,
      sitemap,
      homepageDesign,
      contentTemplates,
      stagingSetup,
      cmsIntegration,
      buildHomepage,
      buildContentPages,
      revenueNumbers,
      riskSummary,
      costFigures,
      kpiSlides,
      budget,
      publishPost,
      writeInterviewPlan,
      reviewApplications,
      runInterviews,
      makeOffer,
      trainingPlan,
      shoes,
      longRun,
      bookRace,
      build15,
      quotes,
      colours,
      electrician,
      dentist,
      insurance,
      passport,
      replySam,
    ],
    dependencies,
    checklist: sitemapChecklist,
    templates: [template],
    weeks: [],
    settings: structuredClone(DEFAULT_SETTINGS),
  }
}

/** Empty snapshot: DEFAULT_SETTINGS + the system project only. */
export function emptySnapshot(): Snapshot {
  return {
    projects: [makeSystemProject()],
    milestones: [],
    tasks: [],
    dependencies: [],
    checklist: [],
    templates: [],
    weeks: [],
    settings: structuredClone(DEFAULT_SETTINGS),
  }
}
