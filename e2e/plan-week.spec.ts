import { expect, test, type Locator } from '@playwright/test'
import { goTo, openApp } from './nav'

const TASK = 'Agree budget and contract type'

/** "Thu Oct 8", the label the day menu uses for a date (date-fns "EEE MMM d", English). */
function dayMenuLabel(date: Date): string {
  const weekday = date.toLocaleDateString('en-US', { weekday: 'short' })
  const month = date.toLocaleDateString('en-US', { month: 'short' })
  return `${weekday} ${month} ${date.getDate()}`
}

/** Hours planned, read from the capacity bar text "3.5h planned of 20h". */
async function plannedHours(capacityText: Locator): Promise<number> {
  const text = await capacityText.innerText()
  const m = /([\d.]+)h planned of/.exec(text)
  if (!m) throw new Error(`Unexpected capacity text: ${text}`)
  return Number(m[1])
}

test('plan a neglected project task, pin it to today, and finish it from Today', async ({ page }) => {
  await openApp(page)
  await goTo(page, 'Plan')
  await expect(page.getByRole('heading', { level: 1, name: 'Plan the week' })).toBeVisible()

  const card = page.getByRole('region', { name: 'Hire a designer' })
  await expect(card.getByText('Nothing planned', { exact: true })).toBeVisible()
  await expect(card.getByText('0 planned', { exact: true })).toBeVisible()

  const capacity = page.getByText(/h planned of /)
  const before = await plannedHours(capacity)

  // Plan the task for this week.
  const planToggle = card.getByRole('checkbox', { name: `Plan "${TASK}" this week` })
  await planToggle.click()
  await expect(planToggle).toBeChecked()

  await expect(card.getByText('Nothing planned', { exact: true })).toHaveCount(0)
  await expect(card.getByText('1 planned', { exact: true })).toBeVisible()
  await expect.poll(() => plannedHours(capacity)).toBeGreaterThan(before)

  // Pin it to today from the "Planned this week" section.
  const planned = page.getByText(/^Planned this week \(\d+\)$/)
  await planned.click()
  await page.getByRole('button', { name: `Pin "${TASK}" to a day` }).click()
  await page.getByRole('menuitem', { name: new RegExp(`^${dayMenuLabel(new Date())}\\b`) }).click()

  // The task is now pinned to today and shows up on the Today page.
  await goTo(page, 'Today')
  await expect(page.getByRole('heading', { level: 1, name: 'Today' })).toBeVisible()
  const pinned = page.getByRole('region', { name: /^Pinned for today/ })
  const row = pinned.getByTestId('task-row').filter({
    has: page.getByRole('button', { name: TASK, exact: true }),
  })
  await expect(row).toHaveCount(1)
  await expect(row).toHaveAttribute('data-status', 'todo')

  // Finish it.
  const done = row.getByRole('checkbox', { name: `Mark "${TASK}" done` })
  await done.click()
  await expect(done).toBeChecked()
  await expect(row).toHaveAttribute('data-status', 'done')
})
