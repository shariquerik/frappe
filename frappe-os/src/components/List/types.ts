// Types for the ListView feature folder. `ListViewColumn` is the column descriptor
// frappe-ui ListView renders (curated config mapped via list-columns.ts); `Cell` is one
// classified cell the OSListView `#cell` slot draws. `type`/`primary` ride along on the
// column so the slot can classify a cell without re-consulting the source config.
import type { ColumnType } from '@/types'

export interface ListViewColumn {
  key: string
  label: string
  width: string
  align: 'left' | 'right'
  type?: ColumnType
  primary: boolean
}

export type CellKindName = 'status' | 'avatar' | 'primary' | 'plain'

export interface Cell {
  kind: CellKindName
  display: string
  theme?: string
  label?: string
}
