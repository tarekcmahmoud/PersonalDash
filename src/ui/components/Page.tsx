import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Standard page frame: title, optional grey description line and actions, then content.
 * No boxes — the header is separated by whitespace only.
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
      <header className="mb-6 flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {description && <div className="mt-1 text-sm text-muted-foreground">{description}</div>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </header>
      {children}
    </div>
  )
}

/** A titled section: small grey heading + content. Use instead of cards. */
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
