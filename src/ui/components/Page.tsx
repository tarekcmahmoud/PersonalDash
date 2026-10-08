import { PageHeader } from '@primer/react'
import type { ReactNode } from 'react'
import styles from './Page.module.css'

/** Standard page frame: Primer PageHeader (title, optional description + actions) and content. */
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
  /** Allow content wider than the default reading width (boards, two-column layouts). */
  wide?: boolean
  children: ReactNode
}) {
  return (
    <div className={wide ? styles.wide : styles.narrow}>
      <PageHeader role="banner" aria-label={title} className={styles.header}>
        <PageHeader.TitleArea>
          <PageHeader.Title as="h1">{title}</PageHeader.Title>
        </PageHeader.TitleArea>
        {actions && <PageHeader.Actions>{actions}</PageHeader.Actions>}
        {description && <PageHeader.Description>{description}</PageHeader.Description>}
      </PageHeader>
      {children}
    </div>
  )
}
