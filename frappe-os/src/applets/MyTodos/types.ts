// Feature-local types for the MyTodos applet. `TodoGroup` is one due-date bucket the applet
// renders (Overdue / Today / Upcoming), built by todo-groups.ts from the live ToDo rows.
import type { FrappeDoc } from '@/types'

export interface TodoGroup {
  key: string
  label: string
  items: FrappeDoc[]
}
