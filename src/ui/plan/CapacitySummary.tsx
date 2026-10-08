import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useApply } from '../../data/hooks'
import type { PlanContext } from '../../domain/context'
import { CapacityBar } from '../components/CapacityBar'
import { weekStats } from './weekStats'

/** Thin capacity bar + grey line, with an "Adjust" link opening a popover to override (or reset) the capacity. */
export function CapacitySummary({ ctx }: { ctx: PlanContext }) {
  const apply = useApply()
  const { capacity, hours } = weekStats(ctx)
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')

  const meta = ctx.weeks.find((w) => w.weekStart === ctx.weekStart)
  const save = (capacityOverride: number | null) => {
    void apply({
      kind: 'saveWeek',
      week: {
        weekStart: ctx.weekStart,
        capacityOverride,
        reviewedAt: meta?.reviewedAt ?? null,
      },
    })
    setOpen(false)
  }

  const parsed = Number(value)
  const valid = value.trim() !== '' && Number.isFinite(parsed) && parsed >= 0

  return (
    <div className="sticky top-0 z-10 mb-4 bg-background pt-1 pb-1">
      <Card size="sm" className="py-3">
        <div className="relative px-4">
          <CapacityBar planned={hours} capacity={capacity.capacity} meetingHours={capacity.meetingHours} />
          <Popover
            open={open}
            onOpenChange={(next) => {
              if (next) setValue(String(capacity.capacity))
              setOpen(next)
            }}
          >
            <PopoverTrigger asChild>
              <Button
                variant="link"
                size="sm"
                className="absolute right-4 bottom-[-6px] h-8 px-0 text-sm font-normal text-muted-foreground"
              >
                Adjust
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-64">
              <form
                className="flex flex-col gap-3"
                onSubmit={(e) => {
                  e.preventDefault()
                  if (valid) save(parsed)
                }}
              >
                <Label htmlFor="capacity-override" className="text-muted-foreground">
                  {capacity.overridden ? 'Capacity (set manually)' : 'Capacity (from your work hours)'}
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="capacity-override"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step={0.5}
                    aria-label="Capacity override in hours"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    className="h-8 w-24"
                  />
                  <span className="text-sm text-muted-foreground">hours</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button type="submit" size="sm" variant="outline" disabled={!valid}>
                    Save
                  </Button>
                  {capacity.overridden && (
                    <Button type="button" size="sm" variant="ghost" onClick={() => save(null)}>
                      Reset to computed
                    </Button>
                  )}
                </div>
              </form>
            </PopoverContent>
          </Popover>
        </div>
      </Card>
    </div>
  )
}
