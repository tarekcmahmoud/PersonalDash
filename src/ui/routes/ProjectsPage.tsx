import { PlusIcon } from '@primer/octicons-react'
import { Banner, Button, Details, Flash, Spinner } from '@primer/react'
import { useState } from 'react'
import { Link as RouterLink, useNavigate } from 'react-router-dom'
import { useApply, usePlanContext } from '../../data/hooks'
import { activeProjectCount, isOverActiveCap } from '../../domain/health'
import type { Project } from '../../domain/types'
import { Page } from '../components/Page'
import { ProjectFormDialog } from '../project/ProjectFormDialog'
import { ProjectRow } from '../project/ProjectRow'
import { useIsNarrow } from '../project/useIsNarrow'
import { SortableList } from '../project/SortableList'
import styles from './ProjectsPage.module.css'

const byRank = (a: Project, b: Project): number => a.rank - b.rank

export function ProjectsPage() {
  const ctx = usePlanContext()
  const apply = useApply()
  const navigate = useNavigate()
  const narrow = useIsNarrow()
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const actions = (
    <div className={styles.actions}>
      <Button variant="primary" leadingVisual={PlusIcon} onClick={() => setCreating(true)}>
        New project
      </Button>
      <Button as={RouterLink} to="/import">
        Import breakdown
      </Button>
      <Button as={RouterLink} to="/templates">
        New from template
      </Button>
    </div>
  )

  if (!ctx) {
    return (
      <Page title="Projects" actions={narrow ? undefined : actions}>
        {narrow && actions}
        <Spinner aria-label="Loading projects" />
      </Page>
    )
  }

  const system = ctx.projects.find((p) => p.isSystem)
  const regular = ctx.projects.filter((p) => !p.isSystem)
  const active = regular.filter((p) => p.status === 'active').sort(byRank)
  const onHold = regular.filter((p) => p.status === 'on_hold').sort(byRank)
  const done = regular.filter((p) => p.status === 'done').sort(byRank)

  const reorder = async (ordered: Project[]) => {
    const changed = ordered
      .map((p, i) => ({ ...p, rank: i + 1 }))
      .filter((p, i) => p.rank !== ordered[i]!.rank)
    if (changed.length === 0) return
    setError(null)
    try {
      await apply({ kind: 'saveProjects', projects: changed })
    } catch {
      setError('Could not save the new order. Please try again.')
    }
  }

  return (
    <Page title="Projects" actions={narrow ? undefined : actions}>
      <div className={styles.content}>
        {narrow && actions}
        {isOverActiveCap(ctx) && (
          <Banner
            variant="warning"
            title={`You have ${activeProjectCount(ctx.projects)} active projects (cap ${ctx.settings.activeCap}). Consider putting one on hold.`}
          />
        )}
        {error && <Flash variant="danger">{error}</Flash>}

        <section aria-labelledby="active-heading">
          <h2 id="active-heading" className={styles.heading}>
            Active <span className={styles.count}>{active.length}</span>
          </h2>
          {active.length === 0 ? (
            <p className={styles.empty}>No active projects. Create one, or reactivate a project below.</p>
          ) : (
            <SortableList
              items={active}
              onReorder={(items) => void reorder(items)}
              label={(p) => p.name}
              renderItem={(p, controls) => <ProjectRow project={p} ctx={ctx} controls={controls} />}
            />
          )}
          {system && <ProjectRow project={system} ctx={ctx} />}
        </section>

        {onHold.length > 0 && (
          <section aria-labelledby="hold-heading">
            <h2 id="hold-heading" className={styles.heading}>
              On hold <span className={styles.count}>{onHold.length}</span>
            </h2>
            {onHold.map((p) => (
              <ProjectRow key={p.id} project={p} ctx={ctx} />
            ))}
          </section>
        )}

        {done.length > 0 && (
          <Details className={styles.doneDetails}>
            <Details.Summary className={styles.summary}>{`Done (${done.length})`}</Details.Summary>
            {done.map((p) => (
              <ProjectRow key={p.id} project={p} ctx={ctx} />
            ))}
          </Details>
        )}
      </div>

      {creating && (
        <ProjectFormDialog
          onClose={() => setCreating(false)}
          onSaved={(p) => navigate(`/projects/${p.id}`)}
        />
      )}
    </Page>
  )
}
