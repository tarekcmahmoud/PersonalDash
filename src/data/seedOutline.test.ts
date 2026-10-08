import { parseOutline } from '../domain/outline'
import { seedSnapshot } from './seed'

it('seeded templates are valid outlines', () => {
  for (const t of seedSnapshot('2026-10-08').templates) {
    const { doc, issues } = parseOutline(t.outline)
    expect(issues.filter((i) => i.severity === 'error')).toEqual([])
    expect(doc).not.toBeNull()
  }
})
