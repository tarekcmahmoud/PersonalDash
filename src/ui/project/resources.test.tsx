import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { seedSnapshot } from '../../data/seed'
import { makeResource } from '../../domain/factories'
import { freezeToday, renderWithApp, TEST_TODAY, unfreezeToday } from '../../test/renderWithApp'
import { ProjectPage } from '../routes/ProjectPage'

beforeEach(() => {
  freezeToday()
  // jsdom has no object URLs; the memory repo uses them for uploaded images.
  URL.createObjectURL = vi.fn(() => 'blob:test-image')
  URL.revokeObjectURL = vi.fn()
})
afterEach(() => unfreezeToday())

const seed = seedSnapshot(TEST_TODAY)
const website = seed.projects.find((p) => p.name === 'Client website redesign')!
const ws = (name: string) => seed.milestones.find((m) => m.name === name)!
const route = `/projects/${website.id}`
const path = '/projects/:projectId'

const renderPage = (opts: { route?: string; snapshot?: typeof seed } = {}) =>
  renderWithApp(<ProjectPage />, {
    route: opts.route ?? route,
    path,
    snapshot: opts.snapshot ?? structuredClone(seed),
  })

const cardOf = (title: string) =>
  screen.getByRole('link', { name: title }).closest('[data-testid="resource-card"]') as HTMLElement
const workstreamCard = (name: string) =>
  screen.getByRole('region', { name }).querySelector('[data-testid="workstream-card"]') as HTMLElement

async function openAddDialog(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: 'Add resource' }))
  return screen.findByRole('dialog', { name: 'Add resource' })
}

