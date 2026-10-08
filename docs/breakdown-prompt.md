# LLM breakdown prompt

A copy-paste prompt that turns a project idea into an outline PersonalDash can import
(format spec: [outline-format.md](./outline-format.md)).

## How to use

1. Copy the prompt below into ChatGPT, Claude or any other LLM.
2. Replace every `{{placeholder}}` in the "My project" section with your own details. Delete the optional
   ones you don't need. Write the deadline as `YYYY-MM-DD`.
3. If the LLM asks clarifying questions, answer them. Otherwise it replies with a single code block.
4. Copy that code block into the app's **Import** page, check the preview (errors block the import,
   warnings don't), and import.

## The prompt

````text
You are a pragmatic project planner. Break the project below down into a plan written in a strict
plain-text outline format that my planning app imports. Output must follow the format exactly.

# MY PROJECT

Project name: {{project name}}
Objective / outcome (what is true when it is done): {{objective or outcome}}
Deadline: {{deadline as YYYY-MM-DD}} ({{hard or soft}})  -- hard = external deadline, soft = self-set target
Context and constraints (time I have, budget, tools, skills, things already done): {{context and constraints}}
Known workstreams (optional, otherwise propose your own): {{known workstreams}}
People involved (who I depend on, who decides or approves): {{people involved}}

# OUTPUT FORMAT

Plain text, one item per line:

```
# Project name
outcome: Done when ...
target: YYYY-MM-DD hard

- Task in no workstream [S]

## Workstream name
target: YYYY-MM-DD soft
- Task title [M] #key after:#otherkey
  done: what must be true for this task to count as finished
  note: any detail, one note per line
  - [ ] optional checklist item
```

Rules of the format:
- The first line is `# Project name`, exactly once. Directly under it: `outcome:` and `target:`
  (`target: YYYY-MM-DD hard` or `soft`). Omit `min-per-week`.
- `## Name` starts a workstream: a parallel track of work. Optionally `target: YYYY-MM-DD hard|soft` directly
  under it: when that stream should be done. Tasks above the first `##` belong to no workstream.
- `### Name` under a workstream starts a substream: a smaller parallel track inside it (for example `### Website`
  under `## Branding & Communication`). Use substreams only when a workstream clearly splits into separate tracks.
  A workstream's own tasks come before its first `###`.
- A task is a line starting with `- ` at column 0: `- Title [S|M|L|XL] #key after:#k1,#k2`.
  The size tag is required. `#key` and `after:` are optional (see below).
- Lines under a task are indented by 2 spaces: `done: ...`, `note: ...` (one per line), and checklist items
  `- [ ] text`.
- Keys are lowercase letters, digits and `-` only, and must be unique.
- Lines starting with `//` are comments. Do not use any other syntax, markdown, bold, or numbering.

# BREAKDOWN RULES

1. Use 2 to 6 workstreams: parallel tracks of work that can progress independently (e.g. Design, Build, Content,
   Admin). Within a workstream, list tasks in the order they happen. Put at most a few tasks outside
   workstreams, only for things that must happen before anything else.
2. Tasks start with a verb and are concrete and observable ("Draft the pricing page copy", not "Pricing").
   Aim for 3 to 8 tasks per workstream.
3. Size every task: S = about 1 hour or less, M = about half a day, L = about a full day.
   Anything bigger than a day, or still unclear, must be `[XL]`. Prefer splitting it into S/M/L tasks; use XL
   only when you genuinely cannot split it yet, and say why in a `note:`.
4. Add `done:` to any task whose completion is ambiguous (reviews, "finalize", "prepare", decisions).
   Skip it when the title already makes completion obvious.
5. Tasks within a workstream run in the order listed: each one implicitly follows the previous task in that
   workstream. Use `#key` and `after:` when a task must wait for a task in ANOTHER workstream, or when the order
   inside a workstream is not simply sequential. Give a key only to tasks that something else points to. Add
   `anytime` to a task that does not need the task before it (it can be done in parallel).
6. Wherever the work stalls until someone else responds (hand-offs, approvals, deliveries, replies), add the
   line `note: waiting on <who>` to that task, naming the person or party from my project details.
7. The very first task must be something I can start today with what I have, and must be S or M.
8. Respect my deadline and constraints; do not plan more than is realistic, and do not invent facts.
   Do not add generic filler such as "Celebrate" or "Review lessons learned" unless I asked for it.

# HOW TO ANSWER

- If critical information is missing (for example the objective is unclear, or there is no deadline or
  scope), ask up to 3 short clarifying questions first and wait for my answers. Ask nothing otherwise.
- Otherwise reply with ONLY the outline inside a single code block. No introduction, no commentary after it.
````

## Worked example

Input (the placeholders filled in):

```text
Project name: Newsletter landing page
Objective / outcome: A live landing page that collects newsletter sign-ups and sends a welcome email
Deadline: 2026-12-15 (hard)
Context and constraints: Solo, about 6 hours a week. Domain is already bought. No design skills, so I will
use a template. Email tool is not chosen yet.
Known workstreams: none
People involved: Sam (friend who reviews copy), the email tool's support team
```

Expected output (the LLM's whole reply):

```text
# Newsletter landing page
outcome: Live landing page collects sign-ups and sends a welcome email
target: 2026-12-15 hard

- Write a one-paragraph pitch for the newsletter [S]
  done: pitch is saved in a doc and reads well out loud

## Setup
target: 2026-11-01 soft
- Compare three email tools on price and sign-up forms [M]
  done: one tool picked with a reason written down
- Create an account in the chosen email tool [S] #account
- Pick a landing page template [M] #template
  note: free or cheap, mobile friendly

## Content
target: 2026-11-20 soft
- Draft headline, sub-headline and call to action [M]
- Get Sam's feedback on the copy [S]
  note: waiting on Sam
- Revise copy with Sam's feedback [S] #copy
- Write the welcome email [M] after:#account
  done: email is saved in the email tool as an automation draft

## Build
target: 2026-12-01 soft
- Set up the template with the final copy [L] after:#template,#copy
- Connect the sign-up form to the email tool [M] #form after:#account,#template
  - [ ] Test on desktop
  - [ ] Test on phone
- Point the domain at the page and enable HTTPS [M]
  note: waiting on the email tool's support team if DNS records are rejected

## Launch
target: 2026-12-15 hard
- Test the full flow with two personal email addresses [S] after:#form
  done: both addresses received the welcome email within five minutes
- Check analytics and privacy notice are in place [XL]
  note: unclear whether a cookie banner is required, research and split this first
- Announce the page to friends and on social media [M]
```
