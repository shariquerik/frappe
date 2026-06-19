// Pure mappers from the curated ListColumn config to frappe-ui ListView's column +
// per-cell shape. No Vue, no store — mirrors route-map.ts: a tested projection the
// components stay thin over. `toListViewColumns` builds the column descriptors ListView
// renders (width passes through verbatim — strings keep our exact grid layout; ListView
// prepends its own 14px checkbox track); `cellKind` classifies one cell value into the
// four curated kinds the OSListView `#cell` slot draws (status pill / avatar / primary /
// plain). Shapes live in ./types.
import type { ListColumn } from '@/types'
import type { Cell, ListViewColumn } from './types'

export function toListViewColumns(cols: ListColumn[] = []): ListViewColumn[] {
  return cols.map((c) => ({
    key: c.key,
    label: c.label,
    width: c.width || 'minmax(120px,1fr)',
    align: c.type === 'currency' || c.type === 'int' ? 'right' : 'left',
    type: c.type,
    primary: !!c.primary,
  }))
}

// Classify one cell value. Mirrors the old DocView `cellFor`: em-dash for empty values,
// status → themed pill, avatar → label, primary → emphasized, else plain text.
export function cellKind(
  value: unknown,
  column: Pick<ListColumn, 'type' | 'primary'>,
  statusThemes: Record<string, string> = {},
): Cell {
  const display = value == null || value === '' ? '—' : String(value)
  if (column.type === 'status' && value != null) {
    return { kind: 'status', display, theme: statusThemes[String(value)] || 'gray' }
  }
  if (column.type === 'avatar') {
    return { kind: 'avatar', display, label: value == null ? '' : String(value) }
  }
  if (column.primary) return { kind: 'primary', display }
  return { kind: 'plain', display }
}
