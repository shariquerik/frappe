// The Finder tile selection (issue #05): a single highlighted tile, keyed by FinderItem key. Pure
// state — single-select replaces, clear empties, isSelected reads.
import { beforeEach, describe, expect, it } from 'vitest'
import { selectFinderTile, clearFinderSelection, isFinderTileSelected, selectedFinderTile } from '../selection'

describe('Finder tile selection', () => {
  beforeEach(() => clearFinderSelection())

  it('selects a tile and reads it back', () => {
    selectFinderTile('finder:a')
    expect(isFinderTileSelected('finder:a')).toBe(true)
    expect(selectedFinderTile()).toBe('finder:a')
  })

  it('single-select: a new selection REPLACES the previous one', () => {
    selectFinderTile('finder:a')
    selectFinderTile('finder:b')
    expect(isFinderTileSelected('finder:a')).toBe(false)
    expect(isFinderTileSelected('finder:b')).toBe(true)
  })

  it('clears the selection (empty-grid click / Location change)', () => {
    selectFinderTile('finder:a')
    clearFinderSelection()
    expect(selectedFinderTile()).toBe(null)
    expect(isFinderTileSelected('finder:a')).toBe(false)
  })
})
