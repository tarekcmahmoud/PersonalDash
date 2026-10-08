import { expect, test } from '@playwright/test'
import { goTo, openApp } from './nav'

const XL_TASK = 'Build CMS integration'
const PROJECT = 'Client website redesign'

test('an XL task cannot be planned until it is split into subtasks', async ({ page }) => {
  await openApp(page)

  // Plan page: the XL task is listed but disabled.
  await goTo(page, 'Plan')
  const card = page.getByRole('region', { name: PROJECT })
  // The pick list shows the first three tasks; the XL task is further down.
  await card.getByRole('button', { name: `Show more tasks for ${PROJECT}` }).click()
  const planRow = card.getByTestId('task-row').filter({
    has: page.getByRole('button', { name: XL_TASK, exact: true }),
  })
  await expect(planRow).toHaveCount(1)
  await expect(planRow.getByText('Split first', { exact: true })).toBeVisible()
  await expect(card.getByRole('checkbox', { name: `Plan "${XL_TASK}" this week` })).toBeDisabled()

  // Project page: open the XL task.
  await goTo(page, 'Projects')
  await page.getByRole('link', { name: PROJECT }).first().click()
  await expect(page.getByRole('heading', { level: 1, name: PROJECT })).toBeVisible()
  const build = page.getByRole('region', { name: 'Build', exact: true })
  await build.getByRole('button', { name: XL_TASK, exact: true }).click()

  const dialog = page.getByRole('dialog', { name: 'Edit task' })
  await expect(dialog).toBeVisible()
  // "Split task" is a collapsible that starts open for XL tasks.
  await expect(dialog.getByRole('button', { name: 'Split task', expanded: true })).toBeVisible()

  // Split it into two subtasks.
  await dialog
    .getByRole('textbox', { name: 'Subtasks, one per line' })
    .fill('Model the content types [S]\nBuild the editor [L]')
  await dialog.getByRole('button', { name: 'Split into subtasks' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Split task', exact: true }).click()

  // The dialog closes; the XL task is replaced in place by the two new tasks.
  await expect(dialog).toHaveCount(0)
  await expect(build.getByRole('button', { name: XL_TASK, exact: true })).toHaveCount(0)
  await expect(build.getByTestId('task-row')).toHaveText([
    /Set up staging environment/,
    /Model the content types/,
    /Build the editor/,
    /Build homepage/,
    /Build content pages/,
  ])
  await expect(build.getByRole('button', { name: 'Model the content types', exact: true })).toBeVisible()
  await expect(build.getByRole('button', { name: 'Build the editor', exact: true })).toBeVisible()
})
