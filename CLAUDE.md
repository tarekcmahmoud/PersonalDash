# PersonalDash — conventions for agents

Personal multi-project planner (first module of a personal dashboard). Product spec: see the approved plan
summarized in `docs/` and the JSDoc on the contracts below.

## Contracts (frozen — change only with the orchestrator's approval)

- `src/domain/types.ts` — domain model. `src/domain/context.ts` — PlanContext.
- Function signatures + JSDoc in `src/domain/*.ts` stubs — implement exactly what the JSDoc says.
- `src/data/changes.ts` (Change union), `src/data/repo.ts`, `src/data/auth.ts`.
- Outline format: `docs/outline-format.md`.

## Rules

- `src/domain/` is pure TypeScript: no React, no I/O, no `Date.now()` inside logic (pass `today`/`now` in).
  Dates are local `'YYYY-MM-DD'` strings; use helpers in `src/domain/week.ts`.
- UI uses **Primer React v38** (`@primer/react`) + `@primer/octicons-react`. There is **no `Box` and no `sx`
  prop** in v38: lay out with `Stack` and style with CSS modules (`X.module.css`) using Primer CSS variables
  (e.g. `var(--fgColor-muted)`, `var(--bgColor-muted)`, `var(--borderColor-default)`, `var(--base-size-8)`).
  Never hard-code colors. Must work at 390px width (phone) and in dark mode.
- Data access in UI only through `src/data/hooks.ts` (`useSnapshot`, `usePlanContext`, `useApply`,
  `useUpdateTask(s)`); writes are `Change` objects. New entities via `src/domain/factories.ts`.
- Tests: Vitest + Testing Library, colocated as `*.test.ts(x)`. Style: Prettier config in `.prettierrc`
  (no semicolons, single quotes, width 110).
- Checks that must pass: `npm run typecheck`, `npm run lint`, `npm test`.
- Run the app without a backend: `npm run dev:memory`.
- End-to-end: `npm run e2e` (Playwright, desktop 1280px + phone 390px, memory mode). The e2e specs rely on
  the demo data in `src/data/seed.ts` (Inbox items, last-week leftovers, the XL task) — update them together.
