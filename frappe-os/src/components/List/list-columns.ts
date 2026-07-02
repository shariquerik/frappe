// Pure projections from the live wire columns to frappe-ui ListView's per-cell shape. No
// Vue, no store — mirrors route-map.ts: a tested projection OSListView stays thin over.
// `cellKind` classifies one cell of a record against the live column shape + Record-indicator
// spec (ADR-0028) into the four kinds the `#cell` slot draws (status pill / avatar / primary /
// plain). The status pill is a WHOLE-ROW projection (`indicatorFor` reads docstatus / enabled /
// workflow, which the status word alone can't express), so it lives in its OWN dedicated column —
// the Record indicator is a first-class SYNTHETIC column (ADR-0033) the host DECLARES via
// `indicatorColumn` and `useListView` folds into the column state, mirroring Frappe Desk's
// `type: "Status"` column (list_view.js). Shapes in ./types.
import { indicatorFor } from '@/indicators/indicator'
import type { FrappeDoc, IndicatorSpec } from '@/types'
import type { Cell, ListViewColumn, SyntheticColumn } from './types'

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

// A doctype resolves an indicator when it carries any tier that can paint one: a status field
// (workflow state, or a Select the keyword floor reads), the submittable Draft/Cancelled tier, or
// any rule (the enabled / publication / states / Submitted tiers all live in the rule list now,
// ADR-0031). No tier -> no indicator column, mirroring Desk's `has_indicator`.
export function hasIndicator(spec?: IndicatorSpec | null): boolean {
  return !!spec && Boolean(spec.statusField || spec.isSubmittable || spec.rules?.length)
}

// Build the Record indicator's SYNTHETIC column declaration (ADR-0033) for a doctype's spec, or
// `null` when it has no indicator. The host passes this to `useListView(doctype, { synthetic })`,
// which folds it into the column state right after the title column (`after-title`) and drops the
// raw status field it `subsumes` from the default seed — Desk-parity, but now a first-class column
// that toggles, resizes, and persists. `type: 'Status'` is the hint the `#cell` slot reads to draw
// the whole-row pill; the subsumed field stays fetched (via `spec.fields`) and re-addable.
export function indicatorColumn(spec?: IndicatorSpec | null): SyntheticColumn | null {
  if (!hasIndicator(spec)) return null
  return { key: '_indicator', label: 'Status', type: 'Status', place: 'after-title', subsumes: spec!.statusField ?? undefined }
}

// Classify one cell of `row` for `column`: the dedicated indicator column resolves the whole row to
// a Record indicator (blank when none resolves); the title column is primary; a person Link is an
// avatar; everything else is plain text, em-dashed when empty. The indicator column is recognised by
// its synthetic `type: 'Status'` render hint (ADR-0033) — no Frappe fieldtype is `Status`, so a
// re-added raw status field (a Select/Link) still renders plain.
export function cellKind(row: FrappeDoc, column: ListViewColumn, ctx: CellContext = {}): Cell {
  if (column.type === 'Status') {
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
// and no manual `add_fields` is needed. SYNTHETIC column keys (leading `_`, e.g. `_indicator`,
// ADR-0033) are skipped — there is no docfield to fetch for them; the real fields their cell reads
// arrive via `spec.fields`. Mirrors the library's `useListData` base set (`['name', ...wire keys]`),
// then unions the indicator fields. Deduped — a status field is often also a visible column.
export function listFetchFields(columns: ListViewColumn[] = [], spec?: IndicatorSpec | null): string[] {
  const fieldKeys = columns.map((c) => c.key).filter((key) => !key.startsWith('_'))
  return [...new Set(['name', ...fieldKeys, ...(spec?.fields ?? [])])]
}
