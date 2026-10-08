import { addWeeksISO, formatWeekRange, isInWeek, weekDays, weekStartOf, weekdayOf } from './week'

describe('week helpers', () => {
  it('finds the Monday of a week', () => {
    expect(weekStartOf('2026-10-08')).toBe('2026-10-05') // Thursday
    expect(weekStartOf('2026-10-05')).toBe('2026-10-05') // Monday
    expect(weekStartOf('2026-10-11')).toBe('2026-10-05') // Sunday
  })
  it('lists days and checks membership', () => {
    expect(weekDays('2026-10-05')).toEqual([
      '2026-10-05',
      '2026-10-06',
      '2026-10-07',
      '2026-10-08',
      '2026-10-09',
      '2026-10-10',
      '2026-10-11',
    ])
    expect(isInWeek('2026-10-11', '2026-10-05')).toBe(true)
    expect(isInWeek('2026-10-12', '2026-10-05')).toBe(false)
    expect(addWeeksISO('2026-10-05', 1)).toBe('2026-10-12')
    expect(weekdayOf('2026-10-11')).toBe('sun')
  })
  it('formats ranges', () => {
    expect(formatWeekRange('2026-10-05')).toBe('Oct 5 – 11')
    expect(formatWeekRange('2026-09-28')).toBe('Sep 28 – Oct 4')
  })
})
