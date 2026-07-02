// cellKind projection (ADR-0028): one record + live wire column + indicator spec -> its
// rendered cell kind. Pure decision table, no Vue/store (mirrors route-map.spec).
import { describe, expect, it } from 'vitest'
import { cellKind, listFetchFields, hasIndicator, withIndicatorColumn, INDICATOR_COLUMN_KEY } from '../list-columns'

describe('cellKind', () => {
  // Live per-doctype context (ADR-0028): the indicator column resolves the whole row through the
  // indicator spec; the title field renders primary.
  const spec = {
    statusField: 'status',
    workflow: {},
    isSubmittable: true,
    rules: [{ condition: 'status,=,Paid', label: 'Paid', color: 'green' }],
    fields: ['status', 'docstatus'],
  }
  const ctx = { titleField: 'title', spec }
  const indicatorCol = { key: INDICATOR_COLUMN_KEY, type: 'Status' }

  it('resolves the indicator column through the whole row (a matching rule)', () => {
    expect(cellKind({ status: 'Paid', docstatus: 1 }, indicatorCol, ctx)).toEqual({ kind: 'status', display: 'Paid', theme: 'green' })
  })

  it('resolves the indicator column from a built-in tier the status word cannot express', () => {
    // No rule match, but a submittable Draft — indicatorFor reads docstatus off the row.
    expect(cellKind({ status: 'Whatever', docstatus: 0 }, indicatorCol, ctx)).toEqual({ kind: 'status', display: 'Draft', theme: 'red' })
  })

  it('resolves the indicator with NO visible status field (User/enabled, Note/public) — finding #6', () => {
    // statusField is null; the pill comes entirely from a rule over `enabled`. The old
    // status-column gate drew nothing here because no visible column matched statusField.
    const s = { statusField: null, workflow: {}, isSubmittable: false, rules: [{ condition: 'enabled,=,0', label: 'Disabled', color: 'gray' }], fields: ['enabled'] }
    expect(cellKind({ enabled: 0 }, indicatorCol, { spec: s })).toEqual({ kind: 'status', display: 'Disabled', theme: 'gray' })
  })

  it('leaves the indicator cell blank (not an em-dash) when nothing resolves', () => {
    // A row with no indicator renders an empty Status cell, like Desk — an em-dash would read as a
    // missing field value rather than "this row has no status".
    const s = { statusField: 'status', workflow: {}, isSubmittable: false, rules: [], fields: [] }
    expect(cellKind({ status: '' }, indicatorCol, { spec: s })).toEqual({ kind: 'plain', display: '' })
  })

  it('renders the raw status field column as plain text — the pill lives in the indicator column now', () => {
    expect(cellKind({ status: 'Paid' }, { key: 'status', type: 'Select' }, ctx)).toEqual({ kind: 'plain', display: 'Paid' })
  })

  it('classifies the title column as primary', () => {
    expect(cellKind({ title: 'INV-001' }, { key: 'title', type: 'Data' }, ctx)).toEqual({ kind: 'primary', display: 'INV-001' })
  })

  it('honors an explicit primary flag on the column', () => {
    expect(cellKind({ name: 'INV-001' }, { key: 'name', primary: true }, {})).toEqual({ kind: 'primary', display: 'INV-001' })
  })

  it('classifies a Link-to-User column as an avatar, keeping its label', () => {
    expect(cellKind({ owner: 'Jane' }, { key: 'owner', type: 'Link', options: 'User' }, ctx)).toEqual({ kind: 'avatar', display: 'Jane', label: 'Jane' })
  })

  it('empties the avatar label when the value is null', () => {
    expect(cellKind({ owner: null }, { key: 'owner', type: 'Link', options: 'User' }, ctx)).toEqual({ kind: 'avatar', display: '—', label: '' })
  })

  it('renders a non-person Link (status, territory) as plain, not an avatar', () => {
    // CRM Lead.status is a Link to CRM Lead Status — not a person, so no avatar chip (#06).
    expect(cellKind({ status: 'Qualified' }, { key: 'status', type: 'Link', options: 'CRM Lead Status' }, {})).toEqual({ kind: 'plain', display: 'Qualified' })
    expect(cellKind({ territory: 'India' }, { key: 'territory', type: 'Link', options: 'CRM Territory' }, {})).toEqual({ kind: 'plain', display: 'India' })
  })

  it('classifies everything else as plain', () => {
    expect(cellKind({ note: 'hello' }, { key: 'note', type: 'Data' }, ctx)).toEqual({ kind: 'plain', display: 'hello' })
  })

  it('renders an em-dash for null / empty plain values', () => {
    expect(cellKind({ note: null }, { key: 'note', type: 'Data' }, ctx).display).toBe('—')
    expect(cellKind({ note: '' }, { key: 'note', type: 'Data' }, ctx).display).toBe('—')
  })

  it('stringifies non-string values', () => {
    expect(cellKind({ qty: 42 }, { key: 'qty', type: 'Int' }, ctx).display).toBe('42')
    expect(cellKind({ qty: 0 }, { key: 'qty', type: 'Int' }, ctx).display).toBe('0')
  })
})

