import { expect, test } from '@playwright/test'
import { goTo, openApp } from './nav'

test('project page: resources grid and workstream focus mode', async ({ page }) => {
  await openApp(page)
  await goTo(page, 'Projects')
  await page.getByRole('link', { name: 'Client website redesign' }).first().click()
  await expect(page.getByRole('heading', { level: 1, name: 'Client website redesign' })).toBeVisible()

  // Phones show one pane at a time.
  if (test.info().project.name === 'phone') await page.getByRole('radio', { name: 'Resources' }).click()

  const cards = page.getByTestId('resource-card')
  await expect(cards).toHaveCount(5)
  const card = (title: string) => cards.filter({ hasText: title })

  // Focus on Design: Design-linked and project-wide resources stay in colour, others grey out.
  await page.getByRole('button', { name: 'Focus', exact: true }).click()
  await page.getByRole('menuitemradio', { name: 'Design' }).click()
  await expect(page.getByText('Focusing on')).toBeVisible()
  await expect(card('Brand guidelines')).toHaveAttribute('data-dimmed', 'false')
  await expect(card('Competitor moodboard')).toHaveAttribute('data-dimmed', 'false')
  await expect(card('Shared project folder')).toHaveAttribute('data-dimmed', 'false')
  await expect(card('Hosting dashboard')).toHaveAttribute('data-dimmed', 'true')
  await expect(card('Client brief')).toHaveAttribute('data-dimmed', 'true')

  // Esc leaves focus mode.
  await page.keyboard.press('Escape')
  await expect(page.getByText('Focusing on')).toHaveCount(0)
  await expect(card('Hosting dashboard')).toHaveAttribute('data-dimmed', 'false')
})
