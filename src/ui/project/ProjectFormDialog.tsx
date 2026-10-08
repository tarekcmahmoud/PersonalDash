import { Dialog, FormControl, SegmentedControl, Select, TextInput } from '@primer/react'
import { useState, type FormEvent } from 'react'
import { useApply, useSnapshot } from '../../data/hooks'
import { makeProject } from '../../domain/factories'
import type { DateKind, Project, ProjectStatus } from '../../domain/types'
import styles from './ProjectFormDialog.module.css'

interface Props {
  /** Edit this project; omit to create a new one. */
  project?: Project
  onClose: () => void
  /** Called with the saved project (after the write was applied optimistically). */
  onSaved?: (project: Project) => void
}

/** Create / edit a project: name, "done when" outcome, target date (hard/soft), weekly minimum, status. */
export function ProjectFormDialog({ project, onClose, onSaved }: Props) {
  const apply = useApply()
  const { data } = useSnapshot()
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
    <Dialog
      title={project ? 'Edit project' : 'New project'}
      width="large"
      position={{ narrow: 'fullscreen', regular: 'center' }}
      onClose={onClose}
      footerButtons={[
        { content: 'Cancel', onClick: onClose },
        { content: project ? 'Save' : 'Create project', buttonType: 'primary', onClick: () => void save() },
      ]}
    >
      <form className={styles.form} onSubmit={(e) => void save(e)} noValidate>
        <FormControl required>
          <FormControl.Label>Name</FormControl.Label>
          <TextInput
            block
            value={name}
            autoFocus
            validationStatus={show('name') ? 'error' : undefined}
            onChange={(e) => setName(e.target.value)}
          />
          {show('name') && <FormControl.Validation variant="error">{show('name')}</FormControl.Validation>}
        </FormControl>

        <FormControl required={!isSystem}>
          <FormControl.Label>Done when…</FormControl.Label>
          <TextInput
            block
            value={outcome}
            placeholder="The outcome that means this project is finished"
            validationStatus={show('outcome') ? 'error' : undefined}
            onChange={(e) => setOutcome(e.target.value)}
          />
          {show('outcome') && (
            <FormControl.Validation variant="error">{show('outcome')}</FormControl.Validation>
          )}
        </FormControl>

        <div className={styles.row}>
          <FormControl required={!isSystem}>
            <FormControl.Label>Target date</FormControl.Label>
            <TextInput
              type="date"
              value={targetDate}
              validationStatus={show('targetDate') ? 'error' : undefined}
              onChange={(e) => setTargetDate(e.target.value)}
            />
            {show('targetDate') && (
              <FormControl.Validation variant="error">{show('targetDate')}</FormControl.Validation>
            )}
          </FormControl>
          <div className={styles.kind}>
            <span id="date-kind-label" className={styles.kindLabel}>
              Date type
            </span>
            <SegmentedControl
              aria-labelledby="date-kind-label"
              onChange={(i) => setDateKind(i === 0 ? 'soft' : 'hard')}
            >
              <SegmentedControl.Button selected={dateKind === 'soft'}>Soft target</SegmentedControl.Button>
              <SegmentedControl.Button selected={dateKind === 'hard'}>Hard deadline</SegmentedControl.Button>
            </SegmentedControl>
          </div>
        </div>

        {!isSystem && (
          <div className={styles.row}>
            <FormControl>
              <FormControl.Label>Weekly minimum</FormControl.Label>
              <TextInput
                type="number"
                min={0}
                inputMode="numeric"
                value={weeklyMin}
                validationStatus={show('weeklyMin') ? 'error' : undefined}
                onChange={(e) => setWeeklyMin(e.target.value)}
              />
              <FormControl.Caption>Tasks to plan for this project each week (optional).</FormControl.Caption>
              {show('weeklyMin') && (
                <FormControl.Validation variant="error">{show('weeklyMin')}</FormControl.Validation>
              )}
            </FormControl>
            <FormControl>
              <FormControl.Label>Status</FormControl.Label>
              <Select value={status} onChange={(e) => setStatus(e.target.value as ProjectStatus)}>
                <Select.Option value="active">Active</Select.Option>
                <Select.Option value="on_hold">On hold</Select.Option>
                <Select.Option value="done">Done</Select.Option>
              </Select>
            </FormControl>
          </div>
        )}
        <button type="submit" hidden />
      </form>
    </Dialog>
  )
}
