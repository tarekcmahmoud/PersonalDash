import { ArrowLeftIcon, ArrowRightIcon, CheckIcon } from '@primer/octicons-react'
import { Button, Flash, Spinner } from '@primer/react'
import { format, parseISO } from 'date-fns'
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useApply, useSnapshot } from '../../data/hooks'
import { nowISO } from '../../domain/ids'
import { addWeeksISO, formatWeekRange } from '../../domain/week'
import { Page } from '../components/Page'
import { WeekPicker } from '../plan/WeekPicker'
import { InboxTriage } from '../review/InboxTriage'
import { Leftovers } from '../review/Leftovers'
import { LookBack } from '../review/LookBack'
import { Stepper } from '../review/Stepper'
import { REVIEW_STEPS } from '../review/steps'
import { StepIntro } from '../review/StepIntro'
import { useReviewSession } from '../review/useReviewSession'
import { useWeekParam } from '../plan/useWeekParam'
import styles from './ReviewPage.module.css'

const LAST_STEP = REVIEW_STEPS.length

function parseStep(value: string | null): number {
  const n = Number(value)
  return Number.isInteger(n) && n >= 1 && n <= LAST_STEP ? n : 1
}

/**
 * Weekly review: look back at the week that ended, deal with leftovers, triage the Inbox, then plan the new
 * week. Finishing stamps `reviewedAt` on the new week.
 */
export function ReviewPage() {
  const { weekStart: newWeek } = useWeekParam()
  const pastWeek = addWeeksISO(newWeek, -1)
  const { data, isError, error } = useSnapshot()
  const apply = useApply()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const session = useReviewSession(pastWeek, newWeek)
  const [rerun, setRerun] = useState(false)
  const [finishing, setFinishing] = useState(false)

  const step = parseStep(params.get('step'))
  const goTo = useCallback(
    (next: number) =>
      setParams((prev) => {
        const out = new URLSearchParams(prev)
        out.set('step', String(next))
        return out
      }),
    [setParams],
  )

  useEffect(() => {
    window.scrollTo?.(0, 0)
  }, [step])

  const header = (children: ReactNode) => (
    <Page
      title="Weekly review"
      description={`Reviewing ${formatWeekRange(pastWeek)} → planning ${formatWeekRange(newWeek)}`}
    >
      {children}
    </Page>
  )

  if (isError) return header(<Flash variant="danger">{`Could not load your data: ${String(error)}`}</Flash>)
  if (!data || !session) return header(<Spinner aria-label="Loading" />)

  const week = data.weeks.find((w) => w.weekStart === newWeek)

  if (week?.reviewedAt && !rerun) {
    return header(
      <Flash variant="success" className={styles.reviewed}>
        <p className={styles.reviewedText}>
          {`You already reviewed this week on ${format(parseISO(week.reviewedAt), 'EEEE, MMM d')}.`}
        </p>
        <Button onClick={() => setRerun(true)}>Review again</Button>
      </Flash>,
    )
  }

  const unresolved = session.undecided.length
  const nextDisabled = step === 2 && unresolved > 0

  const finish = async () => {
    setFinishing(true)
    try {
      await apply({
        kind: 'saveWeek',
        week: { weekStart: newWeek, capacityOverride: week?.capacityOverride ?? null, reviewedAt: nowISO() },
      })
      navigate('/', { state: { flash: `Weekly review done. ${formatWeekRange(newWeek)} is planned.` } })
    } catch {
      setFinishing(false)
    }
  }

  return header(
    <>
      <Stepper current={step} onSelect={goTo} />

      {step === 1 && <LookBack retro={session.retro} projects={data.projects} />}
      {step === 2 && (
        <Leftovers session={session} projects={data.projects} newWeek={newWeek} pastWeek={pastWeek} />
      )}
      {step === 3 && <InboxTriage />}
      {step === 4 && (
        <div>
          <StepIntro title="Plan the week">{`Pick what you will do in ${formatWeekRange(newWeek)}.`}</StepIntro>
          <WeekPicker weekStart={newWeek} />
        </div>
      )}

      <div className={styles.footer}>
        <div>
          {step > 1 && (
            <Button leadingVisual={ArrowLeftIcon} onClick={() => goTo(step - 1)}>
              Back
            </Button>
          )}
        </div>
        <div className={styles.forward}>
          {nextDisabled && (
            <span className={styles.hint}>
              {`Decide on ${unresolved} more ${unresolved === 1 ? 'task' : 'tasks'} to continue`}
            </span>
          )}
          {step < LAST_STEP ? (
            <Button
              variant="primary"
              trailingVisual={ArrowRightIcon}
              disabled={nextDisabled}
              onClick={() => goTo(step + 1)}
            >
              Next
            </Button>
          ) : (
            <Button
              variant="primary"
              leadingVisual={CheckIcon}
              disabled={finishing}
              onClick={() => void finish()}
            >
              Finish review
            </Button>
          )}
        </div>
      </div>
    </>,
  )
}
