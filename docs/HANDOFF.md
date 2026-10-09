# Handoff: verify the live site, fix real-data issues, then keep iterating

Snapshot taken 2026-10-09. `main` and `claude/wizardly-ride-09zaaj` are identical at `360a330`.

**Purpose of the next session.** First, the user tries the new features on the live site and reports errors.
Fix those errors. Then continue with feature requests in the same style as the last session.

Read `README.md` (features) and `CLAUDE.md` (conventions and design rules) first. The work of the last session is
in the 10 commits `5edae2d..360a330` (`git log 5edae2d..360a330`). Each commit message describes its change.

## State

- **Live:** Vercel deploys `main`. The PR preview is https://tcgmpersonaldash.vercel.app. The production URL
  was never shared in the session, so ask the user if you need it.
- **Supabase:** the user ran all seven parts in `supabase/migrations/` (0001–0007). Any schema change needs a new
  `0008_…sql` file, and the user must run it **before** the code reaches `main`. Code that is deployed before its
  migration breaks loading and saving for the whole app. Follow the existing files: they are idempotent, check
  that the previous part ran, end with a summary query, and come with a "PART n of N" header. When you add a
  part, update the other files' "of N" headers, `docs/setup.md` and `supabase/README.md`.
- **Google Calendar:** dropped by the user ("forget about it"). The code remains. Settings still shows a
  "VITE_GOOGLE_CLIENT_ID is missing" block. The session offered to hide that block when it isn't configured, but
  the user never answered.
- **PR:** [tarekcmahmoud/PersonalDash#1](https://github.com/tarekcmahmoud/PersonalDash/pull/1) (opened by the
  user from the UI). Its **base is the old branch `claude/multi-project-task-planner-d7gcr3`**, not `main`.
  Everything in it is already on `main`. The user hasn't yet chosen between two options: keep pushing straight
  to `main`, or retarget the PR to `main` and merge through it. The last session subscribed to PR activity and
  armed a `send_later` check-in (`trig_01FZ2n1FsKsG2aqma5CVftit`). Delete it if it's still pending and no longer
  wanted.
- **Checks at `360a330`:** typecheck, lint, 557 unit tests and 16 Playwright tests (desktop and phone, memory
  mode) pass. `src/data/supabaseRepo.local.test.ts` passes, 8 of 8, against the local stack.

## What to verify on the live site (never run against real Supabase)

Ask the user to try each item and to report anything that breaks or isn't saved after a reload:

1. **Delegation** (parts 7 and `360a330`):
   - add collaborators through the project's **…** menu
   - **Delegate to…** from a task's **…** menu
   - the Delegated page
   - a follow-up due on Today
2. **Substreams** (part 6): **Add substream**, dragging tasks between cards, deleting a workstream that has
   substreams.
3. **Task links:** **Waits for…** from a task's **…** menu, and the connector lines.
4. **Resource image uploads** (Storage, part 5). This is the one data path with no local stand-in.

All other data paths pass against real PostgREST and Postgres locally. The stack is in `supabase/local/`, and its
`README.md` covers both running it and the "not covered" list.

## Conventions the user relies on

- The user writes "push" to mean push to `main`, after the checks pass. Push to `claude/wizardly-ride-09zaaj`
  first. Fast-forward `main` with `git push origin HEAD:main` only after the user says "push".
- Before any push, run `npm run typecheck && npm run lint && npm test && npm run e2e`.
- The user sends short requests, often while you're mid-task. Answer briefly, do the work, and show screenshots
  of UI changes (Playwright with `executablePath: '/opt/pw-browsers/chromium'`, desktop 1280px and phone 390px).
- `CLAUDE.md` calls the contracts frozen. The user explicitly asked for this session's changes to them:
  `Milestone.parentId`, `Person`, `Project.collaboratorIds`, `Task.assigneeId`, and the Change kinds
  `savePeople` and `deletePerson`.
- The demo data in `src/data/seed.ts` feeds the unit and e2e tests. The Kitchen renovation project holds the
  substream example. The delegated example's follow-up is set 15 days out so that this week's and next week's
  numbers don't change.

## Gotchas found this session

- **No access to Supabase or Vercel from the container** (both blocked). Use the local stack:
  `supabase/local/start.sh /var/tmp/pd-supabase`. The work dir must be under `/var/tmp`: the scratchpad's
  directory permissions get reset, which kills Postgres. The stack also stops when the container idles, so
  restart it, after removing `data/`, if you get connection errors.
- **Killing processes:**
  - Never `pkill -f` a pattern that occurs in your own command line; it kills your shell (exit 144).
  - Use bracketed patterns, e.g. `pgrep -f "gateway[.]mjs"`.
  - Start a server and kill it in separate commands.
- **Never run `prettier --write src` as a whole.** It reformats the vendored `src/styles/shadcn-tailwind.css`.
  Format only the files you touched.
- **React Compiler lint rules (`eslint-plugin-react-hooks` v7):**
  - no `setState` inside an effect body: use observer callbacks instead (see `src/ui/project/LinkRails.tsx`)
  - no reading refs during render: pass elements through state
- **Radix submenus don't open by pointer in jsdom.** Open them with the keyboard in tests (`focus()`, then
  ArrowRight, then Enter). See `ProjectPage.test.tsx`.
- **Drag tests in Playwright:** use a tall viewport. dnd-kit auto-scrolls near the edges and shifts the target
  under the pointer (see `e2e/substreams.spec.ts`).

## Open product questions (ask when relevant)

- **Week board:** 8 columns at 1280px truncate project names. The alternative is 4 columns on 2 rows.
- **"Next":** marks the first ready task in each workstream or substream, including a delegated one. Your own
  other ready tasks are full strength but not marked "Next".
- **Phones:** dragging between lists is desktop-only. On phones, the task dialog's **Workstream** field moves a
  task.
- **Not done yet:** a security review of the database access rules, file storage, sign-in and the public key
  (suggested twice, never run).

## Suggested skills for the next session

- **`run`:** launch the app (`npm run dev:memory`) and screenshot changes.
- **`anthropic-skills:chrome-browser` or `anthropic-skills:built-in-browser`**, if available: look at the live
  site and its console errors with the user's sign-in.
- **`read_documentation`** (`environment.network`): if the user wants the container to reach their
  `*.supabase.co` or Vercel host directly.
- **`security-review`:** the pending review above.
- **`code-review`:** on fixes to `src/data/supabaseRepo.ts` or the migrations.
- **`session-start-hook`** (optional): run `npm ci` automatically at session start.
