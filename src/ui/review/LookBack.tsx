import { ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import type { WeekRetro } from '../../domain/review'
import type { ID, Project } from '../../domain/types'
import { StepIntro } from './StepIntro'

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`

/** A closed-by-default list: chevron, name, grey count. */
function Group({ name, count, children }: { name: string; count: number; children: ReactNode }) {
  return (
    <Collapsible className="group/collapsible">
      <CollapsibleTrigger className="flex min-h-9 w-full cursor-pointer items-center gap-2 text-left text-sm">
        <ChevronRight
          aria-hidden
          className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]/collapsible:rotate-90"
        />
        <span className="min-w-0 truncate">{name}</span>
        <span className="text-xs text-muted-foreground tabular-nums">{count}</span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ul className="mb-2 ml-6 flex flex-col gap-1 text-sm text-muted-foreground">{children}</ul>
      </CollapsibleContent>
    </Collapsible>
  )
}

/** Step 1: how last week went, in one grey sentence, with the done tasks tucked into collapsibles. */
export function LookBack({ retro, projects }: { retro: WeekRetro; projects: Project[] }) {
  const nameOf = new Map<ID | null, string>(projects.map((p) => [p.id, p.name]))
  const { totalDone, doneByProject, leftovers, untouched } = retro

  const sentence = [
    totalDone === 0
      ? 'Nothing was ticked off last week.'
      : `You finished ${plural(totalDone, 'task', 'tasks')} across ${plural(doneByProject.length, 'project', 'projects')}.`,
    leftovers.length > 0 ? `${leftovers.length} left over.` : null,
    untouched.length > 0 ? `${plural(untouched.length, 'project', 'projects')} got no progress.` : null,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div>
      <StepIntro title="Look back">{sentence}</StepIntro>

      {(doneByProject.length > 0 || untouched.length > 0) && (
        <Card size="sm" className="py-2">
          <CardContent>
            <div className="divide-y">
              {doneByProject.map((group) => (
                <Group
                  key={group.projectId ?? 'inbox'}
                  name={nameOf.get(group.projectId) ?? 'Inbox'}
                  count={group.tasks.length}
                >
                  {group.tasks.map((t) => (
                    <li key={t.id}>{t.title}</li>
                  ))}
                </Group>
              ))}
              {untouched.length > 0 && (
                <Group name="No progress" count={untouched.length}>
                  {untouched.map((p) => (
                    <li key={p.id}>{p.name}</li>
                  ))}
                </Group>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
