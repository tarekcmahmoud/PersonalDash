import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { seedSnapshot } from '../../data/seed'
import { parseOutline } from '../../domain/outline'
import { todayISO } from '../../domain/week'
import { BREAKDOWN_PROMPT, extractPrompt } from './breakdownPrompt'
import { lineRange, outlineStats, summaryText } from './outlineStats'
import { renderApp } from './testUtils'

const VALID = `# Garden shed
outcome: A shed that keeps the tools dry
target: 2027-05-01 hard

- Pick a spot [S]

## Build
target: 2027-04-01 soft
- Pour foundation [L] #found
  done: slab is level
- Frame the walls [XL] after:#found
- Roof [M] after:#found
  - [ ] Buy felt
`

const BROKEN = '# Broken\n- Fine [S]\n- Needs a blocker [S] after:#nope\n'

function setOutline(text: string) {
  fireEvent.change(screen.getByRole('textbox', { name: 'Outline' }), { target: { value: text } })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('outline helpers', () => {
  it('summarises counts', () => {
    const { doc } = parseOutline(VALID)
    expect(summaryText(outlineStats(doc!))).toBe('1 milestone · 4 tasks · 1 XL to split · 2 dependencies')
  })

  it('finds a line range', () => {
    expect(lineRange('ab\ncde\nf', 2)).toEqual([3, 6])
    expect(lineRange('ab', 5)).toEqual([2, 2])
  })

  it('extracts the first text block of the prompt doc', () => {
    expect(BREAKDOWN_PROMPT.startsWith('You are a pragmatic project planner')).toBe(true)
    expect(BREAKDOWN_PROMPT).not.toContain('````')
    expect(extractPrompt('x\n````text\nhello\n````\ny')).toBe('hello')
  })
})

describe('ImportPage', () => {
  it('shows a "Line N" issue for an error and disables Create', async () => {
    renderApp()
    setOutline(BROKEN)
    const issue = await screen.findByRole('button', { name: /Line 3:.*nope/ })
    expect(issue).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create project' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Save as template instead' })).toBeDisabled()
  })

  it('selects the line of an issue in the textarea when clicked', async () => {
    renderApp()
    setOutline(BROKEN)
    await userEvent.click(await screen.findByRole('button', { name: /Line 3:/ }))
    const area = screen.getByRole('textbox', { name: 'Outline' }) as HTMLTextAreaElement
    expect(area).toHaveFocus()
    expect(area.value.slice(area.selectionStart, area.selectionEnd)).toBe('- Needs a blocker [S] after:#nope')
  })

  it('shows a warning without blocking', async () => {
    renderApp()
    setOutline('# Sized later\noutcome: x\ntarget: 2027-01-01\n- No size\n')
    expect(await screen.findByText(/no size tag/)).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Create project' })).toBeEnabled())
  })

  it('previews the parsed outline', async () => {
    renderApp()
    setOutline(VALID)
    const preview = await screen.findByRole('region', { name: 'Preview' })
    await within(preview).findByText('Garden shed')
    expect(
      within(preview).getByText('1 milestone · 4 tasks · 1 XL to split · 2 dependencies'),
    ).toBeInTheDocument()
    expect(within(preview).getAllByText(/after: found/)).toHaveLength(2)
    expect(within(preview).getByText('Done when: slab is level')).toBeInTheDocument()
    expect(within(preview).getByText('XL · split')).toBeInTheDocument()
  })

  it('validates the objective and creates the project with milestones and tasks', async () => {
    const user = userEvent.setup()
    const { repo } = renderApp()
    const before = await repo.loadSnapshot()
    setOutline(
      '# Garden shed\n\n- Pick a spot [S]\n\n## Build\n- Pour foundation [L] #found\n- Roof [M] after:#found\n',
    )
    const create = screen.getByRole('button', { name: 'Create project' })
    await waitFor(() => expect(create).toBeEnabled())

    await user.click(create)
    expect(
      await screen.findByText('Describe the outcome: what is true when this is done?'),
    ).toBeInTheDocument()
    expect(screen.getByText('Pick a target date')).toBeInTheDocument()
    expect(screen.queryByTestId('project-stub')).not.toBeInTheDocument()

    await user.type(screen.getByRole('textbox', { name: /Outcome/ }), 'A shed that keeps tools dry')
    fireEvent.change(screen.getByLabelText(/Target date/), { target: { value: '2027-05-01' } })
    await user.selectOptions(screen.getByLabelText('Date type'), 'hard')
    await user.click(create)

    const stub = await screen.findByTestId('project-stub')
    const after = await repo.loadSnapshot()
    const project = after.projects.find((p) => p.id === stub.textContent)
    expect(project).toMatchObject({
      name: 'Garden shed',
      outcome: 'A shed that keeps tools dry',
      targetDate: '2027-05-01',
      dateKind: 'hard',
      status: 'active',
    })
    const maxRank = Math.max(...before.projects.filter((p) => !p.isSystem).map((p) => p.rank))
    expect(project!.rank).toBe(maxRank + 1)
    expect(after.milestones.filter((m) => m.projectId === project!.id).map((m) => m.name)).toEqual(['Build'])
    const tasks = after.tasks.filter((t) => t.projectId === project!.id)
    expect(tasks.map((t) => t.title).sort()).toEqual(['Pick a spot', 'Pour foundation', 'Roof'])
    expect(after.dependencies.length).toBe(before.dependencies.length + 1)
  })

  it('prefills the outline and objective from router state', async () => {
    renderApp({ state: { outline: VALID } })
    expect(screen.getByRole('textbox', { name: 'Outline' })).toHaveValue(VALID)
    await waitFor(() =>
      expect(screen.getByRole('textbox', { name: /Project name/ })).toHaveValue('Garden shed'),
    )
    expect(screen.getByRole('textbox', { name: /Outcome/ })).toHaveValue('A shed that keeps the tools dry')
    expect(screen.getByLabelText(/Target date/)).toHaveValue('2027-05-01')
    expect(screen.getByLabelText('Date type')).toHaveValue('hard')
  })

  it('suggests "on hold" when over the active-project cap', async () => {
    const snap = seedSnapshot(todayISO())
    snap.settings = { ...snap.settings, activeCap: 1 }
    renderApp({ snapshot: snap, state: { outline: VALID } })
    const flash = await screen.findByText(/Consider putting this one on hold/, { exact: false })
    expect(flash).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Put on hold' }))
    expect(screen.getByLabelText('Status')).toHaveValue('on_hold')
    expect(screen.queryByText(/Consider putting this one on hold/)).not.toBeInTheDocument()
  })

  it('saves the raw text as a template instead and goes to /templates', async () => {
    const { repo } = renderApp({ state: { outline: VALID } })
    const button = screen.getByRole('button', { name: 'Save as template instead' })
    await waitFor(() => expect(button).toBeEnabled())
    await userEvent.click(button)
    await waitFor(() => expect(screen.getByTestId('location')).toHaveAttribute('data-pathname', '/templates'))
    const saved = (await repo.loadSnapshot()).templates.find((t) => t.name === 'Garden shed')
    expect(saved?.outline).toBe(VALID)
  })

  it('copies the LLM prompt and confirms, without a clipboard API too', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })
    renderApp()
    await userEvent.click(screen.getByRole('button', { name: 'Copy the LLM prompt' }))
    expect(await screen.findByText('Copied')).toBeInTheDocument()
    expect(writeText).toHaveBeenCalledWith(BREAKDOWN_PROMPT)
  })

  it('does not crash when navigator.clipboard is missing', async () => {
    vi.stubGlobal('navigator', { ...navigator, clipboard: undefined })
    renderApp()
    await userEvent.click(screen.getByRole('button', { name: 'Copy the LLM prompt' }))
    expect(await screen.findByText(/Could not copy/)).toBeInTheDocument()
  })
})

