import { useId, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
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
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useApply } from '../../data/hooks'
import { makeMilestone } from '../../domain/factories'
import type { DateKind, ID, Milestone } from '../../domain/types'

interface Props {
  projectId: ID
  /** Edit this workstream; omit to add one. */
  milestone?: Milestone
  /** Position for a new workstream (or substream, among its siblings). */
  nextPosition?: number
  /** Add a substream of this workstream (ignored when editing). */
  parentId?: ID | null
  onClose: () => void
}

/** Add or edit (rename, target date) a workstream or a substream. */
export function MilestoneDialog({ projectId, milestone, nextPosition = 0, parentId = null, onClose }: Props) {
  const kind = (milestone ? milestone.parentId : parentId) ? 'substream' : 'workstream'
  const apply = useApply()
  const uid = useId()
  const [name, setName] = useState(milestone?.name ?? '')
  const [targetDate, setTargetDate] = useState(milestone?.targetDate ?? '')
  const [dateKind, setDateKind] = useState<DateKind>(milestone?.dateKind ?? 'soft')
  const [submitted, setSubmitted] = useState(false)

  const save = async (e?: FormEvent) => {
    e?.preventDefault()
    setSubmitted(true)
    if (!name.trim()) return
    const fields = {
      name: name.trim(),
      targetDate: targetDate || null,
      dateKind: targetDate ? dateKind : null,
    }
    const saved = milestone
      ? { ...milestone, ...fields }
      : makeMilestone({ projectId, parentId, position: nextPosition, ...fields })
    await apply({ kind: 'saveMilestones', milestones: [saved] })
    onClose()
  }

  const nameError = submitted && !name.trim() ? `Give the ${kind} a name.` : null

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{milestone ? `Edit ${kind}` : `Add ${kind}`}</DialogTitle>
          <DialogDescription className="sr-only">Name and optional target date.</DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={(e) => void save(e)} noValidate>
          <div className="grid gap-1.5">
            <Label htmlFor={`${uid}-name`} className="text-xs font-normal text-muted-foreground">
              Name
            </Label>
            <Input
              id={`${uid}-name`}
              autoFocus
              value={name}
              aria-invalid={nameError ? true : undefined}
              onChange={(e) => setName(e.target.value)}
            />
            {nameError && <p className="text-xs text-destructive">{nameError}</p>}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`${uid}-date`} className="text-xs font-normal text-muted-foreground">
              Target date (optional)
            </Label>
            <Input
              id={`${uid}-date`}
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
            />
          </div>
          {targetDate && (
            <ToggleGroup
              type="single"
              variant="outline"
              aria-label="Date type"
              value={dateKind}
              onValueChange={(v) => v && setDateKind(v as DateKind)}
            >
              <ToggleGroupItem value="soft">Soft target</ToggleGroupItem>
              <ToggleGroupItem value="hard">Hard deadline</ToggleGroupItem>
            </ToggleGroup>
          )}
          <DialogFooter className="mt-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">{milestone ? 'Save' : `Add ${kind}`}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
