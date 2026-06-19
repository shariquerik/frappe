import { describe, it, expect } from 'vitest'
import { buildFormLayout } from '@/components/Form/layout'

const field = (fieldname, over = {}) => ({ fieldname, fieldtype: 'Data', label: fieldname, ...over })

describe('buildFormLayout', () => {
  it('returns a single tab with no sections for empty input', () => {
    expect(buildFormLayout([], true)).toEqual([{ sections: [] }])
    expect(buildFormLayout(undefined, true)).toEqual([{ sections: [] }])
  })

  it('groups fields by their section, defaulting to Details, in schema order', () => {
    const [tab] = buildFormLayout(
      [field('a'), field('b', { section: 'Contact' }), field('c')],
      true,
    )
    expect(tab.sections.map((s) => s.label)).toEqual(['Details', 'Contact'])
    // 'a' and 'c' share the default Details section even though 'b' sits between them.
    const details = tab.sections[0]
    expect(details.columns.flatMap((c) => c.fields).map((f) => f.fieldname)).toEqual(['a', 'c'])
  })

  it('splits a section round-robin across two columns', () => {
    const [tab] = buildFormLayout([field('a'), field('b'), field('c'), field('d')], true)
    const [col0, col1] = tab.sections[0].columns
    expect(col0.fields.map((f) => f.fieldname)).toEqual(['a', 'c'])
    expect(col1.fields.map((f) => f.fieldname)).toEqual(['b', 'd'])
  })

  it('forces every field read-only when not editable', () => {
    const [tab] = buildFormLayout([field('a')], false)
    expect(tab.sections[0].columns[0].fields[0].readOnly).toBe(true)
  })

  it('honors a field own read_only flag even when editable', () => {
    const [tab] = buildFormLayout([field('a', { read_only: 1 }), field('b')], true)
    const fields = tab.sections[0].columns.flatMap((c) => c.fields)
    expect(fields.find((f) => f.fieldname === 'a').readOnly).toBe(true)
    expect(fields.find((f) => f.fieldname === 'b').readOnly).toBe(false)
  })

  it('coerces reqd to boolean and empty options to undefined', () => {
    const [tab] = buildFormLayout([field('a', { reqd: 1, options: '' })], true)
    const f = tab.sections[0].columns[0].fields[0]
    expect(f.reqd).toBe(true)
    expect(f.options).toBeUndefined()
  })
})
