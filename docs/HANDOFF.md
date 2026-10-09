# Handoff: collect usage feedback, then compile improvements

Snapshot taken 2026-10-09. The last commit is "Schedule tasks for next week", on `claude/awesome-wright-e3f1gq`
and on `main`, which Vercel deploys.

**Purpose of the next session.** The product is done for now. The user will use it day to day and bring
feedback, probably in short notes over several messages. Collect the notes, then compile them into one
prioritized list of improvements. Don't build anything until the user picks items from that list.

Read `README.md` (features) and `CLAUDE.md` (conventions and design rules) first. Read the git log for the
details of a change: every commit message describes it. Most of this session's work is in
`git log 360a330..06a8415`.

## How to run the next session

1. **Gather feedback.**
   - Record each note in the user's own words.
   - Ask a short question only when a note is ambiguous, for example which screen, phone or desktop, or what
     the user expected.
   - Ask for a screenshot when it would settle the question.
   - Don't propose fixes while gathering, unless the user asks.
2. **Compile.** Once the user says the list is complete, group the notes by screen or theme. For each item give:
   - the problem, as the user experienced it
   - a proposed change, in a sentence or two
   - its size (S/M/L)
   - whether it needs a database change (see "Schema changes" below)
   - any open question

   Put quick wins first. Flag items that conflict with the design rules in `CLAUDE.md`, and items that undo a
   decision listed below.

3. **Ask** whether the user wants the list as a shareable doc or kept in chat, and which items to build first.
4. **Build** in the same style as before: short requests, quick turns, screenshots of each UI change, push to
   `main` only when the user says "push".

## What changed this session (all on `main`)

The Today and Week items below came out of user requests in this session.

- **Delegated work:**
  - Delegated follow-ups are now separate from your own tasks: in a "Delegated" card at the bottom of Today,
    and in a card under each day on Week.
  - The cards are deliberately quiet: no fill or shadow, grey text. Overdue follow-ups stay red.
  - Each follow-up shows where its task lives ("Project · Workstream", or the substream's name when the task is
    in one).
- **Week board (desktop, 1280px and up):**
  - Today's column is twice as wide as the others. Click any column, or its day name, to make it the wide one.
    Clicking the wide column's name again goes back to today, and switching weeks resets to today.
  - The other columns are greyed out until you hover them, and their tasks have no checkboxes.
- **Today:** follow-up rows line up with task rows. The title wraps, the date sits beside its first line, and
  the project line sits underneath.
- **Schedule ahead:** the task dialog's Day field lists this week and next week (and the task's own week if it
  is another one). The day menus on task rows have "Next week" (the week after the one shown, without a day).
- **Navigation:** on desktop and tablet (`md` and up) the left icon rail is replaced by a static dock at the
  bottom centre. Phones keep the bottom tab bar.
  - The user tried icons that grow under the pointer and a bar that bulges around them, and rejected both
    ("keep it static").
  - The preview the user approved is the artifact https://claude.ai/artifact/SMEXfcrfVpd8z7vZcCHqhv.
- **Checks at the last commit:** typecheck, lint, 562 unit tests and 16 Playwright tests (desktop 1280px and phone
  390px) pass. The user tested delegation, substreams, task links and image uploads on the live site, and all
  worked.

## Decisions the user made (don't undo them without asking)

- The delegated cards sit below your own cards on Today and stay quiet. The user asked for "less present".
- The wide column on Week defaults to today. Only the 8-column layout (xl) widens a column, greys out the others
  and hides checkboxes.
- The dock is static: no magnification and no bulge. It has no dashed borders, and the user rejected dashes on
  cards as well.

## State and open items

- **Schema changes:** none this session. Supabase still has migrations 0001–0007. Any change that needs a
  column means a new `supabase/migrations/0008_…sql`, and the user must run it before the code reaches `main`.
  Follow the conventions in the existing files and in `supabase/README.md`.
- **Pull request:** [tarekcmahmoud/PersonalDash#1](https://github.com/tarekcmahmoud/PersonalDash/pull/1) is
  still open, with its base on the old branch. The user never chose between pushing straight to `main` (what
  happens now) and merging through the pull request. A safety-net check-in (`trig_01FZ2n1FsKsG2aqma5CVftit`)
  was due to run once at 07:37 UTC on 2026-10-09 in the previous session. Check it with `list_triggers` if
  it matters.
- **Still unanswered:**
  - Hide the "VITE_GOOGLE_CLIENT_ID is missing" block in Settings? Google Calendar was dropped.
  - Run the security review of database access rules, storage, sign-in and the public key? It was suggested
    three times and never run.
  - "Next" marks the first ready task per workstream, including a delegated one. Is that wanted?
- **Production URL:** never shared. The preview URL is https://tcgmpersonaldash.vercel.app.

## Gotchas

- **Screenshots of delegated cards:** the demo data has only one delegated task, with its follow-up 15 days
  out, so the cards don't show by default.
  - For screenshots, temporarily change `src/data/seed.ts`: set its `followUpDate` to `today`, and delegate
    "Order cabinets and worktop" to Sam with a follow-up tomorrow.
  - Restore the file afterwards. The e2e tests and the weekly numbers depend on it.
- **Playwright screenshots:** use `executablePath: '/opt/pw-browsers/chromium'`. Run the dev server with
  `npm run dev:memory -- --port 5180 --strictPort`, and stop it with `pgrep -f "vite[ ].*5180" | xargs -r kill`.
- **Never run `prettier --write src` as a whole.** Format only the files you touched.
- **Media queries in UI logic:** use `useMediaQuery` (`src/lib/useMediaQuery.ts`). jsdom's `matchMedia` never
  matches; `WeekPage.test.tsx` shows how to stub it.
- The other gotchas from the previous handoff still apply: the React Compiler lint rules, opening Radix
  submenus with the keyboard in tests, and using tall viewports for drag tests. See `git show 5edae2d:docs/HANDOFF.md`.

## Suggested skills

- **`anthropic-skills:to-questionnaire`** or plain chat: collect feedback in a consistent shape.
- **`anthropic-skills:docs`**: if the user wants the compiled list as a shareable, commentable doc.
- **`anthropic-skills:grilling`**: if the user wants the list stress-tested before choosing what to build.
- **`run`**: launch the app (`npm run dev:memory`) to reproduce feedback and screenshot fixes.
- **`anthropic-skills:chrome-browser` or `anthropic-skills:built-in-browser`**, if available: see the live
  site as the user sees it.
- **`security-review`**: the pending review above.
- **`code-review`**: on any change to `src/data/supabaseRepo.ts` or the migrations.
