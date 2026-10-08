import { ArrowLeft, ArrowRight, Check } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
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

  if (isError)
    return header(
      <Alert variant="destructive">
        <AlertDescription>{`Could not load your data: ${String(error)}`}</AlertDescription>
      </Alert>,
    )
  if (!data || !session)
    return header(
      <div role="status" aria-label="Loading" className="flex flex-col gap-3">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-32 w-full" />
      </div>,
    )

  const week = data.weeks.find((w) => w.weekStart === newWeek)

  if (week?.reviewedAt && !rerun) {
    return header(
      <p className="text-sm text-muted-foreground">
        {`You already reviewed this week on ${format(parseISO(week.reviewedAt), 'EEEE, MMM d')}.`}{' '}
        <Button variant="link" size="sm" className="h-auto p-0" onClick={() => setRerun(true)}>
          Review again
        </Button>
      </p>,
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
      <Stepper current={step} />

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

      <div className="mt-10 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div>
          {step > 1 && (
            <Button variant="ghost" onClick={() => goTo(step - 1)}>
              <ArrowLeft />
              Back
            </Button>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2">
          {nextDisabled && (
            <span className="text-sm text-muted-foreground">
              {`Decide on ${unresolved} more ${unresolved === 1 ? 'task' : 'tasks'} to continue`}
            </span>
          )}
          {step < LAST_STEP ? (
            <Button disabled={nextDisabled} onClick={() => goTo(step + 1)}>
              Next
              <ArrowRight />
            </Button>
          ) : (
            <Button disabled={finishing} onClick={() => void finish()}>
              <Check />
              Finish review
            </Button>
          )}
        </div>
      </div>
    </>,
  )
}
