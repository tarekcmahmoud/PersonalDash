import { expect, test } from '@playwright/test'
import { goTo, openApp, openImport, type NavLabel } from './nav'

const ROUTES: { label: NavLabel; heading: string }[] = [
  { label: 'Week', heading: 'Week' },
  { label: 'Plan', heading: 'Plan the week' },
  { label: 'Projects', heading: 'Projects' },
  { label: 'Inbox', heading: 'Inbox' },
  { label: 'Weekly review', heading: 'Weekly review' },
  { label: 'Templates', heading: 'Templates' },
  { label: 'Settings', heading: 'Settings' },
  { label: 'Today', heading: 'Today' },
]

test('every route renders its heading without console or page errors', async ({ page }) => {
  const problems: string[] = []
  page.on('pageerror', (err) => problems.push(`pageerror: ${err.message}`))
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return
    const text = msg.text()
    const url = msg.location().url
    if (/favicon/i.test(text) || /favicon/i.test(url)) return
    problems.push(`console.error: ${text}`)
  })
  page.on('response', (res) => {
    if (res.status() >= 400 && !/favicon/i.test(res.url())) problems.push(`HTTP ${res.status()} ${res.url()}`)
  })

  await openApp(page)

  for (const { label, heading } of ROUTES) {
    await goTo(page, label)
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible()
  }

  // Routes that are not in the main navigation.
  await openImport(page)

  await goTo(page, 'Projects')
  await page.getByRole('link', { name: 'Client website redesign' }).first().click()
  await expect(page.getByRole('heading', { level: 1, name: 'Client website redesign' })).toBeVisible()

  expect(problems).toEqual([])
})
