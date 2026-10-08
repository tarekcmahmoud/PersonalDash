import type { ReactNode } from 'react'
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
  wide = false,
  children,
}: {
  title: string
  description?: ReactNode
  actions?: ReactNode
  /** Allow content wider than the default reading width (boards). */
  wide?: boolean
  children: ReactNode
}) {
  return (
    <div className={cn('mx-auto w-full', wide ? 'max-w-[1400px]' : 'max-w-[760px]')}>
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
  contentClassName,
}: {
  title: string
  count?: number
  actions?: ReactNode
  children: ReactNode
  className?: string
  contentClassName?: string
}) {
  return (
    <section className={className}>
      <Card className="gap-3">
        <CardHeader>
          <CardTitle>
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
