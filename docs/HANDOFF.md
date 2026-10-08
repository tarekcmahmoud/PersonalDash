# Handoff: take PersonalDash live and fix real-data issues

**Goal of the next session:** finish the go-live (Supabase, Vercel, optional Google Calendar). Then sign in on
the live site and fix whatever breaks against real services.

Snapshot taken 2026-10-08. `main` and `claude/multi-project-task-planner-d7gcr3` are identical, at `0eb5fe3`
or later.

## Where things stand

- **App:** feature-complete v1.
  - Screens: Today, Week (drag tasks between days), Plan, Weekly review, Projects (masonry of cards), Project page
    (parallel workstreams on the left, resources on the right, workstream focus mode), Inbox, Import, Templates,
    Settings.
  - Design: shadcn/ui, Rhea style, yellow accent, grey page.
  - Product overview: `README.md`. Conventions and design rules: `CLAUDE.md`. Read both first.
- **Verified so far:** typecheck, lint, 509 unit tests and 15 Playwright tests (memory mode, desktop and phone)
  all pass. **But the app has never run against a real Supabase project or real Google APIs.** Those paths have
  only been checked in these ways:
  - Supabase data layer: mappers have unit tests. `src/data/supabaseRepo.ts` now passes an integration test
    (`src/data/supabaseRepo.local.test.ts`) against real PostgREST + Postgres with the migrations. The stack
    is in `supabase/local/`, and auth there is a fake gateway. The test covers first load, concurrent first loads,
    `insertBundle`, `setDependencies`, cascades, the system-project guard, paging past 1000 rows and RLS between
    two users. The UI was also smoke-tested in supabase mode against that stack: sign-in, capture, import,
    settings and sign-out. It found one bug, now fixed: timestamps came back as `+00:00` strings.
  - SQL: validated on a local Postgres 16 with stubbed `auth`/`storage` schemas (recipe below).
  - Google Calendar code: tested against mocked `fetch` and a mocked `google` global only.
- **GitHub:** works from cloud sessions. Vercel deploys from GitHub.

## What the user has done, and what's still open

| Step                                                          | Status                                                                                                                                                                                                                                                                                                                         |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| GitHub repo + Claude GitHub App                               | Done                                                                                                                                                                                                                                                                                                                           |
| Vercel project linked                                         | Done (user said so). **Unconfirmed:** production branch = `main`; env vars set; redeployed after setting them                                                                                                                                                                                                                  |
| Supabase parts 1–3 (`supabase/migrations/0001…0003`)          | **Unconfirmed.** Two earlier attempts failed because pastes were truncated: "syntax error at or near `;`" at line 100, then "relation public.projects does not exist". The script was then split into short, idempotent parts that each check the previous part ran. Ask the user to re-run and send the part 3 summary output |
| Supabase parts 4–5 (`0004_resources.sql`, `0005_storage.sql`) | **Not run yet** (new)                                                                                                                                                                                                                                                                                                          |
| Supabase part 6 (`0006_substreams.sql`)                       | **Not run yet** (new: `milestones.parent_id` for substreams). Must run before deploying the substreams code, or saving workstreams fails                                                                                                                                                                                       |
| Supabase user + sign-ups off + Site URL                       | Not confirmed                                                                                                                                                                                                                                                                                                                  |
| Google Calendar OAuth client                                  | Not started (optional)                                                                                                                                                                                                                                                                                                         |

Step-by-step instructions for the user are in `docs/setup.md` (sections 1–3, plus troubleshooting) and
`supabase/README.md`. Point the user there rather than rewriting them. Expected Vercel env vars:
`VITE_DATA_MODE=supabase`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and optionally `VITE_GOOGLE_CLIENT_ID`.
Without `VITE_DATA_MODE=supabase` the live site silently runs in demo (memory) mode.

## Likely real-data problems to watch for

1. **Supabase repo behaviour** (`src/data/supabaseRepo.ts`), all unverified against a real project:
   - first load creating default settings and the Admin/Misc system project
   - paging
   - `insertBundle` FK order
   - `setDependencies` upsert-then-prune
   - timestamps coming back as `+00:00` strings
