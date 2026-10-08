import { Dialog, FormControl, SegmentedControl, TextInput } from '@primer/react'
import { useState, type FormEvent } from 'react'
import { useApply } from '../../data/hooks'
import { makeMilestone } from '../../domain/factories'
import type { DateKind, ID, Milestone } from '../../domain/types'
import styles from './ProjectFormDialog.module.css'

interface Props {
  projectId: ID
  /** Edit this milestone; omit to add one. */
  milestone?: Milestone
  /** Position for a new milestone. */
  nextPosition?: number
  onClose: () => void
}

/** Add or edit (rename, target date) a milestone. */
export function MilestoneDialog({ projectId, milestone, nextPosition = 0, onClose }: Props) {
  const apply = useApply()
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
      : makeMilestone({ projectId, position: nextPosition, ...fields })
    await apply({ kind: 'saveMilestones', milestones: [saved] })
    onClose()
  }

  return (
    <Dialog
      title={milestone ? 'Edit milestone' : 'Add milestone'}
      width="large"
      position={{ narrow: 'fullscreen', regular: 'center' }}
      onClose={onClose}
      footerButtons={[
        { content: 'Cancel', onClick: onClose },
        { content: milestone ? 'Save' : 'Add milestone', buttonType: 'primary', onClick: () => void save() },
      ]}
    >
      <form className={styles.form} onSubmit={(e) => void save(e)} noValidate>
        <FormControl required>
          <FormControl.Label>Name</FormControl.Label>
          <TextInput
            block
            autoFocus
            value={name}
            validationStatus={submitted && !name.trim() ? 'error' : undefined}
            onChange={(e) => setName(e.target.value)}
          />
          {submitted && !name.trim() && (
            <FormControl.Validation variant="error">Give the milestone a name.</FormControl.Validation>
          )}
        </FormControl>
        <FormControl>
          <FormControl.Label>Target date</FormControl.Label>
          <TextInput type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
          <FormControl.Caption>Optional.</FormControl.Caption>
        </FormControl>
        {targetDate && (
          <SegmentedControl aria-label="Date type" onChange={(i) => setDateKind(i === 0 ? 'soft' : 'hard')}>
            <SegmentedControl.Button selected={dateKind === 'soft'}>Soft target</SegmentedControl.Button>
            <SegmentedControl.Button selected={dateKind === 'hard'}>Hard deadline</SegmentedControl.Button>
          </SegmentedControl>
        )}
        <button type="submit" hidden />
      </form>
    </Dialog>
  )
}
