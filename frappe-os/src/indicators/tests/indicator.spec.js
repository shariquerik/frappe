// Record-indicator resolver (ADR-0028): decision table over the resolution order and the
// lossy Frappe-color -> Badge-token mapping. Pure logic, no Vue/store (mirrors route-map.spec).
import { describe, expect, it } from 'vitest'
import { indicatorFor, normalizeColor } from '../indicator'

// A spec with every tier off; each test switches on only the tier it exercises.
const emptySpec = { statusField: null, workflow: {}, states: {}, isSubmittable: false, enabledField: null, publicationField: null }
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

  it('tier 1 — workflow style wins over every lower tier', () => {
    const s = spec({
      statusField: 'workflow_state',
      workflow: { Approved: 'Success', Rejected: 'Danger' },
      states: { Approved: 'red' }, // lower tier that must not win
      isSubmittable: true,
    })
    expect(indicatorFor({ workflow_state: 'Approved', docstatus: 0 }, s)).toEqual({ label: 'Approved', color: 'green' })
    expect(indicatorFor({ workflow_state: 'Rejected' }, s)).toEqual({ label: 'Rejected', color: 'red' })
  })

  it('tier 1 — an unknown workflow style falls back to gray', () => {
    const s = spec({ statusField: 'workflow_state', workflow: { Parked: 'Whatever' } })
    expect(indicatorFor({ workflow_state: 'Parked' }, s)).toEqual({ label: 'Parked', color: 'gray' })
  })

  it('tier 2 — DocType.states color, normalized, wins over docstatus', () => {
    const s = spec({ statusField: 'status', states: { Paid: 'green', Overdue: 'orange' }, isSubmittable: true })
    expect(indicatorFor({ status: 'Paid', docstatus: 1 }, s)).toEqual({ label: 'Paid', color: 'green' })
    expect(indicatorFor({ status: 'Overdue', docstatus: 1 }, s)).toEqual({ label: 'Overdue', color: 'amber' })
  })

  it('tier 3 — docstatus for submittable records', () => {
    const s = spec({ isSubmittable: true })
    expect(indicatorFor({ docstatus: 0 }, s)).toEqual({ label: 'Draft', color: 'red' })
    expect(indicatorFor({ docstatus: 1 }, s)).toEqual({ label: 'Submitted', color: 'blue' })
    expect(indicatorFor({ docstatus: 2 }, s)).toEqual({ label: 'Cancelled', color: 'red' })
  })

  it('publication — published/public map truthy to a green pill', () => {
    expect(indicatorFor({ published: 1 }, spec({ publicationField: 'published' }))).toEqual({ label: 'Published', color: 'green' })
    expect(indicatorFor({ published: 0 }, spec({ publicationField: 'published' }))).toEqual({ label: 'Not Published', color: 'gray' })
    expect(indicatorFor({ is_published: 1 }, spec({ publicationField: 'is_published' }))).toEqual({ label: 'Published', color: 'green' })
    expect(indicatorFor({ public: 1 }, spec({ publicationField: 'public' }))).toEqual({ label: 'Public', color: 'green' })
    expect(indicatorFor({ public: 0 }, spec({ publicationField: 'public' }))).toEqual({ label: 'Private', color: 'gray' })
    expect(indicatorFor({ is_public: 1 }, spec({ publicationField: 'is_public' }))).toEqual({ label: 'Public', color: 'green' })
  })

  it('publication — is_private is the inverse polarity (truthy = Private)', () => {
    const s = spec({ publicationField: 'is_private' })
    expect(indicatorFor({ is_private: 1 }, s)).toEqual({ label: 'Private', color: 'gray' })
    expect(indicatorFor({ is_private: 0 }, s)).toEqual({ label: 'Public', color: 'green' })
  })

  it('publication — docstatus outranks it, it outranks enabled', () => {
    // A submittable draft still reads Draft, not its publication state.
    const submittable = spec({ isSubmittable: true, publicationField: 'published' })
    expect(indicatorFor({ docstatus: 0, published: 1 }, submittable)).toEqual({ label: 'Draft', color: 'red' })
    // With both fields present the publication tier wins over enabled/disabled.
    const both = spec({ publicationField: 'published', enabledField: 'enabled' })
    expect(indicatorFor({ published: 1, enabled: 0 }, both)).toEqual({ label: 'Published', color: 'green' })
  })

  it('tier 4 — enabled polarity (truthy = active)', () => {
    const s = spec({ enabledField: 'enabled' })
    expect(indicatorFor({ enabled: 1 }, s)).toEqual({ label: 'Enabled', color: 'blue' })
    expect(indicatorFor({ enabled: 0 }, s)).toEqual({ label: 'Disabled', color: 'gray' })
  })

  it('tier 4 — disabled polarity is the opposite (truthy = inactive)', () => {
    const s = spec({ enabledField: 'disabled' })
    expect(indicatorFor({ disabled: 1 }, s)).toEqual({ label: 'Disabled', color: 'gray' })
    expect(indicatorFor({ disabled: 0 }, s)).toEqual({ label: 'Enabled', color: 'blue' })
  })

  it('tier 5 — keyword heuristic for an uncurated status value', () => {
    const s = spec({ statusField: 'status' })
    expect(indicatorFor({ status: 'Pending Review' }, s)).toEqual({ label: 'Pending Review', color: 'amber' })
    expect(indicatorFor({ status: 'Open' }, s)).toEqual({ label: 'Open', color: 'red' })
    expect(indicatorFor({ status: 'Completed' }, s)).toEqual({ label: 'Completed', color: 'green' })
    expect(indicatorFor({ status: 'Submitted' }, s)).toEqual({ label: 'Submitted', color: 'blue' })
  })

  it('tier 5 — an unrecognized status word falls through to gray', () => {
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
