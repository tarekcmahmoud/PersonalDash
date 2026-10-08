# Outline format (v1)

One plain-text format is used for **importing a breakdown**, for **templates**, and as the **output of the LLM
breakdown prompt** (`docs/breakdown-prompt.md`). It is meant to be readable and hand-editable.

```
# Website redesign
outcome: Live site signed off by the client
target: 2026-12-15 hard
min-per-week: 2

- Confirm budget with finance [S]

## Discovery
target: 2026-10-31 soft
- Kickoff call with client [S]
  done: agenda sent, notes shared
- Audit current site [M]
  note: include mobile analytics
  - [ ] Analytics export
  - [x] Page inventory
- Draft sitemap [L] #sitemap

## Build
- Build homepage [XL] after:#sitemap
- Build content pages [L] after:#sitemap
```

A **workstream** (`## Name`) is a parallel track of work, such as Design or Build. Workstreams progress
independently, so each one has its own next step, while tasks inside one workstream run in order. Tasks before
the first `##` belong to no workstream and form their own sequence. Use `after:` for links across workstreams
or any other order that isn't a simple sequence.

## Rules

| Line                                       | Meaning                                                                             |
| ------------------------------------------ | ----------------------------------------------------------------------------------- |
| `# Name`                                   | Project name. Required, exactly one, must be the first non-blank, non-comment line. |
| `outcome: …`                               | Objective outcome ("Done when …"). Only valid directly under `# Name`.              |
| `target: YYYY-MM-DD [hard\|soft]`          | Target date. Under `#` → project, under `##` → workstream. Kind defaults to `soft`. |
| `min-per-week: N`                          | Weekly minimum (integer ≥ 1). Only under `# Name`.                                  |
| `## Name`                                  | Workstream (a parallel track). Workstreams appear in this order.                    |
| `- Title [S\|M\|L\|XL] #key after:#k1,#k2` | Task (at column 0). Tasks before the first `##` belong to no workstream.            |
| `  done: …`                                | Definition of done for the task above (indented ≥ 2 spaces).                        |
| `  note: …`                                | Note line for the task above; several are joined with newlines.                     |
| `  - [ ] text` / `  - [x] text`            | Checklist item of the task above.                                                   |
| `// …`                                     | Comment, ignored. Blank lines are ignored.                                          |

Task line details:

- The size tag `[S]`, `[M]`, `[L]` or `[XL]` is optional. When missing the task gets size `M` and a **warning**.
  `XL` means too big or unclear: the task can't be scheduled until it is split.
- `#key` (lowercase letters, digits, `-`) names a task so other tasks can reference it. Keys must be unique.
- `after:#a,#b` makes the task depend on those tasks explicitly (instead of on the previous task in its
  workstream). Use it to link tasks across workstreams. Forward references are allowed. Unknown keys and cycles are **errors**.
- Tokens may appear in any order after the title; everything that isn't a token is the title (trimmed).
- Tabs count as two spaces. Keys/values are case-insensitive for `outcome`, `target`, `min-per-week`, `done`,
  `note`, and size letters.

Errors block the import; warnings are shown in the preview but don't block it.
Templates may omit `outcome` and `target` (they're filled in when a project is created from the template).
