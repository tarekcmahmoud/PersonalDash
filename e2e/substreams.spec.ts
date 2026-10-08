import { expect, test, type Locator, type Page } from '@playwright/test'
import { goTo, openApp } from './nav'

/** The seeded Kitchen renovation project (on hold): "Design and ordering" with Cabinets and Appliances substreams. */
async function openKitchen(page: Page) {
  await openApp(page)
  await goTo(page, 'Projects')
  await page.getByRole('button', { name: /On hold/ }).click()
  await page.getByRole('link', { name: 'Kitchen renovation' }).first().click()
  await expect(page.getByRole('heading', { level: 1, name: 'Kitchen renovation' })).toBeVisible()
}

/** Drags a task row by its grip handle and drops it on `target` (a row or a card). */
async function dragTask(page: Page, title: string, target: Locator) {
  const row = page.getByTestId('task-row').filter({ hasText: title })
  await row.hover()
  const handle = (await page.getByRole('button', { name: `Drag to reorder: ${title}` }).boundingBox())!
  const to = (await target.boundingBox())!
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2)
  await page.mouse.down()
  await page.mouse.move(handle.x + 20, handle.y + handle.height / 2, { steps: 5 }) // past the 4px activation
  await page.mouse.move(to.x + to.width / 2, to.y + Math.min(to.height / 2, 24), { steps: 15 })
  await page.mouse.up()
}

test('substreams: Add task below the last substream, and drag tasks into substreams', async ({ page }) => {
  test.skip(
    test.info().project.name === 'phone',
    'Drag handles are desktop-only; phones use the task dialog.',
  )
  // Tall enough that the drop targets are on screen (dragging near the edge auto-scrolls the page).
  await page.setViewportSize({ width: 1280, height: 1300 })
  await openKitchen(page)

  const workstream = page.getByRole('region', { name: 'Design and ordering' })
  const cabinets = page.getByRole('region', { name: 'Cabinets' })
  const appliances = page.getByRole('region', { name: 'Appliances' })

  // The workstream's own "Add task" (with "Add substream") comes after its substream cards.
  const addTask = (await workstream
    .getByRole('button', { name: 'Add task to Design and ordering' })
    .boundingBox())!
  const lastSub = (await appliances.boundingBox())!
  expect(addTask.y).toBeGreaterThan(lastSub.y + lastSub.height - 1)

  // The workstream's own task, dropped on the Appliances card, lands at the end of that substream.
  await dragTask(page, 'Measure the room and draw a floor plan', appliances.getByTestId('substream-card'))
  await expect(appliances.getByTestId('task-row')).toHaveText([
    /Choose oven, hob and extractor/,
    /Measure the room and draw a floor plan/,
  ])

  // A substream task dropped on a row of another substream lands just above that row.
  await dragTask(page, 'Choose oven, hob and extractor', cabinets.getByTestId('task-row').first())
  await expect(cabinets.getByTestId('task-row')).toHaveText([
    /Choose oven, hob and extractor/,
    /Choose cabinet and worktop colours/,
    /Order cabinets and worktop/,
  ])
  await expect(appliances.getByTestId('task-row')).toHaveText([/Measure the room and draw a floor plan/])
})
