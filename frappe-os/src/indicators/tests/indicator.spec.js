// Record-indicator resolver (ADR-0028): decision table over the resolution order and the
// lossy Frappe-color -> Badge-token mapping. Pure logic, no Vue/store (mirrors route-map.spec).
import { describe, expect, it } from 'vitest'
import { indicatorFor, normalizeColor } from '../indicator'

// A spec with every tier off; each test switches on only the tier it exercises. The former
// field-name tiers (states/publication/enabled) are now OS default rules built server-side
// (frappe.os.indicators) — their parity lives in test_indicators.py, not here.
const emptySpec = { statusField: null, workflow: {}, isSubmittable: false, rules: [], fields: [] }
const spec = (over) => ({ ...emptySpec, ...over })

describe('normalizeColor', () => {
  it('passes Badge tokens through unchanged', () => {
    for (const token of ['gray', 'blue', 'green', 'amber', 'red', 'violet']) {
      expect(normalizeColor(token)).toBe(token)
    }
  })

  it('maps the documented Frappe aliases', () => {
    expect(normalizeColor('light-blue')).toBe('blue')
    expect(normalizeColor('black')).toBe('gray')
    expect(normalizeColor('orange')).toBe('amber')
  })

  it('maps the rest of the DocType.states palette', () => {
    expect(normalizeColor('cyan')).toBe('blue')
    expect(normalizeColor('purple')).toBe('violet')
    expect(normalizeColor('pink')).toBe('violet')
    expect(normalizeColor('yellow')).toBe('amber')
  })

  it('is case-insensitive and falls back to gray', () => {
    expect(normalizeColor('Light Blue'.toLowerCase().replace(' ', '-'))).toBe('blue')
    expect(normalizeColor('LightBlue')).toBe('gray')
    expect(normalizeColor('')).toBe('gray')
    expect(normalizeColor(null)).toBe('gray')
    expect(normalizeColor('chartreuse')).toBe('gray')
  })
})

describe('indicatorFor resolution order', () => {
  it('returns null without a spec or doc', () => {
    expect(indicatorFor({ status: 'Open' }, null)).toBeNull()
    expect(indicatorFor(null, emptySpec)).toBeNull()
  })

  it('tier 1 — workflow style wins over the rule list', () => {
    const s = spec({
      statusField: 'workflow_state',
      workflow: { Approved: 'Success', Rejected: 'Danger' },
      rules: [{ condition: '', label: 'SHOULD NOT WIN', color: 'red' }], // a catch-all rule below it
      isSubmittable: true,
    })
    expect(indicatorFor({ workflow_state: 'Approved', docstatus: 0 }, s)).toEqual({ label: 'Approved', color: 'green' })
    expect(indicatorFor({ workflow_state: 'Rejected' }, s)).toEqual({ label: 'Rejected', color: 'red' })
  })

  it('tier 1 — an unknown workflow style falls back to gray', () => {
    const s = spec({ statusField: 'workflow_state', workflow: { Parked: 'Whatever' } })
    expect(indicatorFor({ workflow_state: 'Parked' }, s)).toEqual({ label: 'Parked', color: 'gray' })
  })

  it('tier 2 — Draft / Cancelled are built-in for submittable records (Submitted is a rule, not built-in)', () => {
    const s = spec({ isSubmittable: true })
    expect(indicatorFor({ docstatus: 0 }, s)).toEqual({ label: 'Draft', color: 'red' })
    expect(indicatorFor({ docstatus: 2 }, s)).toEqual({ label: 'Cancelled', color: 'red' })
    // docstatus 1 with no Submitted rule projected -> no built-in pill.
    expect(indicatorFor({ docstatus: 1 }, s)).toBeNull()
  })

  it('keyword floor — keyword heuristic for an uncurated status value', () => {
    const s = spec({ statusField: 'status' })
    expect(indicatorFor({ status: 'Pending Review' }, s)).toEqual({ label: 'Pending Review', color: 'amber' })
    expect(indicatorFor({ status: 'Open' }, s)).toEqual({ label: 'Open', color: 'red' })
    expect(indicatorFor({ status: 'Completed' }, s)).toEqual({ label: 'Completed', color: 'green' })
    expect(indicatorFor({ status: 'Submitted' }, s)).toEqual({ label: 'Submitted', color: 'blue' })
  })

  it('keyword floor — an unrecognized status word falls through to gray', () => {
    const s = spec({ statusField: 'status' })
    expect(indicatorFor({ status: 'Frobnicated' }, s)).toEqual({ label: 'Frobnicated', color: 'gray' })
  })

  it('renders no pill when nothing resolves', () => {
    expect(indicatorFor({ name: 'X' }, emptySpec)).toBeNull()
    // A status field with no value and no other tier -> no pill.
    expect(indicatorFor({ status: '' }, spec({ statusField: 'status' }))).toBeNull()
  })

  it('keyword match is case-sensitive, mirroring Frappe has_words', () => {
    const s = spec({ statusField: 'status' })
    expect(indicatorFor({ status: 'open' }, s)).toEqual({ label: 'open', color: 'gray' })
  })
})

