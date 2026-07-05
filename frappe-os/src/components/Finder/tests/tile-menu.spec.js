// finderTileMenuOptions is a pure projection of a Finder tile → its right-click options. Its seams —
// the shared open path and the ref-targeted pin/unpin helpers — are mocked so the spec asserts the
// label/order decisions and that each option hands the EXACT arguments to its seam, without loading
// the placements/registry/desktop graph. A Finder tile is NOT a pin, so the menu is Open + Add-to /
// Remove-from Desktop/Dock — never Rename, never a bare Remove.
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/desktop/windows', () => ({ openRef: vi.fn() }))
vi.mock('@/actions/placement-verbs', () => ({
  pinToDesktop: vi.fn(), pinToDock: vi.fn(), unpinRef: vi.fn(), isPinned: vi.fn(() => false),
}))

import { openRef } from '@/desktop/windows'
import { pinToDesktop, pinToDock, unpinRef, isPinned } from '@/actions/placement-verbs'
import { finderTileMenuOptions } from '@/components/Finder/tile-menu'

const os = { desktopRef: { h: 800 } }
const appItem = { key: 'k1', ref: { app: 'crm' }, label: 'CRM' }
const doctypeItem = { key: 'k2', ref: { doctype: 'ToDo', view: 'list' }, label: 'ToDo' }
const labels = (options) => options.map((o) => (o.separator ? '---' : o.label))
const byLabel = (options, label) => options.find((o) => o.label === label)

describe('finderTileMenuOptions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    isPinned.mockReturnValue(false)
  })

  it('an unpinned tile offers "Open", a divider, then "Add to Desktop" + "Add to Dock"', () => {
    expect(labels(finderTileMenuOptions(appItem, os))).toEqual(['Open', '---', 'Add to Desktop', 'Add to Dock'])
  })

  it('"Open" opens the tile reference through the shared openRef path', () => {
    finderTileMenuOptions(appItem, os)[0].onClick()
    expect(openRef).toHaveBeenCalledWith({ app: 'crm' })
  })

  it('"Add to Desktop" pins the tile ref into the next free cell with the live desktop height', () => {
    byLabel(finderTileMenuOptions(doctypeItem, os), 'Add to Desktop').onClick()
    expect(pinToDesktop).toHaveBeenCalledWith({ doctype: 'ToDo', view: 'list' }, 800)
  })

  it('"Add to Dock" pins the tile ref onto the dock', () => {
    byLabel(finderTileMenuOptions(doctypeItem, os), 'Add to Dock').onClick()
    expect(pinToDock).toHaveBeenCalledWith({ doctype: 'ToDo', view: 'list' })
  })

  it('flips each region to "Remove from …" when the ref is already pinned there', () => {
    isPinned.mockReturnValue(true)
    const options = finderTileMenuOptions(appItem, os)
    expect(labels(options)).toEqual(['Open', '---', 'Remove from Desktop', 'Remove from Dock'])
    byLabel(options, 'Remove from Dock').onClick()
    expect(unpinRef).toHaveBeenCalledWith('dock', { app: 'crm' })
  })

  it('never offers Rename or a bare Remove (a Finder tile is not a pin)', () => {
    const all = labels(finderTileMenuOptions(doctypeItem, os))
    expect(all).not.toContain('Rename')
    expect(all).not.toContain('Remove')
  })
})
