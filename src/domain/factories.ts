import { newId, nowISO } from './ids'
import type { ChecklistItem, Milestone, Person, Project, Resource, Task, Template } from './types'

// Defaults for new entities. Callers pass whatever they know; ids/timestamps are generated.

export function makeProject(p: Partial<Project> & Pick<Project, 'name'>): Project {
  return {
    id: newId(),
    outcome: '',
    targetDate: null,
    dateKind: 'soft',
    status: 'active',
    rank: 0,
    weeklyMin: null,
    isSystem: false,
    collaboratorIds: [],
    createdAt: nowISO(),
    ...p,
  }
}

export function makePerson(p: Partial<Person> & Pick<Person, 'name'>): Person {
  return { id: newId(), createdAt: nowISO(), ...p }
}

export function makeMilestone(m: Partial<Milestone> & Pick<Milestone, 'projectId' | 'name'>): Milestone {
  return { id: newId(), parentId: null, position: 0, targetDate: null, dateKind: null, ...m }
}

export function makeTask(t: Partial<Task> & Pick<Task, 'title'>): Task {
  return {
    id: newId(),
    projectId: null,
    milestoneId: null,
    notes: '',
    doneWhen: '',
    size: 'S',
    position: 0,
    status: 'todo',
    waitingOn: null,
    followUpDate: null,
    assigneeId: null,
    weekStart: null,
    pinnedDay: null,
    slipCount: 0,
    completedAt: null,
    gcalEventId: null,
    gcalDirty: false,
    createdAt: nowISO(),
    ...t,
  }
}

export function makeChecklistItem(
  c: Partial<ChecklistItem> & Pick<ChecklistItem, 'taskId' | 'text'>,
): ChecklistItem {
  return { id: newId(), done: false, position: 0, ...c }
}

export function makeTemplate(t: Partial<Template> & Pick<Template, 'name' | 'outline'>): Template {
  return { id: newId(), updatedAt: nowISO(), ...t }
}

/** The permanent Admin/Misc project every user has. */
export function makeSystemProject(): Project {
  return makeProject({
    name: 'Admin / Misc',
    outcome: 'Ongoing — small tasks that belong to no project',
    isSystem: true,
    rank: 1_000_000,
  })
}

export function makeResource(r: Partial<Resource> & Pick<Resource, 'projectId' | 'url'>): Resource {
  return {
    id: newId(),
    title: '',
    description: '',
    imageUrl: null,
    imagePath: null,
    workstreamIds: [],
    position: 0,
    createdAt: nowISO(),
    ...r,
  }
}
