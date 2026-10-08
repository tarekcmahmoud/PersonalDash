import { useId, useState, type FormEvent, type ReactNode } from 'react'
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useApply, useSnapshot } from '../../data/hooks'
import { makeProject } from '../../domain/factories'
import type { DateKind, Project, ProjectStatus } from '../../domain/types'

interface Props {
  /** Edit this project; omit to create a new one. */
  project?: Project
  onClose: () => void
  /** Called with the saved project (after the write was applied optimistically). */
  onSaved?: (project: Project) => void
}

function Field({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string
  label: string
  error?: string | null
  hint?: string
  children: ReactNode
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id} className="text-xs font-normal text-muted-foreground">
        {label}
      </Label>
      {children}
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : (
        hint && <p className="text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  )
}

/** Create / edit a project: name, "done when" outcome, target date (hard/soft), weekly minimum, status. */
export function ProjectFormDialog({ project, onClose, onSaved }: Props) {
  const apply = useApply()
  const { data } = useSnapshot()
  const uid = useId()
  const isSystem = project?.isSystem ?? false

  const [name, setName] = useState(project?.name ?? '')
  const [outcome, setOutcome] = useState(project?.outcome ?? '')
  const [targetDate, setTargetDate] = useState(project?.targetDate ?? '')
  const [dateKind, setDateKind] = useState<DateKind>(project?.dateKind ?? 'soft')
  const [weeklyMin, setWeeklyMin] = useState(project?.weeklyMin?.toString() ?? '')
  const [status, setStatus] = useState<ProjectStatus>(project?.status ?? 'active')
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)

  const weeklyMinValue = weeklyMin.trim() === '' ? null : Number(weeklyMin)
  const errors = {
    name: name.trim() ? null : 'Give the project a name.',
    outcome: isSystem || outcome.trim() ? null : 'Describe what “done” looks like.',
    targetDate: isSystem || targetDate ? null : 'Pick a target date.',
    weeklyMin:
      weeklyMinValue === null || (Number.isInteger(weeklyMinValue) && weeklyMinValue >= 0)
        ? null
        : 'Use a whole number (0 or more).',
  }
  const valid = Object.values(errors).every((e) => e === null)
  const show = (key: keyof typeof errors) => (submitted ? errors[key] : null)

  const save = async (e?: FormEvent) => {
    e?.preventDefault()
    setSubmitted(true)
    if (!valid || saving) return
    setSaving(true)
    let saved: Project
    if (project) {
      saved = {
        ...project,
        name: name.trim(),
        outcome: outcome.trim(),
        targetDate: targetDate || null,
        dateKind,
        weeklyMin: weeklyMinValue,
        status: isSystem ? 'active' : status,
      }
    } else {
      const activeRanks = (data?.projects ?? [])
        .filter((p) => p.status === 'active' && !p.isSystem)
        .map((p) => p.rank)
      saved = makeProject({
        name: name.trim(),
        outcome: outcome.trim(),
        targetDate: targetDate || null,
        dateKind,
        weeklyMin: weeklyMinValue,
        status,
        rank: activeRanks.length > 0 ? Math.max(...activeRanks) + 1 : 1,
      })
    }
    try {
      await apply({ kind: 'saveProjects', projects: [saved] })
      onSaved?.(saved)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[100dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{project ? 'Edit project' : 'New project'}</DialogTitle>
          <DialogDescription className="sr-only">
            Name, what done looks like, and when it should be finished.
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={(e) => void save(e)} noValidate>
          <Field id={`${uid}-name`} label="Name" error={show('name')}>
            <Input
              id={`${uid}-name`}
              autoFocus
              value={name}
              aria-invalid={show('name') ? true : undefined}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>

          <Field id={`${uid}-outcome`} label="Done when…" error={show('outcome')}>
            <Input
              id={`${uid}-outcome`}
              value={outcome}
              placeholder="The outcome that means this project is finished"
              aria-invalid={show('outcome') ? true : undefined}
              onChange={(e) => setOutcome(e.target.value)}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field id={`${uid}-date`} label="Target date" error={show('targetDate')}>
              <Input
                id={`${uid}-date`}
                type="date"
                value={targetDate}
                aria-invalid={show('targetDate') ? true : undefined}
                onChange={(e) => setTargetDate(e.target.value)}
              />
            </Field>
            <div className="grid content-start gap-1.5">
              <Label className="text-xs font-normal text-muted-foreground">Date type</Label>
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
            </div>
          </div>

          {!isSystem && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                id={`${uid}-min`}
                label="Weekly minimum"
                error={show('weeklyMin')}
                hint="Tasks to plan each week (optional)."
              >
                <Input
                  id={`${uid}-min`}
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={weeklyMin}
                  aria-invalid={show('weeklyMin') ? true : undefined}
                  onChange={(e) => setWeeklyMin(e.target.value)}
                />
              </Field>
              <Field id={`${uid}-status`} label="Status">
                <Select value={status} onValueChange={(v) => setStatus(v as ProjectStatus)}>
                  <SelectTrigger id={`${uid}-status`} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="on_hold">On hold</SelectItem>
                    <SelectItem value="done">Done</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
          )}

          <DialogFooter className="mt-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">{project ? 'Save' : 'Create project'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
