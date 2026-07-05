// tileMenuOptions is a pure projection of a pin → its right-click options. Its three seams — the
// shared remove path, the app opener, and the workbench opener — are mocked so the spec asserts the
// label/order/region decisions and that each option hands the EXACT arguments to its seam, without
// loading the placements/registry/desktop vue+api graph.
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/placements', () => ({ removeResolvedPlacement: vi.fn() }))
vi.mock('@/desktop/windows', () => ({ openApp: vi.fn(), openAppWorkbench: vi.fn() }))
vi.mock('@/surface', () => ({
  isAppRef: (ref) => !!ref.app && !ref.applet && !ref.doctype && !ref.dashboard,
  opensAppletOnClick: vi.fn(() => false),
}))

import { removeResolvedPlacement } from '@/placements'
import { openApp, openAppWorkbench } from '@/desktop/windows'
import { opensAppletOnClick } from '@/surface'
import { tileMenuOptions } from '@/placements/tile-menu'

const appPin = (region = 'desktop') => ({ region, ref: { app: 'crm' }, position: null })
const appletPin = (region = 'dock') => ({ region, ref: { app: 'raven', applet: 'chat' }, position: null })
const doctypePin = () => ({ region: 'desktop', ref: { doctype: 'ToDo', view: 'list' }, position: null })
const labels = (options) => options.map((o) => (o.separator ? '---' : o.label))

describe('tileMenuOptions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    opensAppletOnClick.mockReturnValue(false)
  })

  it('a normal app tile (click opens its workbench) offers "Open", a divider, then "Remove"', () => {
    for (const region of ['desktop', 'dock']) {
      expect(labels(tileMenuOptions(appPin(region)))).toEqual(['Open', '---', 'Remove'])
    }
  })

  it('an applet-default app tile adds "Open Workspaces" between "Open" and the divider', () => {
    opensAppletOnClick.mockReturnValue(true)
    for (const region of ['desktop', 'dock']) {
      expect(labels(tileMenuOptions(appPin(region)))).toEqual(['Open', 'Open Workspaces', '---', 'Remove'])
    }
  })

  it('"Open" runs the tile-click action (openApp) for the pin\'s app', () => {
    tileMenuOptions(appPin())[0].onClick()
    expect(openApp).toHaveBeenCalledWith('crm')
  })

  it('"Open Workspaces" opens the app\'s workbench hub (openAppWorkbench)', () => {
    opensAppletOnClick.mockReturnValue(true)
    tileMenuOptions(appPin())[1].onClick()
    expect(openAppWorkbench).toHaveBeenCalledWith('crm')
  })

  it('a non-app (doctype) pin lists no open verbs — just "Remove"', () => {
    const options = tileMenuOptions(doctypePin())
    expect(labels(options)).toEqual(['Remove'])
    expect(opensAppletOnClick).not.toHaveBeenCalled()
  })

  it('an applet pin still exposes its app\'s open verbs (the dock raven-chat pin, not just Remove)', () => {
    opensAppletOnClick.mockReturnValue(true)
    const options = tileMenuOptions(appletPin('dock'))
    expect(labels(options)).toEqual(['Open', 'Open Workspaces', '---', 'Remove'])
    options.find((o) => o.label === 'Open Workspaces').onClick()
    expect(openAppWorkbench).toHaveBeenCalledWith('raven')
  })

  it('adds "Rename" before "Remove" for a desktop pin when the caller wires onRename', () => {
    expect(labels(tileMenuOptions(appPin('desktop'), { onRename: () => {} }))).toEqual([
      'Open', '---', 'Rename', 'Remove',
    ])
  })

  it('"Rename" runs the caller\'s onRename starter on click', () => {
    const onRename = vi.fn()
    const options = tileMenuOptions(appPin('desktop'), { onRename })
    options.find((o) => o.label === 'Rename').onClick()
    expect(onRename).toHaveBeenCalledOnce()
  })

  it('offers no "Rename" on the dock (no visible label there) even with onRename wired', () => {
    expect(labels(tileMenuOptions(appPin('dock'), { onRename: () => {} }))).toEqual(['Open', '---', 'Remove'])
  })

  it('renames a doctype desktop pin too — "Rename" then "Remove", no open verbs', () => {
    expect(labels(tileMenuOptions(doctypePin(), { onRename: () => {} }))).toEqual(['Rename', 'Remove'])
  })

  it('removes the exact pin through the shared remove path on click', () => {
    const p = appPin('dock')
    const options = tileMenuOptions(p)
    options[options.length - 1].onClick()
    expect(removeResolvedPlacement).toHaveBeenCalledWith(p)
  })
})
