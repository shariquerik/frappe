// tileMenuOptions is a pure projection of a pin → its right-click Remove option. removeResolvedPlacement
// (the shared remove path) is mocked so the spec asserts the label/region decision and that the option
// hands the EXACT pin to that path — without loading the placements seam's vue/registry/api graph.
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/placements', () => ({ removeResolvedPlacement: vi.fn() }))

import { removeResolvedPlacement } from '@/placements'
import { tileMenuOptions } from '@/placements/tile-menu'

const pin = (region) => ({ region, ref: { app: 'crm' }, position: null })

describe('tileMenuOptions', () => {
  beforeEach(() => vi.clearAllMocks())

  it('offers a single, bare "Remove" — the menu is already contextual', () => {
    for (const region of ['desktop', 'dock']) {
      const options = tileMenuOptions(pin(region))
      expect(options).toHaveLength(1)
      expect(options[0].label).toBe('Remove')
    }
  })

  it('removes the exact pin through the shared remove path on click', () => {
    const p = pin('dock')
    tileMenuOptions(p)[0].onClick()
    expect(removeResolvedPlacement).toHaveBeenCalledWith(p)
  })
})
