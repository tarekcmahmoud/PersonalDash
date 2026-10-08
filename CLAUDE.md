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
- UI uses **shadcn/ui** (Radix + Tailwind v4) in the **Rhea** style. Kit components live in `src/components/ui/`
  (vendored from shadcn's `bases/radix` registry; their `cn-*` classes are styled by `src/styles/style-rhea.css`,
  kept pristine — app overrides go in `src/index.css`; import as `@/components/ui/button` etc.), `cn()` from `@/lib/utils`, icons from
  `lucide-react`, toasts via `toast()` from `sonner`. Style with Tailwind classes only (no CSS modules, no
  inline colours). Tokens are in `src/index.css`. Primer has been removed — never import `@primer/*`.
- **Design rules (calm, greyscale-first):**
  - Text tiers: `text-foreground` for titles/primary content; `text-muted-foreground` for ALL metadata (size,
    day, project name, counts, dates); `text-muted-foreground/60` for tertiary/disabled.
  - Colour = attention only: `text-destructive` (overdue, hard deadline soon), `text-warning` (neglected,
    below weekly minimum, XL, repeated slips). Nothing else is coloured. No coloured badges/labels.
  - Yellow accent `primary` is a FILL only (primary button, focus ring, active nav, progress, checked
    checkbox) — never text. Links: foreground + underline on hover (`Button variant="link"`).
  - Use cards (`@/components/ui/card`, Rhea's soft card) freely to group related content; separate rows inside a
    group with hairlines (`divide-y`).
  - At most one primary (`variant="default"`) button per screen; others `ghost`/`outline`/`link`.
  - Task rows: use `TaskRow` (one line, grey metadata, `actions` revealed on hover on desktop, always visible
    on touch). Project health: `ProjectSignal` (one signal max). Capacity: `CapacityLine`/`CapacityBar`.
  - Must work at 390px (phone; ≥32px touch targets) and in dark mode (`.dark` on <html>).
- Data access in UI only through `src/data/hooks.ts` (`useSnapshot`, `usePlanContext`, `useApply`,
  `useUpdateTask(s)`); writes are `Change` objects. New entities via `src/domain/factories.ts`.
- Tests: Vitest + Testing Library, colocated as `*.test.ts(x)`. Style: Prettier config in `.prettierrc`
  (no semicolons, single quotes, width 110).
- Checks that must pass: `npm run typecheck`, `npm run lint`, `npm test`.
- Run the app without a backend: `npm run dev:memory`.
- End-to-end: `npm run e2e` (Playwright, desktop 1280px + phone 390px, memory mode). The e2e specs rely on
  the demo data in `src/data/seed.ts` (Inbox items, last-week leftovers, the XL task) — update them together.
