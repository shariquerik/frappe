// Desktop grid math (ADR-0023 "Grid cells, not pixels"). These pin the resolution-independent,
// edge-anchored cell model: a drop snaps to a cell, a cell projects back to pixels (round-trip),
// collisions flow to the next free cell deterministically, and the server-delivered list lays out
// into concrete cells the same way on every reload/device. Pure math — no DOM, no Vue.
import { describe, expect, it } from 'vitest'
import { cellToPixel, snapToCell, nextFreeCell, resolveDrop, layoutDesktop, CELL_W, CELL_H } from '../src/desktop/grid'

const W = 1280, H = 800
const key = (c) => c.column + ',' + c.row

describe('cellToPixel / snapToCell — edge-anchored, resolution-independent', () => {
  it('anchors column 0 to the right edge and row 0 to the top', () => {
    const px = cellToPixel({ column: 0, row: 0 }, W)
    expect(px.x).toBe(W - 18 - CELL_W) // rightmost column, one cell in from the 18px inset
    expect(px.y).toBe(46) // top inset
  })

  it('grows columns leftward and rows downward by one cell each', () => {
    expect(cellToPixel({ column: 1, row: 0 }, W).x).toBe(cellToPixel({ column: 0, row: 0 }, W).x - CELL_W)
    expect(cellToPixel({ column: 0, row: 1 }, W).y).toBe(cellToPixel({ column: 0, row: 0 }, W).y + CELL_H)
  })

  it('round-trips a cell through pixels and back (snap is the inverse projection)', () => {
    for (const cell of [{ column: 0, row: 0 }, { column: 2, row: 3 }, { column: 1, row: 5 }]) {
      expect(snapToCell(cellToPixel(cell, W), W, H)).toEqual(cell)
    }
  })

  it('snaps a slightly-off drop to the nearest cell', () => {
    const px = cellToPixel({ column: 1, row: 2 }, W)
    expect(snapToCell({ x: px.x + 12, y: px.y - 9 }, W, H)).toEqual({ column: 1, row: 2 })
  })

  it('clamps a drop past the top/right edge into the first valid cell', () => {
    expect(snapToCell({ x: 99999, y: -500 }, W, H)).toEqual({ column: 0, row: 0 })
  })
})

describe('nextFreeCell — deterministic collision flow', () => {
  it('returns the start cell when it is free', () => {
    expect(nextFreeCell(new Set(), H, { column: 0, row: 0 })).toEqual({ column: 0, row: 0 })
  })

  it('flows down the same column to the next free row', () => {
    const taken = new Set([key({ column: 0, row: 0 }), key({ column: 0, row: 1 })])
    expect(nextFreeCell(taken, H, { column: 0, row: 0 })).toEqual({ column: 0, row: 2 })
  })

  it('wraps to the next column when the start column is full', () => {
    const rows = Math.floor((H - 46) / CELL_H)
    const taken = new Set()
    for (let r = 0; r < rows; r++) taken.add(key({ column: 0, row: r }))
    expect(nextFreeCell(taken, H, { column: 0, row: 0 })).toEqual({ column: 1, row: 0 })
  })

  it('is deterministic — same inputs, same cell', () => {
    const taken = new Set([key({ column: 0, row: 0 })])
    expect(nextFreeCell(taken, H, { column: 0, row: 0 })).toEqual(nextFreeCell(taken, H, { column: 0, row: 0 }))
  })
})

describe('resolveDrop — snap then flow off a collision', () => {
  it('keeps the snapped cell when it is free', () => {
    const px = cellToPixel({ column: 1, row: 1 }, W)
    expect(resolveDrop(px, [{ column: 0, row: 0 }], W, H)).toEqual({ column: 1, row: 1 })
  })

  it('flows to the next free cell when the snapped cell is occupied by another pin', () => {
    const px = cellToPixel({ column: 0, row: 0 }, W)
    expect(resolveDrop(px, [{ column: 0, row: 0 }], W, H)).toEqual({ column: 0, row: 1 })
  })
})

describe('layoutDesktop — server list → concrete cells, identically every time', () => {
  const pin = (ref, position) => ({ region: 'desktop', ref, position: position ?? null })

  it('honours a stored cell and auto-places a positionless pin into the next free cell', () => {
    const cells = layoutDesktop([
      pin({ app: 'frappe' }, { column: 1, row: 2 }),
      pin({ app: 'crm' }), // no stored position
    ], H)
    expect(cells[0]).toEqual({ column: 1, row: 2 })
    expect(cells[1]).toEqual({ column: 0, row: 0 }) // first free cell
  })

  it('flows two pins that want the same cell so they never stack', () => {
    const cells = layoutDesktop([
      pin({ app: 'frappe' }, { column: 0, row: 0 }),
      pin({ app: 'crm' }, { column: 0, row: 0 }),
    ], H)
    expect(cells[0]).toEqual({ column: 0, row: 0 })
    expect(cells[1]).not.toEqual(cells[0])
  })

  it('lays out the same list identically on every call (roam-stable)', () => {
    const list = [pin({ app: 'frappe' }), pin({ app: 'crm' }, { column: 0, row: 0 }), pin({ app: 'erpnext' })]
    expect(layoutDesktop(list, H)).toEqual(layoutDesktop(list, H))
  })
})
