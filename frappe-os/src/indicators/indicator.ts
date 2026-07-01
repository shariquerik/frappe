// Pure Record-indicator resolver (ADR-0028): projects a record + its doctype's indicator
// spec to a themed status pill, mirroring Frappe's `frappe.get_indicator` resolution order
// (frappe/public/js/frappe/model/indicator.js). Frappe-ui-free so it unit-tests in isolation
// (frappe-ui is unresolvable in the runner) — mirrors route-map.ts / list-columns.ts. Output
// is always a Badge token, so StatusPill stays dumb and the lossy color mapping is tested here.
import type { BadgeToken, Indicator, IndicatorRule, IndicatorSpec } from './types'

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

// --- Indicator rules (ADR-0031) ----------------------------------------------------------------
// Evaluate an ordered rule list against a record; first matching rule wins. Reuses Frappe's own
// filter grammar (frappe/model/indicator.js emits it): a condition is `field,op,value` triplets
// joined by '|', all of which must hold (AND). Value is everything after the second comma, so
// `status,in,Open,Overdue` reads as one `in` list — mirroring Frappe's `f.slice(2).join(",")`.

interface Clause {
  field: string
  operator: string
  value: string
}

// Split a condition string into its AND-joined clauses; empty/blank -> no clauses (always matches).
function parseCondition(condition: string): Clause[] {
  return String(condition ?? '')
    .split('|')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const bits = part.split(',')
      return { field: bits[0].trim(), operator: (bits[1] ?? '').trim(), value: bits.slice(2).join(',') }
    })
}

// A record value as a comparable scalar string: booleans as Check ints (1/0), null/undefined as ''.
function asScalar(value: unknown): string {
  if (value === true) return '1'
  if (value === false) return '0'
  return value == null ? '' : String(value)
}

// A stored value counts as "set" when it is present and non-empty; 0 is set (matches Frappe).
function isSet(value: unknown): boolean {
  return value != null && value !== ''
}

// Compare a record value against a rule value numerically; a non-numeric side never matches.
function numericMatch(operator: string, recordValue: unknown, ruleValue: string): boolean {
  const left = Number(recordValue)
  const right = Number(ruleValue)
  if (Number.isNaN(left) || Number.isNaN(right)) return false
  if (operator === '<') return left < right
  if (operator === '<=') return left <= right
  if (operator === '>') return left > right
  return left >= right
}

// Does one clause hold for the record? Covers the operators the real population uses (ADR-0031):
// equality, !=, numeric <,<=,>,>=, in/not in over a comma list, and is set / is not set.
function clauseMatches(doc: Record<string, unknown>, { field, operator, value }: Clause): boolean {
  const recordValue = doc[field]
  switch (operator) {
    case '=':
    case '==':
      return asScalar(recordValue) === value
    case '!=':
      return asScalar(recordValue) !== value
    case '<':
    case '<=':
    case '>':
    case '>=':
      return numericMatch(operator, recordValue, value)
    case 'in':
      return valueList(value).includes(asScalar(recordValue))
    case 'not in':
      return !valueList(value).includes(asScalar(recordValue))
    case 'is':
      return value.trim() === 'set' ? isSet(recordValue) : !isSet(recordValue)
    default:
      return false
  }
}

// The comma list an `in` / `not in` value carries, trimmed and de-blanked.
function valueList(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

// Interpolate stored fields into a label template ("{percent_complete}%"); a plain label is
// returned unchanged. Reading a field, not computing — so templated labels stay data (ADR-0031).
function fillLabel(label: string, doc: Record<string, unknown>): string {
  return String(label ?? '').replace(/\{(\w+)\}/g, (_match, field) => asScalar(doc[field]))
}

// Resolve a record against the ordered rule list; first fully-matching rule wins, else null.
function resolveRules(doc: Record<string, unknown>, rules: IndicatorRule[] | undefined): Indicator | null {
  if (!rules) return null
  for (const rule of rules) {
    if (parseCondition(rule.condition).every((clause) => clauseMatches(doc, clause))) {
      return { label: fillLabel(rule.label, doc), color: normalizeColor(rule.color) }
    }
  }
  return null
}

// Resolve a record to its indicator, first match wins (ADR-0031 order):
//   1. active workflow state          — built-in, always wins
//   2. Draft / Cancelled (docstatus)  — built-in, always wins
//   3. the indicator rule list        — the server's effective list (app over OS defaults), first match
//   4. keyword-guess of a raw status  — built-in heuristic floor (guess_colour)
//   5. no match -> no pill
//
// The built-in tiers sit above the rule list deliberately: a cancelled document is cancelled
// regardless of any flag a rule reads. The rule list is projected whole by the server (app rules
// over OS default rules merged in `frappe.os.indicators`); this resolver only evaluates it. Keyword
// guess stays built-in, not a rule: it *computes* a color from an open status string rather than
// reading a stored field, so by ADR-0031's line ("reading is data; computing is behavior") it is
// framework behavior, generic to every doctype — not per-doctype data anyone overrides.
export function indicatorFor(doc: Record<string, unknown>, spec: IndicatorSpec | null | undefined): Indicator | null {
  if (!doc || !spec) return null
  const value = spec.statusField ? doc[spec.statusField] : undefined
  const status = value == null ? '' : String(value)

  if (status && spec.workflow[status]) return { label: status, color: STYLE_TO_TOKEN[spec.workflow[status]] || 'gray' }

  if (spec.isSubmittable) {
    if (doc.docstatus === 0) return { label: 'Draft', color: 'red' }
    if (doc.docstatus === 2) return { label: 'Cancelled', color: 'red' }
  }

  const ruled = resolveRules(doc, spec.rules)
  if (ruled) return ruled

  if (status) return { label: status, color: guessColor(status) }
  return null
}
