import { describe, it, expect } from 'vitest'
import { asText, toDateKey, priorityTheme, groupByDueDate } from '@/applets/MyTodos/todo-groups'

describe('asText', () => {
  it('strips HTML tags and collapses whitespace', () => {
    expect(asText('<p>Call <b>Jane</b></p>')).toBe('Call Jane')
    expect(asText('a\n\n  b')).toBe('a b')
  })

  it('returns an empty string for null/empty input', () => {
    expect(asText('')).toBe('')
    expect(asText(undefined)).toBe('')
  })
})

describe('toDateKey', () => {
  it('formats a date as a zero-padded local YYYY-MM-DD', () => {
    expect(toDateKey(new Date(2026, 0, 5))).toBe('2026-01-05')
    expect(toDateKey(new Date(2026, 11, 31))).toBe('2026-12-31')
  })
})

describe('priorityTheme', () => {
  it('maps known priorities to their theme', () => {
    expect(priorityTheme('High')).toBe('red')
    expect(priorityTheme('Medium')).toBe('orange')
    expect(priorityTheme('Low')).toBe('gray')
  })

  it('falls back to gray for unknown or missing priority', () => {
    expect(priorityTheme('Urgent')).toBe('gray')
    expect(priorityTheme(undefined)).toBe('gray')
  })
})

describe('groupByDueDate', () => {
  const today = '2026-06-19'

  it('buckets rows into overdue / today / upcoming by due date', () => {
    const rows = [
      { name: 'a', date: '2026-06-10' }, // overdue
      { name: 'b', date: '2026-06-19' }, // today
      { name: 'c', date: '2026-06-25' }, // upcoming
    ]
    const groups = groupByDueDate(rows, today)
    expect(groups.map((g) => g.key)).toEqual(['overdue', 'today', 'upcoming'])
    expect(groups.map((g) => g.items.map((r) => r.name))).toEqual([['a'], ['b'], ['c']])
  })

  it('treats a datetime value by its date prefix only', () => {
    const groups = groupByDueDate([{ name: 'a', date: '2026-06-19 14:30:00' }], today)
    expect(groups).toEqual([{ key: 'today', label: 'Today', items: [{ name: 'a', date: '2026-06-19 14:30:00' }] }])
  })

  it('places undated rows into upcoming', () => {
    const groups = groupByDueDate([{ name: 'a', date: '' }, { name: 'b' }], today)
    expect(groups).toHaveLength(1)
    expect(groups[0].key).toBe('upcoming')
    expect(groups[0].items.map((r) => r.name)).toEqual(['a', 'b'])
  })

  it('drops empty buckets', () => {
    const groups = groupByDueDate([{ name: 'a', date: '2026-06-25' }], today)
    expect(groups.map((g) => g.key)).toEqual(['upcoming'])
  })

  it('returns nothing for no rows', () => {
    expect(groupByDueDate([], today)).toEqual([])
  })
})
