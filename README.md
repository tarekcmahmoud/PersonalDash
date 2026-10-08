# PersonalDash

A weekly planner for people running many projects at once. PersonalDash helps you:

- break each project down in advance,
- always see each project's next step,
- plan the week by hand, within your real capacity,
- keep every project moving,
- track who you're waiting on.

## Features

- **Projects** with an objective ("done when…") and a hard or soft deadline.
- **Milestones** and **tasks** with sizes (S, M, L, XL) and dependencies. An XL task is too big to schedule, so
  split it first.
- **Inbox** for tasks you haven't placed yet.
- **Weekly pick list** on the Plan screen, with a capacity bar and warnings when a project is neglected or falls
  below its weekly minimum.
- **Today** and **Week** views.
- **Weekly review** at the end of each week.
- **Follow-ups** for tasks you are waiting on from someone else.
- **Templates** and **outline import**: reuse a project structure, or import a plan written in the outline format.
- **LLM breakdown prompt**: a copy-and-paste prompt that turns a project idea into an outline you can import.
- **Google Calendar** (planned): your meetings shown alongside your week, and tasks pinned to a day written to a
  PersonalDash calendar.

## Tech stack

Vite, React, TypeScript, shadcn/ui (Radix + Tailwind CSS, Rhea style), Supabase (Postgres, Auth and Row Level Security), Google Calendar
API, Vitest, Testing Library and Playwright.

## Quick start

```bash
npm ci
npm run dev:memory
```

Open http://localhost:5173. This runs with demo data that resets when you reload the page. To use your own data
in Supabase and deploy it online, follow [docs/setup.md](docs/setup.md).

## Scripts

| Script               | What it does                                             |
| -------------------- | -------------------------------------------------------- |
| `npm run dev`        | Start the dev server, using the settings in `.env.local` |
| `npm run dev:memory` | Start with demo data in the browser (no backend)         |
| `npm run build`      | Type-check, then build the app into `dist/`              |
| `npm run typecheck`  | Type-check without building                              |
| `npm run lint`       | Run ESLint                                               |
| `npm test`           | Run unit and component tests (Vitest)                    |
| `npm run e2e`        | Run end-to-end tests (Playwright)                        |

## Documentation

- [docs/setup.md](docs/setup.md): step-by-step setup for Supabase, Google Calendar and Vercel.
- [docs/outline-format.md](docs/outline-format.md): the plain-text format used for imports and templates.
- [docs/breakdown-prompt.md](docs/breakdown-prompt.md): a prompt that gets an LLM to write an outline for a project.

## Project structure

- `src/domain/`: planning logic as pure TypeScript (no React, no I/O).
- `src/data/`: storage, with in-memory and Supabase repositories, change objects and hooks.
- `src/integrations/gcal/`: Google Calendar integration.
- `src/ui/`: screens and app components; `src/components/ui/`: the vendored shadcn/ui kit (Rhea style).
- `supabase/migrations/`: database schema, including Row Level Security policies.
- `docs/`: setup and format documentation.

Tests sit next to the code as `*.test.ts(x)`. End-to-end tests go in `e2e/`.

`vercel.json` configures the Vite build and single-page routing for deployment on Vercel.