2. **Part 5 (storage):** the `insert into storage.buckets (…, file_size_limit, allowed_mime_types)` may fail if
   Supabase's columns differ. The fallback is to create the bucket in Dashboard → Storage (private, 5 MB,
   `image/*`); the policies still apply. Uploads go to `resource-images/<userId>/<uuid>.<ext>`, and images are
   shown through 1-hour signed URLs (`useImageSrc` in `src/data/hooks.ts`).
3. **Auth:** sign-in is email + password (`LoginPage`). `RequireAuth` redirects; there's no sign-up flow by
   design.
4. **Google Calendar** (`src/integrations/gcal/*`):
   - browser-only GIS token flow; tokens last about 1 hour
   - the "Reconnect calendar" line appears when the token expires
   - the scopes are `calendar.events.readonly` and `calendar.app.created`
   - `calendarExists` under the `calendar.app.created` scope is an untested assumption
   - the GIS script is preloaded on Settings; the consent popup may be blocked if the click happens before it loads
5. **Optimistic writes:** `useApply` rolls back on error. Watch for toasts or rollbacks that point to RLS or
   column mismatches.

## Environment constraints (cloud container)

- **Blocked egress:** `api.supabase.com` (and likely `*.supabase.co`) and the shadcn registry. The session can't
  reach the user's Supabase project, so debugging means asking the user for error text or screenshots, or
  getting the host allowed. Call `read_documentation` with topic `environment.network`. The GitHub raw host is
  reachable.
- **Local Postgres 16** is at `/usr/lib/postgresql/16/bin`. The validation recipe:
  - `runuser -u postgres -- initdb/pg_ctl` into a scratchpad dir, after `chmod o+x` on the path (don't use
    `su -c` scripts; a safety check blocks them)
  - stub `auth.users`, `auth.uid()` (reads `request.jwt.claim.sub`), the `authenticated` role, and a minimal
    `storage` schema (`buckets`, `objects`, `foldername()`)
  - run parts 1–5 twice, then smoke-test RLS between two users, the system-project guard, cascades, and the
    storage folder policies

  The scripts weren't committed; they're easy to recreate from this description.

- **Playwright:** uses the pre-installed Chromium at `/opt/pw-browsers/chromium`. Don't run `playwright install`.
- When killing dev servers, use a pattern that can't match your own shell, e.g. `pkill -f "port 519[4]"`.

## Working conventions used so far

- An orchestrator plus lower-cost agents (Sonnet or Haiku) in git worktrees, each owning separate files. The
  orchestrator reviews, merges, runs all checks and pushes. The user asked for this delegation style.
- Push to the branch; update `main` only when the user asks ("push" / "merge to main" has meant updating
  `main`). `main` is what Vercel deploys.
- Before any push: `npm run typecheck && npm run lint && npm test && npm run e2e`.

## Open product assumptions to confirm with the user

- Meetings reduce weekly capacity (an assumption; the user's answers were ambiguous).
- The Week board fits 8 columns at 1280px, so project names truncate. The alternative is 4 columns on 2 rows.
- "Connect Google Calendar" is a grey button because "Save settings" is the page's single yellow button.

## Suggested skills for the next session

- **`run`**: launch the app (`npm run dev:memory`, or supabase mode with a local `.env.local`) and look at screens.
- **`security-review`**: before real data lands, review RLS, storage policies, the anon key exposure and auth flows.
- **`code-review`**: on any fixes to `supabaseRepo.ts` and `src/integrations/gcal/*`.
- **`read_documentation`** (`environment.network`, `environment.secrets`): if the session needs to reach
  Supabase or Google, or hold test credentials.
- **`anthropic-skills:chrome-browser` / `anthropic-skills:built-in-browser`**: if available, inspect the live
  Vercel site, its console errors and the Supabase dashboard with the user's own sign-ins.
- **`session-start-hook`**: optional, so cloud sessions run `npm ci` automatically.
