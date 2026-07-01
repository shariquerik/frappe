// Pure Record-indicator resolver (ADR-0028): projects a record + its doctype's indicator
// spec to a themed status pill, mirroring Frappe's `frappe.get_indicator` resolution order
// (frappe/public/js/frappe/model/indicator.js). Frappe-ui-free so it unit-tests in isolation
// (frappe-ui is unresolvable in the runner) — mirrors route-map.ts / list-columns.ts. Output
// is always a Badge token, so StatusPill stays dumb and the lossy color mapping is tested here.
import type { BadgeToken, Indicator, IndicatorSpec } from './types'

// `Workflow State.style` -> Badge token. Ported from indicator.js, retargeted from Frappe's
// wider palette to Badge's six: Info was light-blue (-> blue), Inverse was black (-> gray).
const STYLE_TO_TOKEN: Record<string, BadgeToken> = {
  Success: 'green',
  Warning: 'amber',
  Danger: 'red',
  Primary: 'blue',
  Info: 'blue',
  Inverse: 'gray',
}

// Frappe color token -> Badge token. Covers the DocType.states palette (Blue/Cyan/Gray/
// Green/Light Blue/Orange/Pink/Purple/Red/Yellow, scrubbed lowercase) plus workflow leftovers
// (black). Deliberately lossy — Badge is the ceiling; unknown -> gray.
const COLOR_TO_TOKEN: Record<string, BadgeToken> = {
  gray: 'gray',
  grey: 'gray',
  black: 'gray',
  blue: 'blue',
  'light-blue': 'blue',
  cyan: 'blue',
  green: 'green',
  red: 'red',
  amber: 'amber',
  orange: 'amber',
  yellow: 'amber',
  violet: 'violet',
  purple: 'violet',
  pink: 'violet',
}

// guess_colour keyword heuristic (utils.js `guess_style`) — the last resort for an uncurated
// status value. Case-sensitive substring match (Frappe's `has_words`); first bucket wins.
const KEYWORD_BUCKETS: Array<{ color: BadgeToken; words: string[] }> = [
  { color: 'amber', words: ['Pending', 'Review', 'Medium', 'Not Approved'] },
  { color: 'red', words: ['Open', 'Urgent', 'High', 'Failed', 'Rejected', 'Error'] },
  {
    color: 'green',
    words: ['Closed', 'Finished', 'Converted', 'Completed', 'Complete', 'Confirmed', 'Approved', 'Yes', 'Active', 'Available', 'Paid', 'Success'],
  },
  { color: 'blue', words: ['Submitted'] },
]

// Map a Frappe color token to a Badge token; unknown or empty -> gray.
export function normalizeColor(color: string | null | undefined): BadgeToken {
  return COLOR_TO_TOKEN[String(color ?? '').toLowerCase()] || 'gray'
}

// The keyword fallback color for a raw status value; no keyword match -> gray.
function guessColor(value: string): BadgeToken {
  const bucket = KEYWORD_BUCKETS.find((b) => b.words.some((word) => value.includes(word)))
  return bucket ? bucket.color : 'gray'
}

// Resolve a record to its indicator, first match wins (ADR-0028 order): active workflow
// state -> DocType.states -> docstatus -> enabled/disabled -> keyword heuristic. Returns null
// when the doctype carries no status model, so the consumer renders no pill.
export function indicatorFor(doc: Record<string, unknown>, spec: IndicatorSpec | null | undefined): Indicator | null {
  if (!doc || !spec) return null
  const value = spec.statusField ? doc[spec.statusField] : undefined
  const status = value == null ? '' : String(value)

  if (status && spec.workflow[status]) return { label: status, color: STYLE_TO_TOKEN[spec.workflow[status]] || 'gray' }
  if (status && spec.states[status]) return { label: status, color: normalizeColor(spec.states[status]) }

  if (spec.isSubmittable) {
    if (doc.docstatus === 0) return { label: 'Draft', color: 'red' }
    if (doc.docstatus === 2) return { label: 'Cancelled', color: 'red' }
    if (doc.docstatus === 1) return { label: 'Submitted', color: 'blue' }
  }

  if (spec.enabledField === 'enabled') return doc.enabled ? { label: 'Enabled', color: 'blue' } : { label: 'Disabled', color: 'gray' }
  if (spec.enabledField === 'disabled') return doc.disabled ? { label: 'Disabled', color: 'gray' } : { label: 'Enabled', color: 'blue' }

  if (status) return { label: status, color: guessColor(status) }
  return null
}
