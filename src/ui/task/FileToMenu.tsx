import { ArrowRightIcon } from '@primer/octicons-react'
import { ActionList, ActionMenu } from '@primer/react'
import { useApply, useSnapshot } from '../../data/hooks'
import type { ID, Task } from '../../domain/types'
import { endPosition } from '../project/ordering'

/** "File to…" menu: move an Inbox task into an active project (optionally into one of its milestones). */
export function FileToMenu({ task }: { task: Task }) {
  const { data } = useSnapshot()
  const apply = useApply()
  if (!data) return null

  const projects = data.projects
    .filter((p) => p.status === 'active')
    .sort((a, b) => Number(a.isSystem) - Number(b.isSystem) || a.rank - b.rank)

  const fileTo = (projectId: ID, milestoneId: ID | null) =>
    void apply({
      kind: 'saveTasks',
      tasks: [{ ...task, projectId, milestoneId, position: endPosition(data.tasks, projectId, milestoneId) }],
    })

  return (
    <ActionMenu>
      <ActionMenu.Button leadingVisual={ArrowRightIcon} aria-label={`File to… ${task.title}`}>
        File to…
      </ActionMenu.Button>
      <ActionMenu.Overlay width="medium" maxHeight="large">
        <ActionList>
          {projects.map((p, i) => {
            const milestones = data.milestones
              .filter((m) => m.projectId === p.id)
              .sort((a, b) => a.position - b.position)
            return (
              <ActionList.Group key={p.id}>
                {i > 0 && <ActionList.Divider />}
                <ActionList.Item onSelect={() => fileTo(p.id, null)}>{p.name}</ActionList.Item>
                {milestones.map((m) => (
                  <ActionList.Item key={m.id} onSelect={() => fileTo(p.id, m.id)}>
                    {`${p.name} › ${m.name}`}
                  </ActionList.Item>
                ))}
              </ActionList.Group>
            )
          })}
        </ActionList>
      </ActionMenu.Overlay>
    </ActionMenu>
  )
}
