import { Progress } from '@/components/ui/progress'
import { REVIEW_STEPS } from './steps'

/** "Step 2 of 4 · Leftovers" as a grey line over a thin progress bar. */
export function Stepper({ current }: { current: number }) {
  return (
    <nav aria-label="Review steps" className="mb-8 flex flex-col gap-2">
      <span className="text-sm text-muted-foreground" aria-current="step">
        {`Step ${current} of ${REVIEW_STEPS.length} · ${REVIEW_STEPS[current - 1]}`}
      </span>
      <Progress aria-label="Review progress" value={(current / REVIEW_STEPS.length) * 100} className="h-1" />
    </nav>
  )
}
