import { expect, test } from '@playwright/test'
import { goTo, openApp } from './nav'

const TASK = 'Draft sitemap' // seeded: planned this week, no day ("Any day" column)

/** Region label of a day column, e.g. "Monday October 5" (date-fns "EEEE MMMM d", English). */
function dayRegionName(date: Date): string {
  const weekday = date.toLocaleDateString('en-US', { weekday: 'long' })
  const month = date.toLocaleDateString('en-US', { month: 'long' })
  return `${weekday} ${month} ${date.getDate()}`
}

test('drag a task from "Any day" onto a day of the week, then back', async ({ page }) => {
  test.skip(
    test.info().project.name === 'phone',
    'Mouse drag on the desktop board; phones use press-and-hold.',
  )
  await openApp(page)
  await goTo(page, 'Week')

  const anyDay = page.getByRole('region', { name: 'This week, any day' })
  // Monday of the current week.
  const now = new Date()
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7))
  const mondayColumn = page.getByRole('region', { name: dayRegionName(monday) })

  const row = anyDay.getByTestId('task-row').filter({ hasText: TASK })
  await expect(row).toBeVisible()

  const drag = async (from: typeof row, to: typeof mondayColumn) => {
    const a = (await from.boundingBox())!
    const b = (await to.boundingBox())!
    await page.mouse.move(a.x + 12, a.y + a.height / 2)
    await page.mouse.down()
    await page.mouse.move(a.x + 30, a.y + a.height / 2, { steps: 5 }) // past the 6px activation distance
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 12 })
    await page.mouse.up()
  }

  await drag(row, mondayColumn)
  await expect(mondayColumn.getByTestId('task-row').filter({ hasText: TASK })).toBeVisible()
  await expect(anyDay.getByTestId('task-row').filter({ hasText: TASK })).toHaveCount(0)

  // And back to "Any day".
  await drag(mondayColumn.getByTestId('task-row').filter({ hasText: TASK }), anyDay)
  await expect(anyDay.getByTestId('task-row').filter({ hasText: TASK })).toBeVisible()
  await expect(mondayColumn.getByTestId('task-row').filter({ hasText: TASK })).toHaveCount(0)
})
