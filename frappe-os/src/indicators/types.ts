// The Record-indicator contract (ADR-0028): the normalized indicator spec the server
// projects and the resolved pill the client renders. Pure types — no Vue, no frappe-ui —
// so the resolver stays unit-testable in isolation. Re-exported via @/types.

// frappe-ui `Badge`'s six color tokens — the resolver's output vocabulary. Frappe's own
// palette is wider (light-blue, black, the DocType.states colors); the resolver's
// normalizeColor step is what narrows onto these (ADR-0028). Badge is the ceiling.
export type BadgeToken = 'gray' | 'blue' | 'green' | 'amber' | 'red' | 'violet'

// A record's status projected to a themed pill — the Record indicator. Per record; a
// consumer renders no pill when the resolver returns null (a doctype with no status model).
export interface Indicator {
  label: string
  color: BadgeToken
}

// An Indicator rule (ADR-0031): a filter condition over a record's fields plus the pill it
// paints when matched. First match in the ordered list wins. `condition` reuses Frappe's own
// grammar — `field,op,value` triplets joined by `|`, all of which must hold (AND) — the exact
// string `get_indicator` already emits (frappe/model/indicator.js). An empty condition always
// matches (a catch-all default rule). `label` may interpolate a stored field into the pill text
// ("{percent_complete}%") — still reading a field, so it stays data (not the Script seam,
// ADR-0006). `color` is a Frappe color or Badge token, narrowed by `normalizeColor`.
export interface IndicatorRule {
  condition: string
  label: string
  color: string
}

// How to resolve a doctype's records to indicators — the site's own status data, normalized on
// the server (frappe.os.meta.get_doctype_meta) so the client parses no raw workflow docs. The
// server owns the meaning; this resolver stays pure (ADR-0028). Describes the doctype, never a
// record; `indicatorFor` reads a record against it.
export interface IndicatorSpec {
  // The field carrying the status value: the active workflow's state field, else a Select named
  // status/stage. null when the doctype has no status field. Read by the built-in workflow tier
  // and the keyword-guess floor.
  statusField: string | null
  // Active workflow: state value -> its `Workflow State.style` (Success/Warning/Danger/Primary/
  // Info/Inverse). The resolver maps the style to a Badge token. The built-in top tier.
  workflow: Record<string, string>
  // Submittable doctypes carry the built-in Draft / Cancelled tier (docstatus 0 / 2). Submitted
  // (docstatus 1) is a rule, not built-in, so a domain indicator can override it (ADR-0031).
  isSubmittable: boolean
  // The effective ordered Indicator rule list (ADR-0031): app rules over OS default rules, merged
  // and projected by the server (`frappe.os.indicators`). First match wins, evaluated below the
  // built-in workflow and Draft/Cancelled tiers. The former field-name tiers (DocType.states,
  // publication, enabled/disabled, Submitted) now live here as OS default rules.
  rules: IndicatorRule[]
  // The record fields the rules reference (plus statusField / docstatus), for the list to
  // auto-fetch — so a pill never goes dark for want of a fetched field (retires manual add_fields).
  fields: string[]
}
