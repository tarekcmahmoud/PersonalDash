import { CalendarIcon, KebabHorizontalIcon } from '@primer/octicons-react'
import { ActionList, ActionMenu, IconButton } from '@primer/react'
import { format, parseISO } from 'date-fns'
import { useTaskActions } from '../../data/taskActions'
import type { ISODate, Task } from '../../domain/types'
import { weekDays } from '../../domain/week'

/**
 * Menu to move a planned task between the days of its week.
 * "Pin to day" (Plan page) offers Mon..Sun + "No day"; "Move to…" (Week board) offers Mon..Sun + "Any day" + "Unplan".
 */
export function TaskDayMenu({
  task,
  weekStart,
  variant,
}: {
  task: Task
  weekStart: ISODate
  variant: 'pin' | 'move'
}) {
  const actions = useTaskActions()
  const isMove = variant === 'move'
  const label = isMove ? `Move "${task.title}" to…` : `Pin "${task.title}" to a day`

  return (
    <ActionMenu>
      <ActionMenu.Anchor>
        <IconButton
          icon={isMove ? KebabHorizontalIcon : CalendarIcon}
          aria-label={label}
          variant="invisible"
          size="small"
        />
      </ActionMenu.Anchor>
      <ActionMenu.Overlay align="end" width="small">
        <ActionList>
          {weekDays(weekStart).map((day) => (
            <ActionList.Item
              key={day}
              onSelect={() => void actions.pin(task, day)}
              aria-current={task.pinnedDay === day ? 'true' : undefined}
            >
              {format(parseISO(day), 'EEE MMM d')}
              {task.pinnedDay === day && <ActionList.TrailingVisual>current</ActionList.TrailingVisual>}
            </ActionList.Item>
          ))}
          <ActionList.Divider />
          <ActionList.Item onSelect={() => void actions.pin(task, null)}>
            {isMove ? 'Any day' : 'No day'}
            {task.pinnedDay === null && <ActionList.TrailingVisual>current</ActionList.TrailingVisual>}
          </ActionList.Item>
          {isMove && (
            <ActionList.Item variant="danger" onSelect={() => void actions.unplan(task)}>
              Unplan
            </ActionList.Item>
          )}
        </ActionList>
      </ActionMenu.Overlay>
    </ActionMenu>
  )
}