describe('hasIndicator', () => {
  const base = { statusField: null, workflow: {}, isSubmittable: false, rules: [], fields: [] }

  it('is true when the doctype has a status field', () => {
    expect(hasIndicator({ ...base, statusField: 'status' })).toBe(true)
  })

  it('is true when the doctype is submittable (the built-in Draft/Cancelled tier)', () => {
    expect(hasIndicator({ ...base, isSubmittable: true })).toBe(true)
  })

  it('is true when a rule can paint a pill (enabled / publication, statusField null)', () => {
    expect(hasIndicator({ ...base, rules: [{ condition: 'enabled,=,0', label: 'Disabled', color: 'gray' }] })).toBe(true)
  })

  it('is false for a doctype with no status model, and for a missing spec', () => {
    expect(hasIndicator(base)).toBe(false)
    expect(hasIndicator(null)).toBe(false)
  })
})

describe('withIndicatorColumn', () => {
  const cols = [{ key: 'subject', label: 'Subject' }, { key: 'status', label: 'Status' }, { key: 'modified', label: 'Modified' }]

  it('inserts the indicator column after the title column and drops the raw status field (Desk-parity)', () => {
    const spec = { statusField: 'status', workflow: {}, isSubmittable: false, rules: [{ condition: 'status,=,Open', label: 'Open', color: 'red' }], fields: ['status'] }
    const out = withIndicatorColumn(cols, spec)
    expect(out.map((c) => c.key)).toEqual(['subject', INDICATOR_COLUMN_KEY, 'modified'])
    expect(out[1]).toMatchObject({ key: INDICATOR_COLUMN_KEY, label: 'Status', type: 'Status' })
  })

  it('adds the indicator column even when no status field is visible (submittable / enabled)', () => {
    const spec = { statusField: null, workflow: {}, isSubmittable: true, rules: [], fields: ['docstatus'] }
    expect(withIndicatorColumn([{ key: 'subject' }], spec).map((c) => c.key)).toEqual(['subject', INDICATOR_COLUMN_KEY])
  })

  it('returns the columns untouched when the doctype has no indicator', () => {
    const spec = { statusField: null, workflow: {}, isSubmittable: false, rules: [], fields: [] }
    expect(withIndicatorColumn(cols, spec)).toBe(cols)
  })

  it('is a no-op with no spec held yet', () => {
    expect(withIndicatorColumn(cols, null)).toBe(cols)
  })
})

describe('listFetchFields', () => {
  const cols = [{ key: 'title' }, { key: 'status' }, { key: 'modified' }]

  it('is name + wire column keys when the spec references no fields', () => {
    const spec = { statusField: null, workflow: {}, isSubmittable: false, rules: [], fields: [] }
    expect(listFetchFields(cols, spec)).toEqual(['name', 'title', 'status', 'modified'])
  })

  it('unions the server-named indicator fields so a Draft/Cancelled pill is not dark', () => {
    const spec = { statusField: 'status', workflow: {}, isSubmittable: true, rules: [], fields: ['status', 'docstatus'] }
    expect(listFetchFields([{ key: 'title' }], spec)).toEqual(['name', 'title', 'status', 'docstatus'])
  })

  it('unions a field a rule condition references so a disabled record still greys', () => {
    const spec = { statusField: null, workflow: {}, isSubmittable: false, rules: [], fields: ['disabled'] }
    expect(listFetchFields([{ key: 'full_name' }], spec)).toEqual(['name', 'full_name', 'disabled'])
  })

  it('dedupes an indicator field that is also a visible column', () => {
    const spec = { statusField: 'status', workflow: {}, isSubmittable: false, rules: [], fields: ['status'] }
    expect(listFetchFields(cols, spec)).toEqual(['name', 'title', 'status', 'modified'])
  })

  it('is just name + columns when no spec is held yet', () => {
    expect(listFetchFields(cols, null)).toEqual(['name', 'title', 'status', 'modified'])
  })
})
