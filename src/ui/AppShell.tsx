import { KebabHorizontalIcon } from '@primer/octicons-react'
import { ActionList, ActionMenu, CounterLabel, NavList } from '@primer/react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useSnapshot } from '../data/hooks'
import { CalendarReconnectBanner, CalendarSync } from '../integrations/gcal/CalendarSync'
import styles from './AppShell.module.css'
import { NAV_ITEMS } from './nav'

function isActive(pathname: string, to: string) {
  return to === '/' ? pathname === '/' : pathname === to || pathname.startsWith(to + '/')
}

/** Layout: sidebar NavList on wide screens, bottom tab bar (+ "More" menu) on phones. */
export function AppShell() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { data } = useSnapshot()
  const inboxCount = data?.tasks.filter((t) => t.projectId === null && t.status !== 'done').length ?? 0

  return (
    <div className={styles.shell}>
      <nav className={styles.sidebar} aria-label="Main">
        <div className={styles.brand}>PersonalDash</div>
        <NavList>
          {NAV_ITEMS.map((item) => (
            <NavList.Item
              key={item.to}
              as={NavLink}
              to={item.to}
              aria-current={isActive(pathname, item.to) ? 'page' : undefined}
            >
              <NavList.LeadingVisual>
                <item.icon />
              </NavList.LeadingVisual>
              {item.label}
              {item.to === '/inbox' && inboxCount > 0 && (
                <NavList.TrailingVisual>
                  <CounterLabel>{inboxCount}</CounterLabel>
                </NavList.TrailingVisual>
              )}
            </NavList.Item>
          ))}
        </NavList>
      </nav>

      <main className={styles.main}>
        <CalendarSync />
        <div className={styles.banner}>
          <CalendarReconnectBanner />
        </div>
        <Outlet />
      </main>

      <nav className={styles.bottomBar} aria-label="Main">
        {NAV_ITEMS.filter((i) => i.primary).map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={styles.tab}
            aria-current={isActive(pathname, item.to) ? 'page' : undefined}
          >
            <item.icon size={20} />
            <span>{item.label}</span>
          </NavLink>
        ))}
        <ActionMenu>
          <ActionMenu.Anchor>
            <button type="button" className={styles.tab} aria-label="More">
              <KebabHorizontalIcon size={20} />
              <span>More{inboxCount > 0 ? ` (${inboxCount})` : ''}</span>
            </button>
          </ActionMenu.Anchor>
          <ActionMenu.Overlay align="end">
            <ActionList>
              {NAV_ITEMS.filter((i) => !i.primary).map((item) => (
                <ActionList.Item key={item.to} onSelect={() => navigate(item.to)}>
                  <ActionList.LeadingVisual>
                    <item.icon />
                  </ActionList.LeadingVisual>
                  {item.label}
                  {item.to === '/inbox' && inboxCount > 0 && (
                    <ActionList.TrailingVisual>{inboxCount}</ActionList.TrailingVisual>
                  )}
                </ActionList.Item>
              ))}
            </ActionList>
          </ActionMenu.Overlay>
        </ActionMenu>
      </nav>
    </div>
  )
}
