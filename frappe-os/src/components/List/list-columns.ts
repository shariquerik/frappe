// Pure projections from the live wire columns to frappe-ui ListView's per-cell shape. No
// Vue, no store — mirrors route-map.ts: a tested projection OSListView stays thin over.
// `cellKind` classifies one cell of a record against the live column shape + Record-indicator
// spec (ADR-0028) into the four kinds the `#cell` slot draws (status pill / avatar / primary /
// plain). It is per-record — the status pill resolves the WHOLE row through `indicatorFor`
// (docstatus / enabled / workflow can't be read from the status word alone). Shapes in ./types.
import { indicatorFor } from '@/indicators/indicator'
import type { FrappeDoc, IndicatorSpec } from '@/types'
import type { Cell, ListViewColumn } from './types'

// The live per-doctype context a cell is classified against: the status field name (from the
// indicator spec), the title field (its cell renders primary), and the spec `indicatorFor` reads.
export interface CellContext {
  statusField?: string | null
  titleField?: string | null
  spec?: IndicatorSpec | null
}

// An avatar chip is a PERSON reference — a Link to User (an owner / assigned-to field), keyed on
// the wire column's Link target (`options`). Arbitrary Links (status, territory, organization)
// are NOT people, so they render plain — a Link-to-a-status-doctype coloured pill is a separate,
// app-shaped model deferred to issue #06 (ADR-0028 covers only the generic indicator tiers).
const PERSON_LINK_TARGET = 'User'

// Classify one cell of `row` for `column`: em-dash for empty; the status column resolves the
// whole row to a Record indicator; the title column is primary; a person Link is an avatar.
export function cellKind(row: FrappeDoc, column: ListViewColumn, ctx: CellContext = {}): Cell {
  const value = row?.[column.key]
  const display = value == null || value === '' ? '—' : String(value)

  if (ctx.statusField && column.key === ctx.statusField) {
    const indicator = indicatorFor(row, ctx.spec)
    if (indicator) return { kind: 'status', display: indicator.label, theme: indicator.color }
    return { kind: 'plain', display }
  }
  if (column.primary || (ctx.titleField && column.key === ctx.titleField)) {
    return { kind: 'primary', display }
  }
  if (column.type === 'Link' && column.options === PERSON_LINK_TARGET) {
    return { kind: 'avatar', display, label: value == null ? '' : String(value) }
  }
  return { kind: 'plain', display }
}

// The lean field set a list fetches (ADR-0028, #04b): `name` + the visible wire column keys +
// the fields the Record-indicator resolver reads off each row — `statusField`, `docstatus`
// when submittable, and the `enabledField` / `publicationField` when the spec names one. Derived from the spec the
// client already holds, so a Draft / disabled / workflow pill never goes dark for want of a
// fetched field. Mirrors the library's `useListData` base set (`['name', ...wire keys]`), then
// unions the resolver fields. Deduped, since the status field is often also a visible column.
export function listFetchFields(columns: ListViewColumn[] = [], spec?: IndicatorSpec | null): string[] {
  const fields = ['name', ...columns.map((c) => c.key)]
  if (spec?.statusField) fields.push(spec.statusField)
  if (spec?.isSubmittable) fields.push('docstatus')
  if (spec?.enabledField) fields.push(spec.enabledField)
  if (spec?.publicationField) fields.push(spec.publicationField)
  return [...new Set(fields)]
}
