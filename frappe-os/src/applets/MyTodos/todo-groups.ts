// Pure, Vue-free presentation logic for the MyTodos applet — the justification for it being
// an applet rather than the generic list (ADR-0002/0009): ToDos grouped by due date, with a
// plain-text title and a priority theme. Mirrors route-map.ts: a tested projection the
// applet stays thin over. Shapes live in ./types.
import type { FrappeDoc } from '@/types'
import type { TodoGroup } from './types'

// ToDo descriptions are stored as HTML; show the plain text for a one-line title.
export function asText(html: string): string {
  return (html || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

// A local YYYY-MM-DD key so date-only comparisons stay string-lexicographic.
export function toDateKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

const PRIORITY_THEME: Record<string, string> = { High: 'red', Medium: 'orange', Low: 'gray' }
export function priorityTheme(priority?: string): string {
  return (priority && PRIORITY_THEME[priority]) || 'gray'
}

// Bucket open ToDos by due date relative to `today` (a YYYY-MM-DD key). Undated items fall
// into Upcoming (nothing is overdue with no date). Empty buckets are dropped.
export function groupByDueDate(rows: FrappeDoc[], today: string): TodoGroup[] {
  const buckets: Record<string, FrappeDoc[]> = { overdue: [], today: [], upcoming: [] }
  for (const row of rows) {
    const due = (row.date || '').slice(0, 10)
    if (due && due < today) buckets.overdue.push(row)
    else if (due === today) buckets.today.push(row)
    else buckets.upcoming.push(row)
  }
  return [
    { key: 'overdue', label: 'Overdue', items: buckets.overdue },
    { key: 'today', label: 'Today', items: buckets.today },
    { key: 'upcoming', label: 'Upcoming', items: buckets.upcoming },
  ].filter((group) => group.items.length)
}
