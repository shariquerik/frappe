// Pure projections from the live wire columns to frappe-ui ListView's per-cell shape. No
// Vue, no store — mirrors route-map.ts: a tested projection OSListView stays thin over.
// `cellKind` classifies one cell of a record against the live column shape + Record-indicator
// spec (ADR-0028) into the four kinds the `#cell` slot draws (status pill / avatar / primary /
// plain). The status pill is a WHOLE-ROW projection (`indicatorFor` reads docstatus / enabled /
// workflow, which the status word alone can't express), so it lives in its OWN dedicated column
// (`withIndicatorColumn`), not piggybacked on whichever field happens to be the status field —
// mirroring Frappe Desk's `type: "Status"` column (list_view.js). Shapes in ./types.
import { indicatorFor } from '@/indicators/indicator'
import type { FrappeDoc, IndicatorSpec } from '@/types'
import type { Cell, ListViewColumn } from './types'

// The live per-doctype context a cell is classified against: the title field (its cell renders
// primary) and the indicator spec the dedicated indicator column resolves the whole row through.
export interface CellContext {
  titleField?: string | null
  spec?: IndicatorSpec | null
}

// An avatar chip is a PERSON reference — a Link to User (an owner / assigned-to field), keyed on
// the wire column's Link target (`options`). Arbitrary Links (status, territory, organization)
// are NOT people, so they render plain — a Link-to-a-status-doctype coloured pill is a separate,
// app-shaped model deferred to issue #06 (ADR-0028 covers only the generic indicator tiers).
const PERSON_LINK_TARGET = 'User'

// The synthetic, always-present Record-indicator column (ADR-0028). Frappe Desk adds a dedicated
// `type: "Status"` column whenever a doctype has an indicator and suppresses the raw status field
// column (list_view.js:461-475) — the pill is a WHOLE-ROW projection, not one field's value, so it
// renders in its own column independent of which fields are visible. Kept out of the library's
// column state (`useListView` / `ColumnSettings`), so it is neither toggleable nor part of the
// persisted layout — Status is always on, as in Desk.
export const INDICATOR_COLUMN_KEY = '_indicator'
const INDICATOR_COLUMN_WIDTH = '8rem'

// A doctype resolves an indicator when it carries any tier that can paint one: a status field
// (workflow state, or a Select the keyword floor reads), the submittable Draft/Cancelled tier, or
// any rule (the enabled / publication / states / Submitted tiers all live in the rule list now,
// ADR-0031). No tier -> no indicator column, mirroring Desk's `has_indicator`.
export function hasIndicator(spec?: IndicatorSpec | null): boolean {
  return !!spec && Boolean(spec.statusField || spec.isSubmittable || spec.rules?.length)
}

// The render column list with the Record-indicator column folded in (ADR-0028, Desk-parity): when
// the doctype has an indicator, drop the raw status field column the pill subsumes and insert the
// dedicated indicator column right after the title/subject column. A doctype with no indicator is
// returned untouched (same reference). Pure — the host feeds `view.columns.wire` in and renders the
// result; the dropped status field stays fetched (via `spec.fields`), only its column is hidden.
export function withIndicatorColumn(columns: ListViewColumn[] = [], spec?: IndicatorSpec | null): ListViewColumn[] {
  if (!hasIndicator(spec)) return columns
  const indicator: ListViewColumn = { key: INDICATOR_COLUMN_KEY, label: 'Status', width: INDICATOR_COLUMN_WIDTH, align: 'left', type: 'Status' }
  const rest = columns.filter((column) => column.key !== spec!.statusField)
  return rest.length ? [rest[0], indicator, ...rest.slice(1)] : [indicator]
}

// Classify one cell of `row` for `column`: the dedicated indicator column resolves the whole row to
// a Record indicator (blank when none resolves); the title column is primary; a person Link is an
// avatar; everything else is plain text, em-dashed when empty.
export function cellKind(row: FrappeDoc, column: ListViewColumn, ctx: CellContext = {}): Cell {
  if (column.key === INDICATOR_COLUMN_KEY) {
    const indicator = indicatorFor(row, ctx.spec)
    if (indicator) return { kind: 'status', display: indicator.label, theme: indicator.color }
    // A row with no resolved indicator leaves the cell blank, like Desk — an em-dash would read as
    // a missing field value rather than "this row has no status".
    return { kind: 'plain', display: '' }
  }

  const value = row?.[column.key]
  const display = value == null || value === '' ? '—' : String(value)

  if (column.primary || (ctx.titleField && column.key === ctx.titleField)) {
    return { kind: 'primary', display }
  }
  if (column.type === 'Link' && column.options === PERSON_LINK_TARGET) {
    return { kind: 'avatar', display, label: value == null ? '' : String(value) }
  }
  return { kind: 'plain', display }
}

// The lean field set a list fetches (ADR-0028 / ADR-0031): `name` + the visible wire column keys +
// the fields the Record-indicator resolver reads off each row. The server names those in
// `spec.fields` (the status field, `docstatus` when submittable, and every field a rule condition
// references), so a Draft / disabled / workflow pill never goes dark for want of a fetched field
// and no manual `add_fields` is needed. Mirrors the library's `useListData` base set
// (`['name', ...wire keys]`), then unions the indicator fields. Deduped — a status field is often
// also a visible column.
export function listFetchFields(columns: ListViewColumn[] = [], spec?: IndicatorSpec | null): string[] {
  return [...new Set(['name', ...columns.map((c) => c.key), ...(spec?.fields ?? [])])]
}
