import { Button, Details, Flash, Spinner } from '@primer/react'
import { Link, useLocation } from 'react-router-dom'
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
  const flash = (useLocation().state as { flash?: string } | null)?.flash

  if (isError) return <Flash variant="danger">{`Could not load your data: ${String(error)}`}</Flash>
  if (!ctx) return <Spinner aria-label="Loading" />

  const overview = <ProjectsOverview ctx={ctx} />
  const reviewed = ctx.weeks.some((w) => w.weekStart === ctx.weekStart && w.reviewedAt)
  const hadLastWeek = ctx.tasks.some(
    (t) => t.weekStart !== null && t.weekStart < ctx.weekStart && t.status !== 'done',
  )
  const showReviewNudge = !reviewed && !flash && hadLastWeek

  return (
    <Page title="Today" description={format(parseISO(ctx.today), 'EEEE, MMMM d')} wide>
      {flash && (
        <Flash variant="success" className={styles.flash}>
          {flash}
        </Flash>
      )}
      {showReviewNudge && (
        <Flash className={styles.flash}>
          <div className={styles.nudge}>
            <span>New week: review last week and plan this one.</span>
            <Button as={Link} to="/review" size="small">
              Start weekly review
            </Button>
          </div>
        </Flash>
      )}
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
