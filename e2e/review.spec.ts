import { expect, test } from '@playwright/test'
import { goTo, openApp } from './nav'

test('run the weekly review from the Today nudge to the success message', async ({ page }) => {
  await openApp(page)

  // The nudge is shown because last week has open planned tasks.
  const startReview = page.getByRole('link', { name: 'Start weekly review' })
  await expect(startReview).toBeVisible()
  await startReview.click()
  await expect(page.getByRole('heading', { level: 1, name: 'Weekly review' })).toBeVisible()

  // Step 1: look back.
  await expect(page.getByRole('heading', { level: 2, name: 'Look back' })).toBeVisible()
  const leftOver = page.getByRole('region', { name: 'Left over' })
  await expect(leftOver).toBeVisible()
  const leftOverCount = Number(/(\d+)/.exec(await leftOver.innerText())?.[1])
  expect(leftOverCount).toBeGreaterThanOrEqual(1)
  const next = page.getByRole('button', { name: 'Next', exact: true })
  await next.click()

  // Step 2: every leftover needs a decision before continuing.
  await expect(page.getByRole('heading', { level: 2, name: 'Leftovers' })).toBeVisible()
  await expect(next).toBeDisabled()
  await page.getByRole('button', { name: 'Carry over Agree budget and contract type' }).click()
  await expect(page.getByText(/^Carried over to /)).toBeVisible()
  await expect(next).toBeDisabled()
  await page.getByRole('button', { name: 'Back to project Pick a training plan' }).click()
  await expect(page.getByText(/^Back in .*, not planned$/)).toBeVisible()
  await expect(page.getByText('All decided')).toBeVisible()
  await expect(next).toBeEnabled()
  await next.click()

  // Step 3: file the Inbox task "Renew passport" into Admin / Misc.
  await expect(page.getByRole('heading', { level: 2, name: 'Inbox' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'File to… Renew passport' })).toBeVisible()
  await page.getByRole('button', { name: 'File to… Renew passport' }).click()
  await page.getByRole('menuitem', { name: 'Admin / Misc', exact: true }).click()
  await expect(page.getByRole('button', { name: 'File to… Renew passport' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'File to… Reply to Sam about conference' })).toBeVisible()
  await next.click()

  // Step 4: plan the week, then finish.
  await expect(page.getByRole('heading', { level: 2, name: 'Plan the week' })).toBeVisible()
  await page.getByRole('button', { name: 'Finish review' }).click()

  // Back on Today with the success message.
  await expect(page.getByRole('heading', { level: 1, name: 'Today' })).toBeVisible()
  await expect(page.getByText(/^Weekly review done\./)).toBeVisible()

  // The nudge stays gone after leaving and coming back (the flash message is router state).
  await goTo(page, 'Week')
  await expect(page.getByRole('heading', { level: 1, name: 'Week' })).toBeVisible()
  await goTo(page, 'Today')
  await expect(page.getByRole('heading', { level: 1, name: 'Today' })).toBeVisible()
  await expect(page.getByRole('heading', { level: 2, name: 'Capacity' })).toBeVisible()
  await expect(page.getByText(/^Weekly review done\./)).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Start weekly review' })).toHaveCount(0)
})
