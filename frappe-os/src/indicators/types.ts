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

// How to resolve a doctype's records to indicators — the site's own status data, normalized
// on the server (frappe.www.os.get_doctype_meta, #02) so the client parses no raw workflow
// docs. Describes the doctype, never a record; `indicatorFor` reads a record against it.
export interface IndicatorSpec {
  // The field carrying the status value: the active workflow's state field, else a Select
  // named status/stage. null when the doctype has no status field.
  statusField: string | null
  // Active workflow: state value -> its `Workflow State.style` (Success/Warning/Danger/
  // Primary/Info/Inverse). The resolver maps the style to a Badge token.
  workflow: Record<string, string>
  // DocType.states: status value -> a Frappe color token, lowercased (e.g. 'light-blue').
  // The resolver normalizes it to a Badge token.
  states: Record<string, string>
  // Submittable doctypes carry the docstatus tier (Draft / Submitted / Cancelled).
  isSubmittable: boolean
  // The enabled-state field — 'enabled' (truthy = active) or 'disabled' (truthy = inactive),
  // or null. Opposite polarities; the resolver reads which from the name (ADR-0028).
  enabledField: string | null
  // The publication/visibility Check field — 'published'/'is_published', 'public'/'is_public',
  // or 'is_private' (inverse polarity), or null. Desk projects these per-doctype via
  // listview_settings.get_indicator; the resolver generalizes them, reading label + color and
  // polarity from the name (ADR-0028). Sits below docstatus, above enabled/disabled.
  publicationField: string | null
}
