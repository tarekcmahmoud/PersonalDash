import { fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { toast } from 'sonner'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { seedSnapshot } from '../../data/seed'
import { todayISO } from '../../domain/week'
import { CalendarReconnectBanner } from '../../integrations/gcal/CalendarSync'
import { renderWithServices as renderApp } from '../outline/testUtils'
import { SettingsPage } from './SettingsPage'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

afterEach(() => {
  vi.unstubAllEnvs()
  vi.clearAllMocks()
})

describe('SettingsPage', () => {
  it('shows the saved settings', async () => {
    renderApp(<SettingsPage />)
    expect(await screen.findByLabelText('Monday start time')).toHaveValue('09:00')
    expect(screen.getByLabelText('Monday end time')).toHaveValue('18:00')
    expect(screen.getByLabelText('Monday is a working day')).toBeChecked()
    expect(screen.getByLabelText('Saturday is a working day')).not.toBeChecked()
    expect(screen.getByLabelText(/Share of free time/)).toHaveValue(70)
    expect(screen.getByLabelText('Size M')).toHaveValue(4)
    expect(screen.getByLabelText('Active project cap')).toHaveValue(6)
    expect(screen.getByLabelText('Deadline warning')).toHaveValue(14)
    expect(await screen.findByText('you@local')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument()
  })

  it('starts with Save disabled and enables it once something changed', async () => {
    const user = userEvent.setup()
    renderApp(<SettingsPage />)
    const save = await screen.findByRole('button', { name: 'Save settings' })
    expect(save).toBeDisabled()
    expect(screen.queryByText('Unsaved changes')).not.toBeInTheDocument()

    await user.clear(screen.getByLabelText('Active project cap'))
    await user.type(screen.getByLabelText('Active project cap'), '4')
    expect(save).toBeEnabled()
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Discard' }))
    expect(screen.getByLabelText('Active project cap')).toHaveValue(6)
    expect(save).toBeDisabled()
  })

  it('shows a live capacity example that follows the focus factor', async () => {
    const user = userEvent.setup()
    renderApp(<SettingsPage />)
    const example = await screen.findByTestId('capacity-example')
    await waitFor(() =>
      expect(example).toHaveTextContent('This week: 45h work − 0h meetings → 31.5h capacity'),
    )

    const focus = screen.getByLabelText(/Share of free time/)
    await user.clear(focus)
    await user.type(focus, '80')
    expect(example).toHaveTextContent('→ 36h capacity')

    // working hours feed it too
    fireEvent.change(screen.getByLabelText('Friday end time'), { target: { value: '14:00' } })
    expect(example).toHaveTextContent('41h work')
  })

  it('validates working hours and blocks saving', async () => {
    renderApp(<SettingsPage />)
    fireEvent.change(await screen.findByLabelText('Tuesday end time'), { target: { value: '08:00' } })
    expect(await screen.findByText('End time must be after the start time.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save settings' })).toBeDisabled()
    expect(screen.getByText('Fix the highlighted fields to save')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Tuesday end time'), { target: { value: '17:00' } })
    expect(screen.queryByText('End time must be after the start time.')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save settings' })).toBeEnabled()
  })

  it('validates the focus factor range', async () => {
    const user = userEvent.setup()
    renderApp(<SettingsPage />)
    const focus = await screen.findByLabelText(/Share of free time/)
    await user.clear(focus)
    await user.type(focus, '5')
    expect(screen.getByText('Enter a percentage from 10 to 100.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save settings' })).toBeDisabled()
  })

  it('saves edited settings and confirms', async () => {
    const user = userEvent.setup()
    const { repo } = renderApp(<SettingsPage />)

    const focus = await screen.findByLabelText(/Share of free time/)
    await user.clear(focus)
    await user.type(focus, '80')
    await user.click(screen.getByLabelText('Saturday is a working day'))
    fireEvent.change(screen.getByLabelText('Saturday start time'), { target: { value: '10:00' } })
    fireEvent.change(screen.getByLabelText('Saturday end time'), { target: { value: '12:30' } })
    await user.clear(screen.getByLabelText('Size S'))
    await user.type(screen.getByLabelText('Size S'), '0.5')
    await user.click(screen.getByLabelText('Monday is a working day'))
    await user.clear(screen.getByLabelText('Deadline warning'))
    await user.type(screen.getByLabelText('Deadline warning'), '21')

    await user.click(screen.getByRole('button', { name: 'Save settings' }))

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Settings saved'))
    const { settings } = await repo.loadSnapshot()
    expect(settings.focusFactor).toBeCloseTo(0.8)
    expect(settings.workHours.sat).toEqual({ start: '10:00', end: '12:30' })
    expect(settings.workHours.mon).toBeNull()
    expect(settings.sizeHours.S).toBe(0.5)
    expect(settings.deadlineWarningDays).toBe(21)
    expect(settings.calendarConnected).toBe(false)
    expect(screen.getByRole('button', { name: 'Save settings' })).toBeDisabled()
  })

  describe('Google Calendar', () => {
    it('explains when no client id is configured and disables Connect', async () => {
      vi.stubEnv('VITE_GOOGLE_CLIENT_ID', '')
      renderApp(<SettingsPage />)
      expect(await screen.findByText('Not configured')).toBeInTheDocument()
      expect(screen.getByText(/docs\/setup\.md/)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Connect' })).toBeDisabled()
    })

    it('offers Connect when configured but not connected', async () => {
      vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'client-123')
      renderApp(<SettingsPage />)
      expect(await screen.findByText('Not connected')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Connect' })).toBeEnabled()
      expect(screen.getByText(/named “PersonalDash”/)).toBeInTheDocument()
    })

    it('asks to reconnect when connected without a valid token', async () => {
      vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'client-123')
      const snapshot = seedSnapshot(todayISO())
      snapshot.settings.calendarConnected = true
      renderApp(<SettingsPage />, { snapshot })
      expect(await screen.findByText('Needs reconnect')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Reconnect' })).toBeEnabled()
      expect(screen.getByRole('button', { name: 'Disconnect' })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Sync now' })).not.toBeInTheDocument()
    })

    it('disconnecting clears calendarConnected in the saved settings', async () => {
      vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'client-123')
      const user = userEvent.setup()
      const snapshot = seedSnapshot(todayISO())
      snapshot.settings.calendarConnected = true
      const { repo } = renderApp(<SettingsPage />, { snapshot })
      await user.click(await screen.findByRole('button', { name: 'Disconnect' }))
      await waitFor(async () => expect((await repo.loadSnapshot()).settings.calendarConnected).toBe(false))
      expect(await screen.findByText('Not connected')).toBeInTheDocument()
    })
  })
})

describe('CalendarReconnectBanner', () => {
  it('shows only when connected and the token is missing', async () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'client-123')
    const snapshot = seedSnapshot(todayISO())
    snapshot.settings.calendarConnected = true
    renderApp(<CalendarReconnectBanner />, { snapshot })
    expect(await screen.findByText(/Google Calendar needs reconnecting/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reconnect' })).toBeEnabled()
  })

  it('renders nothing when the calendar is not connected', async () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'client-123')
    const { container } = renderApp(<CalendarReconnectBanner />)
    await new Promise((r) => setTimeout(r, 50))
    expect(screen.queryByRole('button', { name: 'Reconnect' })).not.toBeInTheDocument()
    expect(container).toBeEmptyDOMElement()
  })
})