describe('resources', () => {
  it('shows the project resources as cards: link, hostname, description and workstreams', async () => {
    renderPage()
    const brief = await screen.findByRole('link', { name: 'Client brief' })
    expect(brief).toHaveAttribute('href', 'https://example.com/client-brief')
    expect(brief).toHaveAttribute('target', '_blank')
    expect(brief).toHaveAttribute('rel', 'noreferrer')
    const card = within(cardOf('Client brief'))
    expect(card.getByText('example.com')).toBeInTheDocument()
    expect(card.getByText('Goals, audience and must-haves agreed at kickoff.')).toBeInTheDocument()
    expect(card.getByText('Discovery')).toBeInTheDocument()

    // Several workstreams, and project-wide; an untitled resource falls back to its hostname.
    expect(
      within(cardOf('Competitor moodboard'))
        .getAllByTestId('resource-chip')
        .map((c) => c.textContent),
    ).toEqual(['Discovery', 'Design'])
    expect(within(cardOf('drive.example.com')).getByText('Project-wide')).toBeInTheDocument()

    // Images come with alt text; cards without one have none.
    expect(within(cardOf('Brand guidelines')).getByAltText('Brand guidelines')).toHaveAttribute(
      'loading',
      'lazy',
    )
    expect(within(cardOf('Client brief')).queryByRole('img')).not.toBeInTheDocument()
  })

  it('adds a resource with a pasted image link, a missing scheme and two workstreams', async () => {
    const user = userEvent.setup()
    const { snapshot } = renderPage()
    const dialog = await openAddDialog(user)

    await user.type(within(dialog).getByRole('textbox', { name: 'Link' }), 'figma.com/file/abc')
    await user.type(within(dialog).getByRole('textbox', { name: /^Title/ }), 'Design file')
    await user.type(within(dialog).getByRole('textbox', { name: /^Description/ }), 'Homepage frames.')
    expect(within(dialog).getByText('16/200')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('radio', { name: 'Link' }))
    await user.type(
      within(dialog).getByRole('textbox', { name: 'Image link' }),
      'https://img.example.com/a.png',
    )
    expect(within(dialog).getByAltText('Image preview')).toHaveAttribute(
      'src',
      'https://img.example.com/a.png',
    )
    // Click order must not matter: the saved order follows the workstream order.
    await user.click(within(dialog).getByRole('checkbox', { name: 'Build' }))
    await user.click(within(dialog).getByRole('checkbox', { name: 'Design' }))
    await user.click(within(dialog).getByRole('button', { name: 'Add resource' }))

    await waitFor(async () => {
      const added = (await snapshot()).resources.find((r) => r.title === 'Design file')
      expect(added).toMatchObject({
        projectId: website.id,
        url: 'https://figma.com/file/abc',
        description: 'Homepage frames.',
        imageUrl: 'https://img.example.com/a.png',
        imagePath: null,
        workstreamIds: [ws('Design').id, ws('Build').id],
        position: 5,
      })
    })
    expect(await screen.findByRole('link', { name: 'Design file' })).toHaveAttribute(
      'href',
      'https://figma.com/file/abc',
    )
  })

  it('rejects links that are not http(s) and keeps the dialog open', async () => {
    const user = userEvent.setup()
    const { snapshot } = renderPage()
    const dialog = await openAddDialog(user)
    await user.type(within(dialog).getByRole('textbox', { name: 'Link' }), 'ftp://files.example.com/x')
    await user.click(within(dialog).getByRole('button', { name: 'Add resource' }))
    expect(await within(dialog).findByText(/Enter a web link/)).toBeInTheDocument()
    expect((await snapshot()).resources).toHaveLength(5)
  })

  it('lets a resource stay project-wide when no workstream is ticked', async () => {
    const user = userEvent.setup()
    const { snapshot } = renderPage()
    const dialog = await openAddDialog(user)
    expect(within(dialog).getByText(/project-wide/)).toBeInTheDocument()
    await user.type(within(dialog).getByRole('textbox', { name: 'Link' }), 'https://notes.example.com')
    await user.click(within(dialog).getByRole('button', { name: 'Add resource' }))
    await waitFor(async () => {
      const added = (await snapshot()).resources.find((r) => r.url === 'https://notes.example.com')
      expect(added).toMatchObject({ workstreamIds: [], title: '' })
    })
  })

  it('uploads an image through the repo and stores its path', async () => {
    const user = userEvent.setup()
    const { snapshot } = renderPage()
    const dialog = await openAddDialog(user)
    await user.type(within(dialog).getByRole('textbox', { name: 'Link' }), 'https://example.com/with-image')

    await user.upload(
      within(dialog).getByLabelText('Upload image'),
      new File(['png-bytes'], 'cover.png', { type: 'image/png' }),
    )
    expect(await within(dialog).findByAltText('Image preview')).toHaveAttribute('src', 'blob:test-image')
    await user.click(within(dialog).getByRole('button', { name: 'Add resource' }))

    await waitFor(async () => {
      const added = (await snapshot()).resources.find((r) => r.url === 'https://example.com/with-image')
      expect(added?.imagePath).toMatch(/^memory\/.*cover\.png$/)
      expect(added?.imageUrl).toBeNull()
    })
    expect(await screen.findByAltText('example.com')).toHaveAttribute('src', 'blob:test-image')
  })

  it('shows the repo error for an image over 5 MB and saves nothing', async () => {
    const user = userEvent.setup()
    renderPage()
    const dialog = await openAddDialog(user)
    await user.upload(
      within(dialog).getByLabelText('Upload image'),
      new File([new Uint8Array(6 * 1024 * 1024)], 'big.png', { type: 'image/png' }),
    )
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Images must be 5 MB or smaller.')
    expect(within(dialog).queryByAltText('Image preview')).not.toBeInTheDocument()
  })

  it('removes an uploaded image from storage when the dialog is cancelled', async () => {
    const user = userEvent.setup()
    const { repo } = renderPage()
    const deleteImage = vi.spyOn(repo, 'deleteImage')
    const dialog = await openAddDialog(user)
    await user.upload(
      within(dialog).getByLabelText('Upload image'),
      new File(['x'], 'tmp.png', { type: 'image/png' }),
    )
    await within(dialog).findByAltText('Image preview')
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(deleteImage).toHaveBeenCalledWith(expect.stringMatching(/tmp\.png$/)))
  })

  it('edits a resource: title, and links it to another workstream as well', async () => {
    const user = userEvent.setup()
    const { snapshot } = renderPage()
    await user.click(await screen.findByRole('button', { name: 'Resource actions: Client brief' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Edit…' }))
    const dialog = await screen.findByRole('dialog', { name: 'Edit resource' })
    expect(within(dialog).getByRole('textbox', { name: 'Link' })).toHaveValue(
      'https://example.com/client-brief',
    )
    expect(within(dialog).getByRole('checkbox', { name: 'Discovery' })).toBeChecked()
    expect(within(dialog).getByRole('checkbox', { name: 'Design' })).not.toBeChecked()

    const title = within(dialog).getByRole('textbox', { name: /^Title/ })
    await user.clear(title)
    await user.type(title, 'Kickoff brief')
    await user.click(within(dialog).getByRole('checkbox', { name: 'Design' }))
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))

    await waitFor(async () => {
      const edited = (await snapshot()).resources.find((r) => r.url === 'https://example.com/client-brief')
      expect(edited).toMatchObject({
        title: 'Kickoff brief',
        workstreamIds: [ws('Discovery').id, ws('Design').id],
        position: 0,
      })
    })
    expect((await snapshot()).resources).toHaveLength(5)
  })

  it('deletes a resource after confirmation, and its uploaded image too', async () => {
    const uploaded = makeResource({
      projectId: website.id,
      url: 'https://example.com/photo',
      title: 'Photo board',
      imagePath: 'memory/abc-photo.png',
      position: 5,
    })
    const user = userEvent.setup()
    const { snapshot, repo } = renderPage({
      snapshot: { ...structuredClone(seed), resources: [...structuredClone(seed).resources, uploaded] },
    })
    const deleteImage = vi.spyOn(repo, 'deleteImage')

    await user.click(await screen.findByRole('button', { name: 'Resource actions: Photo board' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Delete…' }))
    const confirm = await screen.findByRole('alertdialog')
    await user.click(within(confirm).getByRole('button', { name: 'Delete resource' }))

    await waitFor(async () => {
      expect((await snapshot()).resources.some((r) => r.id === uploaded.id)).toBe(false)
    })
    expect(deleteImage).toHaveBeenCalledWith('memory/abc-photo.png')
    expect((await snapshot()).resources).toHaveLength(5)
  })

  it('reorders resources with Move earlier / Move later', async () => {
    const user = userEvent.setup()
    const { snapshot } = renderPage()
    await user.click(await screen.findByRole('button', { name: 'Resource actions: Client brief' }))
    expect(await screen.findByRole('menuitem', { name: 'Move earlier' })).toHaveAttribute('data-disabled')
    await user.click(screen.getByRole('menuitem', { name: 'Move later' }))
    await waitFor(async () => {
      const resources = (await snapshot()).resources
      const pos = (title: string) => resources.find((r) => r.title === title)!.position
      expect(pos('Brand guidelines')).toBe(0)
      expect(pos('Client brief')).toBe(1)
    })
  })

  it('shows an empty state for a project without resources', async () => {
    const empty = seed.projects.find((p) => p.name === 'Hire a designer')!
    renderPage({ route: `/projects/${empty.id}` })
    expect(await screen.findByText(/No resources yet/)).toBeInTheDocument()
  })
})

describe('focus mode', () => {
  const dimmed = (el: HTMLElement) => el.getAttribute('data-dimmed')

  it('is off by default: nothing is greyed out', async () => {
    renderPage()
    await screen.findByRole('link', { name: 'Client brief' })
    for (const el of document.querySelectorAll('[data-dimmed]'))
      expect(el).toHaveAttribute('data-dimmed', 'false')
    expect(screen.queryByText(/Focusing on/)).not.toBeInTheDocument()
  })

  it('greys out other workstreams and resources, keeping linked and project-wide ones in colour', async () => {
    renderPage({ route: `${route}?focus=${ws('Design').id}` })
    await screen.findByRole('link', { name: 'Client brief' })

    expect(dimmed(workstreamCard('Discovery'))).toBe('true')
    expect(dimmed(workstreamCard('Design'))).toBe('false')
    expect(dimmed(workstreamCard('Build'))).toBe('true')

    expect(dimmed(cardOf('Client brief'))).toBe('true') // Discovery only
    expect(dimmed(cardOf('Brand guidelines'))).toBe('false') // Design
    expect(dimmed(cardOf('Competitor moodboard'))).toBe('false') // Discovery + Design
    expect(dimmed(cardOf('Hosting dashboard'))).toBe('true') // Build
    expect(dimmed(cardOf('drive.example.com'))).toBe('false') // project-wide

    expect(screen.getByText(/Focusing on/)).toHaveTextContent('Focusing on Design')
    expect(screen.getByRole('button', { name: 'Exit focus mode' })).toBeInTheDocument()
    // Greyed cards stay interactive.
    expect(screen.getByRole('link', { name: 'Hosting dashboard' })).toBeEnabled()
  })

  it('turns on from the Focus menu and off with Exit', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole('button', { name: 'Focus' }))
    expect(await screen.findByRole('menuitemradio', { name: 'Discovery' })).toBeInTheDocument()
    await user.click(screen.getByRole('menuitemradio', { name: 'Build' }))
    expect(screen.getByTestId('location')).toHaveTextContent(`focus=${ws('Build').id}`)
    expect(dimmed(workstreamCard('Design'))).toBe('true')
    expect(dimmed(workstreamCard('Build'))).toBe('false')

    await user.click(screen.getByRole('button', { name: 'Exit focus mode' }))
    expect(screen.getByTestId('location')).not.toHaveTextContent('focus=')
    expect(dimmed(workstreamCard('Design'))).toBe('false')
  })

  it('turns on from a workstream card and toggles off from the same button', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole('button', { name: 'Focus on Design' }))
    expect(dimmed(workstreamCard('Build'))).toBe('true')
    await user.click(screen.getByRole('button', { name: 'Exit focus on Design' }))
    expect(dimmed(workstreamCard('Build'))).toBe('false')
  })

  it('exits with Escape', async () => {
    const user = userEvent.setup()
    renderPage({ route: `${route}?focus=${ws('Design').id}` })
    expect(await screen.findByText(/Focusing on/)).toBeInTheDocument()
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByText(/Focusing on/)).not.toBeInTheDocument())
    expect(screen.getByTestId('location')).not.toHaveTextContent('focus=')
    expect(dimmed(workstreamCard('Build'))).toBe('false')
  })

  it('ignores a focus id that is not a workstream of this project', async () => {
    renderPage({ route: `${route}?focus=nope` })
    await screen.findByRole('link', { name: 'Client brief' })
    expect(screen.queryByText(/Focusing on/)).not.toBeInTheDocument()
    expect(dimmed(workstreamCard('Design'))).toBe('false')
  })
})

