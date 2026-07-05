// The desktop-icon selection slice (Finder-style): pure logic over `state.iconSelection`, an array
// of pin keys distinct from the front-list `state.selection` (ADR-0038). Pins that a plain click
// REPLACES, a modified (Cmd/Shift) click TOGGLES, and an empty-wallpaper click CLEARS — the read
// model a later multi-move/delete layer builds on. Component wiring lives in App.vue, not here.
import { afterEach, describe, expect, it } from 'vitest'
import { selectIcon, clearIconSelection, isIconSelected, selectedIcons, soleSelectedIcon } from '../src/desktop/icon-selection'
import { state } from '../src/desktop/state'

afterEach(() => clearIconSelection())

describe('selectIcon — plain click replaces', () => {
  it('replaces the whole selection with the clicked key', () => {
    selectIcon('a')
    selectIcon('b')
    expect(selectedIcons()).toEqual(['b'])
  })

  it('re-selecting the same key keeps a single entry', () => {
    selectIcon('a')
    selectIcon('a')
    expect(selectedIcons()).toEqual(['a'])
  })
})

describe('selectIcon — additive click toggles/extends', () => {
  it('extends the selection with an unselected key', () => {
    selectIcon('a')
    selectIcon('b', { additive: true })
    expect(selectedIcons()).toEqual(['a', 'b'])
  })

  it('toggles a selected key back out', () => {
    selectIcon('a')
    selectIcon('b', { additive: true })
    selectIcon('a', { additive: true })
    expect(selectedIcons()).toEqual(['b'])
  })

  it('additive on an empty selection just adds the key', () => {
    selectIcon('a', { additive: true })
    expect(selectedIcons()).toEqual(['a'])
  })
})

describe('clearIconSelection — empties the set', () => {
  it('drops every selected key', () => {
    selectIcon('a')
    selectIcon('b', { additive: true })
    clearIconSelection()
    expect(selectedIcons()).toEqual([])
  })

  it('is a no-op on an already-empty selection', () => {
    clearIconSelection()
    expect(state.iconSelection).toEqual([])
  })
})

describe('isIconSelected — reflects membership', () => {
  it('is true for a selected key and false otherwise', () => {
    selectIcon('a')
    selectIcon('b', { additive: true })
    expect(isIconSelected('a')).toBe(true)
    expect(isIconSelected('b')).toBe(true)
    expect(isIconSelected('c')).toBe(false)
  })
})

describe('soleSelectedIcon — the single-target action key (Return/F2 rename)', () => {
  it('is the key when exactly one icon is selected', () => {
    selectIcon('a')
    expect(soleSelectedIcon()).toBe('a')
  })

  it('is null on an empty selection', () => {
    expect(soleSelectedIcon()).toBe(null)
  })

  it('is null on a multi-select — single-target actions stay disabled', () => {
    selectIcon('a')
    selectIcon('b', { additive: true })
    expect(soleSelectedIcon()).toBe(null)
  })
})
