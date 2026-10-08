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
  const step = (n: number, name: string) => page.getByText(`Step ${n} of 4 · ${name}`, { exact: true })
  await expect(step(1, 'Look back')).toBeVisible()
  const summary = page.getByText(/\d+ left over\./)
  await expect(summary).toBeVisible()
  const leftOverCount = Number(/(\d+) left over/.exec(await summary.innerText())?.[1])
  expect(leftOverCount).toBeGreaterThanOrEqual(1)
  const next = page.getByRole('button', { name: 'Next', exact: true })
  await next.click()

  // Step 2: every leftover needs a decision before continuing.
  await expect(step(2, 'Leftovers')).toBeVisible()
  await expect(next).toBeDisabled()
  await expect(page.getByText(/^Decide on \d+ more tasks? to continue$/)).toBeVisible()
  await page.getByRole('button', { name: 'Carry over Agree budget and contract type' }).click()
  await expect(page.getByText('Carried over', { exact: true })).toBeVisible()
  await expect(next).toBeDisabled()
  await page.getByRole('button', { name: 'Back to project Pick a training plan' }).click()
  await expect(page.getByText('Back in project', { exact: true })).toBeVisible()
  await expect(page.getByText(/^Decide on \d+ more tasks? to continue$/)).toHaveCount(0)
  await expect(next).toBeEnabled()
  await next.click()

  // Step 3: file the Inbox task "Renew passport" into Admin / Misc.
  await expect(step(3, 'Inbox')).toBeVisible()
  await expect(page.getByRole('button', { name: 'File to… Renew passport' })).toBeVisible()
  await page.getByRole('button', { name: 'File to… Renew passport' }).click()
  await page.getByRole('menuitem', { name: 'Admin / Misc', exact: true }).click()
  await expect(page.getByRole('button', { name: 'File to… Renew passport' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'File to… Reply to Sam about conference' })).toBeVisible()
  await next.click()

  // Step 4: plan the week, then finish.
  await expect(step(4, 'Plan the week')).toBeVisible()
  await page.getByRole('button', { name: 'Finish review' }).click()

  // Back on Today with the success toast.
  await expect(page.getByRole('heading', { level: 1, name: 'Today' })).toBeVisible()
  await expect(page.getByText(/^Weekly review done\./).first()).toBeVisible()

  // The nudge stays gone after leaving and coming back.
  await goTo(page, 'Week')
  await expect(page.getByRole('heading', { level: 1, name: 'Week' })).toBeVisible()
  await goTo(page, 'Today')
  await expect(page.getByRole('heading', { level: 1, name: 'Today' })).toBeVisible()
  await expect(page.getByText(/of [\d.]+h this week/)).toBeVisible()
  await expect(page.getByRole('link', { name: 'Start weekly review' })).toHaveCount(0)
})