// ADR-0031: the Record indicator resolves from an ordered rule list. Each rule is
// { condition, label, color } where condition is a Frappe filter (`field,op,value` triplets,
// '|'-joined AND). Hand-fed lists here; the server projection (slice 03) supplies the real one.
describe('indicatorFor rule list (ADR-0031)', () => {
  const rule = (over) => ({ condition: '', label: 'X', color: 'gray', ...over })

  it('evaluates the list first-match, top to bottom', () => {
    const s = spec({
      rules: [
        { condition: 'status,=,Paid', label: 'Paid', color: 'green' },
        { condition: 'status,=,Paid', label: 'SHOULD NOT WIN', color: 'red' },
      ],
    })
    expect(indicatorFor({ status: 'Paid' }, s)).toEqual({ label: 'Paid', color: 'green' })
  })

  it('no rule matches → no pill', () => {
    const s = spec({ rules: [{ condition: 'status,=,Paid', label: 'Paid', color: 'green' }] })
    expect(indicatorFor({ status: 'Unpaid' }, s)).toBeNull()
    expect(indicatorFor({ status: 'Unpaid' }, spec({ rules: [] }))).toBeNull()
  })

  it('AND-joins clauses with |, all must hold', () => {
    const s = spec({ rules: [{ condition: 'per_billed,<,100|docstatus,=,1', label: 'To Bill', color: 'orange' }] })
    expect(indicatorFor({ per_billed: 40, docstatus: 1 }, s)).toEqual({ label: 'To Bill', color: 'amber' })
    expect(indicatorFor({ per_billed: 100, docstatus: 1 }, s)).toBeNull()
    expect(indicatorFor({ per_billed: 40, docstatus: 0 }, spec({ rules: s.rules }))).toBeNull()
  })

  it('an empty condition is a catch-all that always matches', () => {
    const s = spec({ rules: [{ condition: '', label: 'Anything', color: 'blue' }] })
    expect(indicatorFor({ anything: true }, s)).toEqual({ label: 'Anything', color: 'blue' })
  })

  it('normalizes the rule color to a Badge token', () => {
    const s = spec({ rules: [{ condition: '', label: 'X', color: 'purple' }] })
    expect(indicatorFor({}, s).color).toBe('violet')
    expect(indicatorFor({}, spec({ rules: [rule({ color: 'chartreuse' })] })).color).toBe('gray')
  })

  describe('filter operators', () => {
    const match = (condition, doc) =>
      indicatorFor(doc, spec({ rules: [{ condition, label: 'hit', color: 'blue' }] })) !== null

    it('equality — number, Check, and string values compare loosely', () => {
      expect(match('enabled,=,1', { enabled: 1 })).toBe(true)
      expect(match('enabled,=,1', { enabled: true })).toBe(true)
      expect(match('enabled,=,0', { enabled: 0 })).toBe(true)
      expect(match('status,=,Paid', { status: 'Paid' })).toBe(true)
      expect(match('status,=,Paid', { status: 'Unpaid' })).toBe(false)
    })

    it('!= inequality', () => {
      expect(match('status,!=,Closed', { status: 'Open' })).toBe(true)
      expect(match('status,!=,Closed', { status: 'Closed' })).toBe(false)
    })

    it('numeric <, <=, >, >=', () => {
      expect(match('per_billed,<,100', { per_billed: 99 })).toBe(true)
      expect(match('per_billed,<,100', { per_billed: 100 })).toBe(false)
      expect(match('per_billed,<=,100', { per_billed: 100 })).toBe(true)
      expect(match('qty,>,0', { qty: 1 })).toBe(true)
      expect(match('qty,>,0', { qty: 0 })).toBe(false)
      expect(match('qty,>=,0', { qty: 0 })).toBe(true)
    })

    it('numeric comparison of a non-numeric value never matches', () => {
      expect(match('per_billed,<,100', { per_billed: 'n/a' })).toBe(false)
      expect(match('per_billed,<,100', {})).toBe(false)
    })

    it('in / not in over a comma list', () => {
      expect(match('status,in,Open,Overdue', { status: 'Overdue' })).toBe(true)
      expect(match('status,in,Open,Overdue', { status: 'Paid' })).toBe(false)
      expect(match('status,not in,Open,Overdue', { status: 'Paid' })).toBe(true)
      expect(match('status,not in,Open,Overdue', { status: 'Open' })).toBe(false)
    })

    it('is set / is not set — truthy presence, 0 counts as set', () => {
      expect(match('lead,is,set', { lead: 'CRM-1' })).toBe(true)
      expect(match('lead,is,set', { lead: '' })).toBe(false)
      expect(match('lead,is,set', { lead: 0 })).toBe(true)
      expect(match('lead,is,not set', {})).toBe(true)
      expect(match('lead,is,not set', { lead: 'CRM-1' })).toBe(false)
    })
  })

  it('interpolates a stored field into a label template', () => {
    const s = spec({ rules: [{ condition: 'per_complete,<,100', label: '{per_complete}% Done', color: 'orange' }] })
    expect(indicatorFor({ per_complete: 40 }, s)).toEqual({ label: '40% Done', color: 'amber' })
  })

  describe('built-in tiers still outrank the rule list', () => {
    const paidRule = [{ condition: '', label: 'Paid', color: 'green' }]

    it('workflow state wins over a matching rule', () => {
      const s = spec({ statusField: 'workflow_state', workflow: { Approved: 'Success' }, rules: paidRule })
      expect(indicatorFor({ workflow_state: 'Approved' }, s)).toEqual({ label: 'Approved', color: 'green' })
    })

    it('Draft and Cancelled win over a matching rule', () => {
      const s = spec({ isSubmittable: true, rules: paidRule })
      expect(indicatorFor({ docstatus: 0 }, s)).toEqual({ label: 'Draft', color: 'red' })
      expect(indicatorFor({ docstatus: 2 }, s)).toEqual({ label: 'Cancelled', color: 'red' })
    })

    it('a Submitted record (docstatus 1) is open to the rule list', () => {
      const s = spec({ isSubmittable: true, rules: [{ condition: 'docstatus,=,1', label: 'To Bill', color: 'orange' }] })
      expect(indicatorFor({ docstatus: 1 }, s)).toEqual({ label: 'To Bill', color: 'amber' })
    })
  })
})
