import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'
import { openApp, openImport } from './nav'

/** The worked example's expected LLM output: the code block right after "Expected output". */
function workedExampleOutline(): string {
  const doc = readFileSync(join(process.cwd(), 'docs', 'breakdown-prompt.md'), 'utf8')
  const after = doc.slice(doc.indexOf('Expected output'))
  const match = /```text\n([\s\S]*?)\n```/.exec(after)
  if (!match) throw new Error('Could not find the worked example output block in docs/breakdown-prompt.md')
  return match[1]!
}

test('import the worked example outline into a new project', async ({ page }) => {
  const outline = workedExampleOutline()
  expect(outline).toContain('# Newsletter landing page')

  await openApp(page)
  await openImport(page)

  await page.getByRole('textbox', { name: 'Outline' }).fill(outline)

  // On the phone the preview lives behind an Edit / Preview switch.
  if (test.info().project.name === 'phone') {
    await page.getByRole('radio', { name: 'Preview', exact: true }).click()
  }
  const preview = page.getByTestId('outline-preview')
  await expect(preview).toContainText('4 milestones')
  await expect(preview).toContainText('Newsletter landing page')

  // The objective form is prefilled from the outline.
  await expect(page.getByRole('textbox', { name: /Project name/ })).toHaveValue('Newsletter landing page')
  await expect(page.getByRole('textbox', { name: /Outcome/ })).toHaveValue(
    'Live landing page collects sign-ups and sends a welcome email',
  )
  await expect(page.getByLabel(/Target date/)).toHaveValue('2026-12-15')
  // "Date type" is a single-select toggle group: the checked item is the current value.
  await expect(page.getByRole('radio', { name: 'Hard deadline' })).toBeChecked()
  await expect(page.getByRole('radio', { name: 'Soft target' })).not.toBeChecked()

  const create = page.getByRole('button', { name: 'Create project' })
  await expect(create).toBeEnabled()
  await create.click()

  // Lands on the new project page.
  await expect(page.getByRole('heading', { level: 1, name: 'Newsletter landing page' })).toBeVisible()
  await expect(page).toHaveURL(/\/projects\/[^/]+$/)
  for (const milestone of ['Foundations', 'Content', 'Build', 'Launch']) {
    await expect(page.getByRole('heading', { level: 2, name: milestone })).toBeVisible()
  }

  // The first task (outside any milestone) is the project's next step.
  const first = page.getByTestId('task-row').filter({
    has: page.getByRole('button', { name: 'Write a one-paragraph pitch for the newsletter', exact: true }),
  })
  await expect(first).toHaveCount(1)
  await expect(first.getByText('Next', { exact: true })).toBeVisible()
  // Only one task carries the label.
  await expect(page.getByText('Next', { exact: true })).toHaveCount(1)
})
