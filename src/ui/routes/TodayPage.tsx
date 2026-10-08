import { format, parseISO } from 'date-fns'
import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { cn } from '@/lib/utils'
import { usePlanContext, useSnapshot } from '../../data/hooks'
import { CapacityLine } from '../components/CapacityBar'
import { Page } from '../components/Page'
import { weekStats } from '../plan/weekStats'
import { TodayColumn } from '../today/TodayColumn'
import { TodayResources } from '../today/TodayResources'

type TodayPane = 'tasks' | 'resources'

/** The pane switch is active navigation, so its selected segment may use the accent fill (as on Project). */
const PANE_ITEM = 'flex-1 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground'

/**
 * Home screen, laid out like a Project page: the tasks (today, then the rest of the week) on the left and the
 * resources for them on the right. Phones show one pane at a time (`?pane=resources`).
 */
export function TodayPage() {
  const ctx = usePlanContext()
  const [params, setParams] = useSearchParams()
  const pane: TodayPane = params.get('pane') === 'resources' ? 'resources' : 'tasks'
  const setPane = (next: TodayPane) => setParams(next === 'tasks' ? {} : { pane: next }, { replace: true })
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
  const paneClass = (name: TodayPane) => cn('min-w-0', pane !== name && 'max-lg:hidden')

  return (
    <Page
      wide
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
        <Card size="sm" className="mb-4 bg-muted/40 py-3 shadow-none">
          <p className="px-4 text-sm text-muted-foreground">
            New week — review last week and plan this one.{' '}
            <Button asChild variant="link" className="h-auto p-0 text-sm">
              <Link to="/review">Start weekly review →</Link>
            </Button>
          </p>
        </Card>
      )}
      <ToggleGroup
        type="single"
        variant="outline"
        aria-label="Today view"
        value={pane}
        onValueChange={(v) => v && setPane(v as TodayPane)}
        className="mb-4 w-full lg:hidden"
      >
        <ToggleGroupItem value="tasks" className={PANE_ITEM}>
          Tasks
        </ToggleGroupItem>
        <ToggleGroupItem value="resources" className={PANE_ITEM}>
          Resources
        </ToggleGroupItem>
      </ToggleGroup>

      <div className="grid items-start gap-x-8 gap-y-6 lg:grid-cols-[minmax(360px,2fr)_3fr]">
        <section
          aria-labelledby="today-tasks-heading"
          data-pane="tasks"
          className={cn(paneClass('tasks'), 'flex flex-col gap-4')}
        >
          <div className="flex min-h-8 items-center">
            <h2 id="today-tasks-heading" className="text-base font-medium">
              Tasks
            </h2>
          </div>
          <TodayColumn ctx={ctx} />
        </section>
        <div data-pane="resources" className={paneClass('resources')}>
          <TodayResources ctx={ctx} />
        </div>
      </div>
    </Page>
  )
}
