import { ChevronLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

/**
 * Standard page frame: title, optional grey description line and actions, then content.
 * The header is separated from the content by whitespace only; group content with `CardSection`.
 */
export function Page({
  title,
  description,
  actions,
  back,
  wide = false,
  children,
}: {
  title: string
  description?: ReactNode
  actions?: ReactNode
  /** A grey "‹ label" link above the title, back to a parent screen (e.g. Projects from a project). */
  back?: { to: string; label: string }
  /** Allow content wider than the default reading width (boards). */
  wide?: boolean
  children: ReactNode
}) {
  return (
    <div className={cn('mx-auto w-full', wide ? 'max-w-[1400px]' : 'max-w-[760px]')}>
      {back && (
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="mb-2 -ml-2.5 h-8 gap-1 px-2 font-normal text-muted-foreground"
        >
          <Link to={back.to}>
            <ChevronLeft aria-hidden />
            {back.label}
          </Link>
        </Button>
      )}
      <header className="mb-6 flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="min-w-0 flex-1 basis-40">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {description && <div className="mt-1 text-sm text-muted-foreground">{description}</div>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">{actions}</div>}
      </header>
      {children}
    </div>
  )
}

/**
 * A quiet card for what others do for you (delegated work), kept below your own: no fill or shadow, only the
 * card's faint outline on the page background. That background is exposed as `--surface`, so hover overlays
 * inside (FollowUpRow's actions) can match it.
 */
export const SECONDARY_CARD = 'shadow-none bg-(--surface) [--surface:var(--color-background)]'

/**
 * The right-hand pane of a two-column page (Project, Today) on desktop: it stays in view while the page (the
 * left column) scrolls, and scrolls on its own when it is taller than the window. The 4px padding keeps the
 * cards' outlines from being clipped. Phones show one pane at a time, so nothing changes there.
 */
export const SIDE_PANE_SCROLL =
  'lg:sticky lg:top-6 lg:-m-1 lg:max-h-[calc(100dvh-3rem)] lg:overflow-y-auto lg:overscroll-contain lg:p-1 lg:[scrollbar-width:thin]'

/** A titled section: small grey heading + content, no card. Prefer `CardSection` for grouped content. */
export function Section({
  title,
  count,
  actions,
  children,
  className,
}: {
  title: string
  count?: number
  actions?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn('mb-8', className)}>
      <div className="mb-1 flex items-center justify-between gap-2">
        <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {title}
          {count !== undefined && <span className="ml-1.5 text-muted-foreground/60">{count}</span>}
        </h2>
        {actions}
      </div>
      {children}
    </section>
  )
}

/**
 * A titled card: heading (with optional grey count) and actions in the header, content below. Wrap rows in
 * `divide-y` inside it. The `<section>` wrapper carries the landmark; do not nest cards inside.
 */
export function CardSection({
  title,
  count,
  actions,
  children,
  className,
  quiet = false,
  contentClassName,
}: {
  title: string
  count?: number
  actions?: ReactNode
  children: ReactNode
  className?: string
  /** A secondary card (SECONDARY_CARD) with a small grey title, for content that should not compete. */
  quiet?: boolean
  contentClassName?: string
}) {
  return (
    <section className={className}>
      <Card className={cn('gap-3', quiet && SECONDARY_CARD)}>
        <CardHeader>
          <CardTitle className={cn(quiet && 'text-sm text-muted-foreground')}>
            <h2>
              {title}
              {count !== undefined && (
                <span className="ml-1.5 text-sm font-normal text-muted-foreground/60">{count}</span>
              )}
            </h2>
          </CardTitle>
          {actions && <CardAction>{actions}</CardAction>}
        </CardHeader>
        <CardContent className={contentClassName}>{children}</CardContent>
      </Card>
    </section>
  )
}
