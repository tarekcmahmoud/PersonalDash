import { Label, LabelGroup } from '@primer/react'
import type { HealthFlag } from '../../domain/health'

function FlagLabel({ flag }: { flag: HealthFlag }) {
  switch (flag.kind) {
    case 'neglected':
      return <Label variant="attention">Nothing planned</Label>
    case 'below_min':
      return <Label variant="attention">{`${flag.planned}/${flag.min} this week`}</Label>
    case 'deadline_soon': {
      const text = flag.daysLeft === 0 ? 'Due today' : `Due in ${flag.daysLeft}d`
      return <Label variant={flag.dateKind === 'hard' ? 'severe' : 'accent'}>{text}</Label>
    }
    case 'overdue':
      return <Label variant="danger">{`Overdue ${flag.daysOver}d`}</Label>
    case 'no_next_step':
      return <Label variant="secondary">No next step</Label>
  }
}

/** Project health flags as labels. Renders nothing when there are no flags. */
export function HealthBadges({ flags }: { flags: HealthFlag[] }) {
  if (flags.length === 0) return null
  return (
    <LabelGroup>
      {flags.map((flag) => (
        <FlagLabel key={flag.kind} flag={flag} />
      ))}
    </LabelGroup>
  )
}
