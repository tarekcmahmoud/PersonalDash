import { Details, Flash, Spinner } from '@primer/react'
import { format, parseISO } from 'date-fns'
import { usePlanContext, useSnapshot } from '../../data/hooks'
import { Page } from '../components/Page'
import { Section } from '../plan/Section'
import { ProjectsOverview } from '../today/ProjectsOverview'
import { TodayColumn } from '../today/TodayColumn'
import { useIsWide } from '../today/useIsWide'
import styles from './TodayPage.module.css'

/** Home screen: what to do today, plus (on wide screens) an overview of every active project. */
export function TodayPage() {
  const ctx = usePlanContext()
  const { isError, error } = useSnapshot()
  const wide = useIsWide()

  if (isError) return <Flash variant="danger">{`Could not load your data: ${String(error)}`}</Flash>
  if (!ctx) return <Spinner aria-label="Loading" />

  const overview = <ProjectsOverview ctx={ctx} />

  return (
    <Page title="Today" description={format(parseISO(ctx.today), 'EEEE, MMMM d')} wide>
      <div className={styles.layout}>
        <TodayColumn ctx={ctx} />
        {wide ? (
          <div className={styles.side}>
            <Section title="Projects">{overview}</Section>
          </div>
        ) : (
          <Details className={styles.details}>
            <Details.Summary>Projects overview</Details.Summary>
            <div className={styles.detailsBody}>{overview}</div>
          </Details>
        )}
      </div>
    </Page>
  )
}
