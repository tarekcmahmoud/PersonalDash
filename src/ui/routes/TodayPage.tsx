import { format, parseISO } from 'date-fns'
import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { usePlanContext, useSnapshot } from '../../data/hooks'
import { CapacityLine } from '../components/CapacityBar'
import { Page } from '../components/Page'
import { weekStats } from '../plan/weekStats'
import { TodayColumn } from '../today/TodayColumn'

/** Home screen: what to do today, then the rest of this week. */
export function TodayPage() {
  const ctx = usePlanContext()
  const { isError, error } = useSnapshot()
  const location = useLocation()
  const navigate = useNavigate()
  // The router-state flash ("Weekly review done…") is shown once as a toast, then cleared from history.
  const [flash] = useState(() => (location.state as { flash?: string } | null)?.flash)
  const flashed = useRef(false)

  useEffect(() => {
    if (!flash || flashed.current) return
    flashed.current = true
    toast.success(flash)
    navigate(location.pathname, { replace: true, state: null })
  }, [flash, location.pathname, navigate])

  if (isError)
    return (
      <Alert variant="destructive">
        <AlertDescription>{`Could not load your data: ${String(error)}`}</AlertDescription>
      </Alert>
    )
  if (!ctx)
    return (
      <div className="mx-auto flex w-full max-w-[760px] flex-col gap-3" role="status" aria-label="Loading">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-5 w-1/2" />
      </div>
    )

  const reviewed = ctx.weeks.some((w) => w.weekStart === ctx.weekStart && w.reviewedAt)
  const hadLastWeek = ctx.tasks.some(
    (t) => t.weekStart !== null && t.weekStart < ctx.weekStart && t.status !== 'done',
  )
  const showReviewNudge = !reviewed && !flash && hadLastWeek
  const { hours, capacity } = weekStats(ctx)

  return (
    <Page
      title="Today"
      description={
        <>
          {format(parseISO(ctx.today), 'EEEE, MMMM d')}
          {(capacity.capacity > 0 || hours > 0) && (
            <>
              <span className="mx-1.5 text-muted-foreground/60">·</span>
              <CapacityLine planned={hours} capacity={capacity.capacity} suffix=" this week" />
            </>
          )}
        </>
      }
    >
      {showReviewNudge && (
        <p className="-mt-2 mb-8 text-sm text-muted-foreground">
          New week — review last week and plan this one.{' '}
          <Button asChild variant="link" className="h-auto p-0 text-sm">
            <Link to="/review">Start weekly review →</Link>
          </Button>
        </p>
      )}
      <TodayColumn ctx={ctx} />
    </Page>
  )
}
