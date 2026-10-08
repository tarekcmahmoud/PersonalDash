import { Plus, X } from 'lucide-react'
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
import { useApply } from '../../data/hooks'
import { makePerson } from '../../domain/factories'
import type { ID, Person, Project } from '../../domain/types'

/**
 * A project's collaborators: the people its tasks can be delegated to. Add someone you already work with on
 * another project, or type a new name. Changes save straight away. Removing someone keeps the tasks already
 * delegated to them.
 */
export function CollaboratorsDialog({
  project,
  people,
  onClose,
}: {
  project: Project
  people: Person[]
  onClose: () => void
}) {
  const apply = useApply()
  const uid = useId()
  const [name, setName] = useState('')

  const byId = new Map(people.map((p) => [p.id, p]))
  const current = project.collaboratorIds.map((id) => byId.get(id)).filter((p): p is Person => !!p)
  const query = name.trim().toLowerCase()
  const others = people
    .filter((p) => !project.collaboratorIds.includes(p.id))
    .filter((p) => !query || p.name.toLowerCase().includes(query))
    .sort((a, b) => a.name.localeCompare(b.name))

  const setCollaborators = (collaboratorIds: ID[]) =>
    apply({ kind: 'saveProjects', projects: [{ ...project, collaboratorIds }] })

  const addExisting = async (person: Person) => {
    await setCollaborators([...project.collaboratorIds, person.id])
    setName('')
  }

  const addTyped = async (e: FormEvent) => {
    e.preventDefault()
    const typed = name.trim()
    if (!typed) return
    const existing = people.find((p) => p.name.toLowerCase() === typed.toLowerCase())
    if (existing) {
      if (!project.collaboratorIds.includes(existing.id)) await addExisting(existing)
      else setName('')
      return
    }
    const person = makePerson({ name: typed })
    await apply({ kind: 'savePeople', people: [person] })
    await setCollaborators([...project.collaboratorIds, person.id])
    setName('')
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Collaborators</DialogTitle>
          <DialogDescription>
            People you delegate this project&apos;s tasks to. They don&apos;t get access to the app.
          </DialogDescription>
        </DialogHeader>

        {current.length === 0 ? (
          <p className="text-sm text-muted-foreground">No collaborators yet.</p>
        ) : (
          <ul className="divide-y" aria-label="Collaborators">
            {current.map((p) => (
              <li key={p.id} className="flex min-h-10 items-center justify-between gap-2">
                <span className="min-w-0 truncate text-sm">{p.name}</span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-muted-foreground"
                  aria-label={`Remove ${p.name}`}
                  onClick={() => void setCollaborators(project.collaboratorIds.filter((id) => id !== p.id))}
                >
                  <X />
                </Button>
              </li>
            ))}
          </ul>
        )}

        <form className="grid gap-2" onSubmit={(e) => void addTyped(e)}>
          <Label htmlFor={`${uid}-name`} className="text-xs font-normal text-muted-foreground">
            Add a person
          </Label>
          <div className="flex gap-2">
            <Input
              id={`${uid}-name`}
              value={name}
              placeholder="Name"
              autoComplete="off"
              onChange={(e) => setName(e.target.value)}
            />
            <Button type="submit" variant="outline" disabled={!name.trim()}>
              Add
            </Button>
          </div>
          {others.length > 0 && (
            <div className="flex flex-wrap gap-1" aria-label="People from your other projects">
              {others.map((p) => (
                <Button
                  key={p.id}
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 font-normal text-muted-foreground"
                  onClick={() => void addExisting(p)}
                >
                  <Plus /> {p.name}
                </Button>
              ))}
            </div>
          )}
        </form>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
