import { expect, test, type Page } from '@playwright/test'

export type NavLabel =
  'Today' | 'Week' | 'Plan' | 'Projects' | 'Inbox' | 'Weekly review' | 'Templates' | 'Settings'

const PHONE_PRIMARY: NavLabel[] = ['Today', 'Week', 'Plan', 'Projects']

/** Matches a nav label, tolerating a trailing count ("Inbox 2" / "Inbox (2)"). */
function labelMatcher(label: string): RegExp {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`^${escaped}(?:\\s*\\(?\\d+\\)?)?$`)
}

/**
 * Navigates with the app's own navigation (never `page.goto`, which would reload and reset memory-mode data).
 * Desktop: sidebar link. Phone: bottom tab, or the "More" menu for the secondary destinations.
 */
export async function goTo(page: Page, label: NavLabel): Promise<void> {
  const phone = test.info().project.name === 'phone'
  const nav = page.getByRole('navigation', { name: 'Main' })
  if (phone && !PHONE_PRIMARY.includes(label)) {
    await nav.getByRole('button', { name: 'More' }).click()
    await page.getByRole('menuitem', { name: labelMatcher(label) }).click()
  } else {
    await nav.getByRole('link', { name: labelMatcher(label) }).click()
  }
}

/** Opens the app at the Today page and waits until the seeded data has rendered. */
export async function openApp(page: Page): Promise<void> {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1, name: 'Today' })).toBeVisible()
  await expect(page.getByRole('heading', { level: 2, name: 'Capacity' })).toBeVisible()
}

/** The inbox count shown in navigation: sidebar counter on desktop, "More (n)" on phone. */
export async function inboxCount(page: Page): Promise<number> {
  const phone = test.info().project.name === 'phone'
  const nav = page.getByRole('navigation', { name: 'Main' })
  const text = phone
    ? await nav.getByRole('button', { name: 'More' }).innerText()
    : await nav.getByRole('link', { name: /^Inbox/ }).innerText()
  const m = /(\d+)/.exec(text)
  return m ? Number(m[1]) : 0
}
