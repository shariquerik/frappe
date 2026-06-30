// Types for the ListView feature folder. `ListViewColumn` is the column descriptor
// frappe-ui ListView renders (curated config mapped via list-columns.ts); `Cell` is one
// classified cell the OSListView `#cell` slot draws. `type`/`primary` ride along on the
// column so the slot can classify a cell without re-consulting the source config.
import type { ColumnType } from '@/types'

// The render-ready column the frappe-ui ListView consumes. Two producers feed it: the
// curated `toListViewColumns` mapper (deferred enrichment, ADR-0025) and — live in this
// slice — the library's Meta-derived `view.columns.wire` (a numeric `fr` width and a raw
// Frappe fieldtype string). So `width` is string-or-number, `type` is an open string, and
// `primary` rides along only when the curated path sets it.
export interface ListViewColumn {
  key: string
  label: string
  width: string | number
  align: 'left' | 'right'
  type?: ColumnType | string
  primary?: boolean
  options?: string
}

export type CellKindName = 'status' | 'avatar' | 'primary' | 'plain'

export interface Cell {
  kind: CellKindName
  display: string
  theme?: string
  label?: string
}
