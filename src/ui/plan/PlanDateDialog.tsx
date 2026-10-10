import { useId, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useTaskActions } from '../../data/taskActions'
import type { ISODate, Task } from '../../domain/types'
import { weekStartOf } from '../../domain/week'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/**
 * Plans a task on any date from this week on: pinned to that day, or (with "Any day that week") into that day's
 * week without a day.
 */
export function PlanDateDialog({ task, today, onClose }: { task: Task; today: ISODate; onClose: () => void }) {
  const actions = useTaskActions()
  const uid = useId()
  const min = weekStartOf(today)
  const [date, setDate] = useState(task.pinnedDay ?? '')
  const [anyDay, setAnyDay] = useState(false)
  const valid = ISO_DATE.test(date) && date >= min

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (!valid) return
    if (anyDay) await actions.plan({ ...task, pinnedDay: null }, weekStartOf(date))
    else await actions.pin(task, date)
    onClose()
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Plan on a date</DialogTitle>
          <DialogDescription className="truncate">{task.title}</DialogDescription>
        </DialogHeader>
        <form id={`${uid}-form`} className="grid gap-3" onSubmit={(e) => void save(e)}>
          <div className="grid gap-1.5">
            <Label htmlFor={`${uid}-date`} className="text-xs font-normal text-muted-foreground">
              Date
            </Label>
            <Input
              id={`${uid}-date`}
              type="date"
              min={min}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <Label className="flex min-h-8 items-center gap-2 text-sm font-normal">
            <Checkbox checked={anyDay} onCheckedChange={(v) => setAnyDay(v === true)} />
            Any day that week
          </Label>
        </form>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form={`${uid}-form`} disabled={!valid}>
            Plan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
