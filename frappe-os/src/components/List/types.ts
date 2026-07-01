// Types for the ListView feature folder. `ListViewColumn` is the column descriptor
// frappe-ui ListView renders; `Cell` is one classified cell the OSListView `#cell` slot
// draws. `type`/`primary` ride along on the column so the slot can classify a cell.

// The render-ready column the frappe-ui ListView consumes — the library's Meta-derived
// `view.columns.wire` (a numeric `fr` width and a raw Frappe fieldtype string). So `width` is
// string-or-number and `type` is the raw fieldtype the cell classifier reads (ADR-0028).
export interface ListViewColumn {
  key: string
  label: string
  width: string | number
  align: 'left' | 'right'
  type?: string
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
