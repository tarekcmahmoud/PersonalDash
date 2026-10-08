import { expect, test, type Locator } from '@playwright/test'
import { goTo, openApp } from './nav'

const TASK = 'Agree budget and contract type'

/** "Thu Oct 8", the label the day menu uses for a date (date-fns "EEE MMM d", English). */
function dayMenuLabel(date: Date): string {
  const weekday = date.toLocaleDateString('en-US', { weekday: 'short' })
  const month = date.toLocaleDateString('en-US', { month: 'short' })
  return `${weekday} ${month} ${date.getDate()}`
}

/** Hours planned, read from the capacity line "3.5 of 20h planned". */
async function plannedHours(capacityText: Locator): Promise<number> {
  const text = await capacityText.innerText()
  const m = /^([\d.]+) of [\d.]+h planned/.exec(text.trim())
  if (!m) throw new Error(`Unexpected capacity text: ${text}`)
  return Number(m[1])
}

test('plan a neglected project task, move it to today on the Week board, and finish it from Today', async ({
  page,
}) => {
  await openApp(page)
  await goTo(page, 'Plan')
  await expect(page.getByRole('heading', { level: 1, name: 'Plan the week' })).toBeVisible()

  const card = page.getByRole('region', { name: 'Hire a designer' })
  await expect(card.getByText('Nothing planned', { exact: true })).toBeVisible()
  await expect(card.getByText('0 planned', { exact: true })).toBeVisible()

  const capacity = page.getByText(/^[\d.]+ of [\d.]+h planned/)
  const before = await plannedHours(capacity)

  // Plan the task for this week.
  const planToggle = card.getByRole('checkbox', { name: `Plan "${TASK}" this week` })
  await planToggle.click()
  await expect(planToggle).toBeChecked()

  await expect(card.getByText('Nothing planned', { exact: true })).toHaveCount(0)
  await expect(card.getByText('1 planned', { exact: true })).toBeVisible()
  await expect.poll(() => plannedHours(capacity)).toBeGreaterThan(before)

  // Week board: the task sits in "Any day"; move it to today with its "Move to…" menu.
  await goTo(page, 'Week')
  await expect(page.getByRole('heading', { level: 1, name: 'Week' })).toBeVisible()
  const weekRow = page.getByTestId('task-row').filter({
    has: page.getByRole('button', { name: TASK, exact: true }),
  })
  await expect(weekRow).toHaveCount(1)
  await weekRow.hover()
  await weekRow.getByRole('button', { name: `Move "${TASK}" to…` }).click()
  await page.getByRole('menuitem', { name: new RegExp(`^${dayMenuLabel(new Date())}\\b`) }).click()

  // The task is now pinned to today and shows up in the "Today" section of the Today page.
  await goTo(page, 'Today')
  await expect(page.getByRole('heading', { level: 1, name: 'Today' })).toBeVisible()
  const todaySection = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { level: 2, name: 'Today', exact: true }) })
  const row = todaySection.getByTestId('task-row').filter({
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
