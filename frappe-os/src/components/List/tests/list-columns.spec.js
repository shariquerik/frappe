// list-columns projection: curated ListColumn config -> ListView columns, and one cell
// value -> its rendered kind. Pure decision tables, no Vue/store (mirrors route-map.spec).
import { describe, expect, it } from 'vitest'
import { toListViewColumns, cellKind } from '../list-columns'

describe('toListViewColumns', () => {
  it('returns [] for empty / missing input', () => {
    expect(toListViewColumns()).toEqual([])
    expect(toListViewColumns([])).toEqual([])
  })

  it('right-aligns currency and int, left-aligns everything else', () => {
    const cols = toListViewColumns([
      { key: 'amount', label: 'Amount', type: 'currency' },
      { key: 'qty', label: 'Qty', type: 'int' },
      { key: 'title', label: 'Title' },
      { key: 'state', label: 'State', type: 'status' },
    ])
    expect(cols.map((c) => c.align)).toEqual(['right', 'right', 'left', 'left'])
  })

  it('passes width through verbatim, defaulting when absent', () => {
    const cols = toListViewColumns([
      { key: 'a', label: 'A', width: '120px' },
      { key: 'b', label: 'B', width: 'minmax(160px,1.5fr)' },
      { key: 'c', label: 'C' },
    ])
    expect(cols.map((c) => c.width)).toEqual(['120px', 'minmax(160px,1.5fr)', 'minmax(120px,1fr)'])
  })

  it('carries key, label, type and primary onto each column', () => {
    const [col] = toListViewColumns([{ key: 'title', label: 'Title', type: 'avatar', primary: true }])
    expect(col).toEqual({ key: 'title', label: 'Title', width: 'minmax(120px,1fr)', align: 'left', type: 'avatar', primary: true })
  })

  it('coerces a missing primary flag to false', () => {
    const [col] = toListViewColumns([{ key: 'x', label: 'X' }])
    expect(col.primary).toBe(false)
  })
})

describe('cellKind', () => {
  const themes = { Open: 'orange', Paid: 'green' }

  it('classifies a status value with its theme', () => {
    expect(cellKind('Open', { type: 'status' }, themes)).toEqual({ kind: 'status', display: 'Open', theme: 'orange' })
  })

  it('falls back to gray for an unthemed status value', () => {
    expect(cellKind('Weird', { type: 'status' }, themes)).toEqual({ kind: 'status', display: 'Weird', theme: 'gray' })
  })

  it('classifies an avatar value, keeping its label', () => {
    expect(cellKind('Jane', { type: 'avatar' })).toEqual({ kind: 'avatar', display: 'Jane', label: 'Jane' })
  })

  it('empties the avatar label when the value is null', () => {
    expect(cellKind(null, { type: 'avatar' })).toEqual({ kind: 'avatar', display: '—', label: '' })
  })

  it('classifies a primary column as primary', () => {
    expect(cellKind('INV-001', { primary: true })).toEqual({ kind: 'primary', display: 'INV-001' })
  })

  it('classifies everything else as plain', () => {
    expect(cellKind('hello', {})).toEqual({ kind: 'plain', display: 'hello' })
  })

  it('renders an em-dash for null / empty plain values', () => {
    expect(cellKind(null, {}).display).toBe('—')
    expect(cellKind('', {}).display).toBe('—')
  })

  it('stringifies non-string values', () => {
    expect(cellKind(42, { type: 'int' }).display).toBe('42')
    expect(cellKind(0, {}).display).toBe('0')
  })
})