describe('TemplatesPage', () => {
  it('lists templates with counts', async () => {
    renderApp({ route: '/templates' })
    const item = await screen.findByRole('listitem', { name: 'Client engagement' })
    expect(within(item).getByText(/\d+ tasks · 4 milestones/)).toBeInTheDocument()
  })

  it('opens the import page with the template outline', async () => {
    const { repo } = renderApp({ route: '/templates' })
    const item = await screen.findByRole('listitem', { name: 'Client engagement' })
    await userEvent.click(within(item).getByRole('button', { name: 'New project from template' }))
    await waitFor(() => expect(screen.getByTestId('location')).toHaveAttribute('data-pathname', '/import'))
    const template = (await repo.loadSnapshot()).templates[0]!
    expect(screen.getByRole('textbox', { name: 'Outline' })).toHaveValue(template.outline)
    await waitFor(() =>
      expect(screen.getByRole('textbox', { name: /Project name/ })).toHaveValue('Client engagement'),
    )
  })

  it('saves a project as a template', async () => {
    const user = userEvent.setup()
    const { repo } = renderApp({ route: '/templates' })
    await screen.findByRole('listitem', { name: 'Client engagement' })
    await user.selectOptions(screen.getByLabelText('Project'), 'Client website redesign')
    await user.click(screen.getByRole('button', { name: 'Save as template' }))
    const dialog = await screen.findByRole('dialog')
    const area = within(dialog).getByRole('textbox', { name: 'Template outline' }) as HTMLTextAreaElement
    expect(area.value).toContain('# Client website redesign')
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Save template' })).toBeEnabled())
    await user.click(within(dialog).getByRole('button', { name: 'Save template' }))
    await waitFor(async () => {
      const templates = (await repo.loadSnapshot()).templates
      expect(templates.map((t) => t.name)).toContain('Client website redesign')
    })
    expect(await screen.findByRole('listitem', { name: 'Client website redesign' })).toBeInTheDocument()
  })

  it('offers Replace or Save as new when a template with the same name exists', async () => {
    const user = userEvent.setup()
    const { repo } = renderApp({ route: '/templates' })
    await screen.findByRole('listitem', { name: 'Client engagement' })

    for (let i = 0; i < 2; i++) {
      await user.click(screen.getByRole('button', { name: 'New template' }))
      const dialog = await screen.findByRole('dialog')
      await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Save template' })).toBeEnabled())
      await user.click(within(dialog).getByRole('button', { name: 'Save template' }))
      if (i === 0) await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    }
    const confirm = await screen.findByRole('alertdialog', { name: /already exists/ })
    await user.click(within(confirm).getByRole('button', { name: 'Save as new' }))
    await waitFor(async () => {
      const names = (await repo.loadSnapshot()).templates.map((t) => t.name)
      expect(names.filter((n) => n === 'New template')).toHaveLength(2)
    })
  })

  it('edits a template and saves it', async () => {
    const user = userEvent.setup()
    const { repo } = renderApp({ route: '/templates' })
    const item = await screen.findByRole('listitem', { name: 'Client engagement' })
    const before = (await repo.loadSnapshot()).templates[0]!
    await user.click(within(item).getByRole('button', { name: 'Edit' }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Template outline' }), {
      target: { value: '# Renamed engagement\n\n## One\n- Do it [S]\n' },
    })
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Save template' })).toBeEnabled())
    await user.click(within(dialog).getByRole('button', { name: 'Save template' }))
    await waitFor(async () => {
      const t = (await repo.loadSnapshot()).templates.find((x) => x.id === before.id)
      expect(t?.name).toBe('Renamed engagement')
      expect((t?.updatedAt ?? '') >= before.updatedAt).toBe(true)
    })
  })

  it('duplicates a template', async () => {
    const { repo } = renderApp({ route: '/templates' })
    const item = await screen.findByRole('listitem', { name: 'Client engagement' })
    await userEvent.click(within(item).getByRole('button', { name: 'Duplicate' }))
    await waitFor(async () => {
      const templates = (await repo.loadSnapshot()).templates
      const copy = templates.find((t) => t.name === 'Client engagement (copy)')
      expect(copy?.outline.startsWith('# Client engagement (copy)\n')).toBe(true)
      expect(templates).toHaveLength(2)
    })
  })

  it('deletes a template after confirmation', async () => {
    const user = userEvent.setup()
    const { repo } = renderApp({ route: '/templates' })
    const item = await screen.findByRole('listitem', { name: 'Client engagement' })
    await user.click(within(item).getByRole('button', { name: 'Delete' }))
    const confirm = await screen.findByRole('alertdialog')
    expect((await repo.loadSnapshot()).templates).toHaveLength(1)
    await user.click(within(confirm).getByRole('button', { name: 'Delete' }))
    await waitFor(async () => expect((await repo.loadSnapshot()).templates).toHaveLength(0))
    expect(await screen.findByText(/No templates yet/)).toBeInTheDocument()
  })
})
