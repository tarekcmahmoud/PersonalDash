import { expect, test } from '@playwright/test'
import { goTo, inboxCount, openApp } from './nav'

const TITLE = 'Water the office plants'

test('capture a task in the Inbox and file it into a project', async ({ page }) => {
  await openApp(page)
  await goTo(page, 'Inbox')
  await expect(page.getByRole('heading', { level: 1, name: 'Inbox' })).toBeVisible()

  // The seed has two Inbox tasks.
  await expect(page.getByRole('button', { name: 'File to… Renew passport' })).toBeVisible()
  const initial = await inboxCount(page)
  expect(initial).toBeGreaterThanOrEqual(2)

  // Quick capture.
  const capture = page.getByRole('textbox', { name: 'Capture a task' })
  await capture.fill(TITLE)
  await capture.press('Enter')
  await expect(capture).toHaveValue('')
  const row = page.getByTestId('task-row').filter({
    has: page.getByRole('button', { name: TITLE, exact: true }),
  })
  await expect(row).toHaveCount(1)
  await expect.poll(() => inboxCount(page)).toBe(initial + 1)

  // File it into a project.
  await row.getByRole('button', { name: `File to… ${TITLE}` }).click()
  await page.getByRole('menuitem', { name: 'Hire a designer', exact: true }).click()

  await expect(page.getByRole('button', { name: TITLE, exact: true })).toHaveCount(0)
  await expect.poll(() => inboxCount(page)).toBe(initial)
  // The other Inbox tasks are still there.
  await expect(page.getByRole('button', { name: 'File to… Renew passport' })).toBeVisible()

  // It now lives in the project.
  await goTo(page, 'Projects')
  await page.getByRole('link', { name: 'Hire a designer' }).first().click()
  await expect(page.getByRole('heading', { level: 1, name: 'Hire a designer' })).toBeVisible()
  await expect(page.getByRole('button', { name: TITLE, exact: true })).toBeVisible()
})
