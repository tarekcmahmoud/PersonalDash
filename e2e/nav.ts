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
 * Desktop: dock link. Phone: bottom tab, or the "More" menu for the secondary destinations.
 */
export async function goTo(page: Page, label: NavLabel): Promise<void> {
  const phone = test.info().project.name === 'phone'
  const nav = page.getByRole('navigation', { name: 'Main' })
  if (phone && !PHONE_PRIMARY.includes(label)) {
    await nav.getByRole('button', { name: /^More/ }).click()
    await page.getByRole('menuitem', { name: labelMatcher(label) }).click()
  } else {
    await nav.getByRole('link', { name: labelMatcher(label) }).click()
  }
}

/** Opens the app at the Today page and waits until the seeded data has rendered. */
export async function openApp(page: Page): Promise<void> {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1, name: 'Today' })).toBeVisible()
  await expect(page.getByText(/of [\d.]+h this week/)).toBeVisible()
}

/** The inbox count shown in navigation: dock counter on desktop, "More (n)" on phone. */
export async function inboxCount(page: Page): Promise<number> {
  const phone = test.info().project.name === 'phone'
  const nav = page.getByRole('navigation', { name: 'Main' })
  const text = phone
    ? await nav.getByRole('button', { name: /^More/ }).innerText()
    : ((await nav.getByRole('link', { name: /^Inbox/ }).getAttribute('aria-label')) ?? '')
  const m = /(\d+)/.exec(text)
  return m ? Number(m[1]) : 0
}

/** Opens the Import breakdown page from Projects ("More actions" menu next to "New project"). */
export async function openImport(page: Page): Promise<void> {
  await goTo(page, 'Projects')
  await page.getByRole('button', { name: 'More actions' }).click()
  await page.getByRole('menuitem', { name: 'Import breakdown' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Import breakdown' })).toBeVisible()
}