describe('phone panes', () => {
  const pane = (name: string) => document.querySelector(`[data-pane="${name}"]`)!

  it('shows workstreams by default and switches to resources, keeping the choice in ?pane=', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByRole('link', { name: 'Client brief' })
    expect(pane('workstreams')).toHaveAttribute('data-active', 'true')
    expect(pane('resources')).toHaveAttribute('data-active', 'false')
    expect(pane('resources')).toHaveClass('max-lg:hidden')
    expect(pane('workstreams')).not.toHaveClass('max-lg:hidden')

    await user.click(screen.getByRole('radio', { name: 'Resources' }))
    expect(screen.getByTestId('location')).toHaveTextContent('pane=resources')
    expect(pane('resources')).toHaveAttribute('data-active', 'true')
    expect(pane('workstreams')).toHaveClass('max-lg:hidden')
    expect(pane('resources')).not.toHaveClass('max-lg:hidden')

    await user.click(screen.getByRole('radio', { name: 'Workstreams' }))
    expect(screen.getByTestId('location')).not.toHaveTextContent('pane=')
    expect(pane('workstreams')).toHaveAttribute('data-active', 'true')
  })

  it('opens on the resources pane from the URL', async () => {
    renderPage({ route: `${route}?pane=resources` })
    await screen.findByRole('link', { name: 'Client brief' })
    expect(pane('resources')).toHaveAttribute('data-active', 'true')
    expect(screen.getByRole('radio', { name: 'Resources' })).toBeChecked()
  })
})
