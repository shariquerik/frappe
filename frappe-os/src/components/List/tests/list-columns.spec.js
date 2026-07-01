// cellKind projection (ADR-0028): one record + live wire column + indicator spec -> its
// rendered cell kind. Pure decision table, no Vue/store (mirrors route-map.spec).
import { describe, expect, it } from 'vitest'
import { cellKind, listFetchFields } from '../list-columns'

describe('cellKind', () => {
  // Live per-doctype context (ADR-0028): the status field resolves the whole row through the
  // indicator spec, the title field renders primary.
  const spec = {
    statusField: 'status',
    workflow: {},
    isSubmittable: true,
    rules: [{ condition: 'status,=,Paid', label: 'Paid', color: 'green' }],
    fields: ['status', 'docstatus'],
  }
  const ctx = { statusField: 'status', titleField: 'title', spec }
  const statusCol = { key: 'status', type: 'Select' }

  it('resolves the status column through the whole row (a matching rule)', () => {
    expect(cellKind({ status: 'Paid', docstatus: 1 }, statusCol, ctx)).toEqual({ kind: 'status', display: 'Paid', theme: 'green' })
  })

  it('resolves the status column from a built-in tier the status word cannot express', () => {
    // No rule match, but a submittable Draft — indicatorFor reads docstatus off the row.
    expect(cellKind({ status: 'Whatever', docstatus: 0 }, statusCol, ctx)).toEqual({ kind: 'status', display: 'Draft', theme: 'red' })
  })

  it('renders the status column plain when nothing resolves', () => {
    const s = { statusField: 'status', workflow: {}, isSubmittable: false, rules: [], fields: [] }
    expect(cellKind({ status: '' }, statusCol, { statusField: 'status', spec: s })).toEqual({ kind: 'plain', display: '—' })
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
