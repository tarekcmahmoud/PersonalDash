import { MoreHorizontal } from 'lucide-react'
import { Suspense } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { useSnapshot } from '../data/hooks'
import { CalendarReconnectBanner, CalendarSync } from '../integrations/gcal/CalendarSync'
import { NAV_ITEMS, type NavItem } from './nav'

function isActive(pathname: string, to: string) {
  return to === '/' ? pathname === '/' : pathname === to || pathname.startsWith(to + '/')
}

function RailLink({ item, active, badge }: { item: NavItem; active: boolean; badge: number }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <NavLink
          to={item.to}
          aria-label={badge > 0 ? `${item.label} (${badge})` : item.label}
          aria-current={active ? 'page' : undefined}
          className={cn(
            'relative flex size-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
            active && 'text-foreground',
          )}
        >
          {active && (
            <span aria-hidden className="absolute top-2 bottom-2 -left-2 w-0.5 rounded-full bg-primary" />
          )}
          <item.icon className="size-5" strokeWidth={1.75} />
          {badge > 0 && (
            <span
              aria-hidden
              className="absolute top-1.5 right-1.5 size-2 rounded-full bg-primary ring-2 ring-background"
            />
          )}
        </NavLink>
      </TooltipTrigger>
      <TooltipContent side="right">
        {item.label}
        {badge > 0 ? ` (${badge})` : ''}
      </TooltipContent>
    </Tooltip>
  )
}

/** Layout: a quiet 56px icon rail on wide screens; a slim bottom tab bar (+ "More" menu) on phones. */
export function AppShell() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { data } = useSnapshot()
  const inboxCount = data?.tasks.filter((t) => t.projectId === null && t.status !== 'done').length ?? 0
  const badgeFor = (item: NavItem) => (item.to === '/inbox' ? inboxCount : 0)

  return (
    <div className="min-h-screen md:grid md:grid-cols-[56px_minmax(0,1fr)]">
      <nav
        aria-label="Main"
        className="sticky top-0 hidden h-screen flex-col items-center justify-between border-r py-3 md:flex"
      >
        <div className="flex flex-col items-center gap-1">
          {NAV_ITEMS.filter((i) => i.primary).map((item) => (
            <RailLink key={item.to} item={item} active={isActive(pathname, item.to)} badge={badgeFor(item)} />
          ))}
        </div>
        <div className="flex flex-col items-center gap-1">
          {NAV_ITEMS.filter((i) => !i.primary).map((item) => (
            <RailLink key={item.to} item={item} active={isActive(pathname, item.to)} badge={badgeFor(item)} />
          ))}
        </div>
      </nav>

      <main className="min-w-0 px-4 pt-6 pb-24 md:px-10 md:pt-10 md:pb-12">
        <CalendarSync />
        <div className="mx-auto max-w-[760px] empty:hidden [&:not(:empty)]:mb-4">
          <CalendarReconnectBanner />
        </div>
        <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
          <Outlet />
        </Suspense>
      </main>

      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-10 flex border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        {NAV_ITEMS.filter((i) => i.primary).map((item) => {
          const active = isActive(pathname, item.to)
          return (
            <NavLink
              key={item.to}
              to={item.to}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex flex-1 flex-col items-center gap-1 py-2 text-[11px] text-muted-foreground',
                active && 'text-foreground',
              )}
            >
              <item.icon className="size-5" strokeWidth={active ? 2.25 : 1.75} />
              <span>{item.label}</span>
            </NavLink>
          )
        })}
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="More"
            className="relative flex flex-1 flex-col items-center gap-1 py-2 text-[11px] text-muted-foreground"
          >
            <MoreHorizontal className="size-5" strokeWidth={1.75} />
            <span>More{inboxCount > 0 ? ` (${inboxCount})` : ''}</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top" className="min-w-44">
            {NAV_ITEMS.filter((i) => !i.primary).map((item) => (
              <DropdownMenuItem key={item.to} onSelect={() => navigate(item.to)}>
                <item.icon />
                {item.label}
                {item.to === '/inbox' && inboxCount > 0 && (
                  <span className="ml-auto text-xs text-muted-foreground">{inboxCount}</span>
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </nav>
    </div>
  )
}
