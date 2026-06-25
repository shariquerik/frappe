// Desktop grid: edge-anchored, resolution-independent cells (ADR-0023 "Grid cells, not pixels").
// A desktop placement carries a {column, row} cell, NEVER raw pixels — so a move authored on a 4K
// monitor reconstitutes on a laptop and admins can author for unknown screens. This module is the
// PURE math (snap a pointer drop to a cell, flow collisions to the next free cell, project a cell
// back to pixels for rendering). Kept free of Vue so vitest covers it without a DOM.
import type { PlacementPosition, ResolvedPlacement } from '@/types'

// The cell box and the desktop inset. Icons anchor to the desktop's TOP-RIGHT (matching today's
// hardcoded column): column 0 is the rightmost column, growing leftward; row 0 is the topmost,
// growing downward. Edge-anchoring is what keeps a cell meaningful across screen sizes.
export const CELL_W = 90
export const CELL_H = 92
const INSET_RIGHT = 18
const INSET_TOP = 46

export interface Cell { column: number; row: number }
export interface Pixel { x: number; y: number }

// How many rows fit before a column wraps, given the usable desktop height. At least one row, so a
// tiny viewport never divides by zero or yields an empty grid.
export function rowsPerColumn(deskHeight: number): number {
  return Math.max(1, Math.floor((deskHeight - INSET_TOP) / CELL_H))
}

// Project a cell to the top-left pixel of its icon button. Column anchors from the right edge:
// the rightmost column (0) sits at deskWidth - INSET_RIGHT - CELL_W, each further column one
// CELL_W left. Row anchors from the top. This is the only place pixels are computed.
export function cellToPixel(cell: Cell, deskWidth: number): Pixel {
  return {
    x: deskWidth - INSET_RIGHT - CELL_W * (cell.column + 1),
    y: INSET_TOP + CELL_H * cell.row,
  }
}

// Snap a pointer drop (top-left of the dragged icon, in desktop-local pixels) to the nearest grid
// cell. Inverse of cellToPixel; clamped so a drop off the top/right edge lands in the first cell.
export function snapToCell(px: Pixel, deskWidth: number, deskHeight: number): Cell {
  const column = Math.round((deskWidth - INSET_RIGHT - CELL_W - px.x) / CELL_W)
  const row = Math.round((px.y - INSET_TOP) / CELL_H)
  const maxRow = rowsPerColumn(deskHeight) - 1
  return { column: Math.max(0, column), row: Math.max(0, Math.min(maxRow, row)) }
}

// A stable key for a cell, for occupancy lookups.
const cellKey = (c: Cell): string => c.column + ',' + c.row

// Walk the grid in a deterministic order (row by row within a column, then the next column) and
// return the first cell not in `taken`. Used both to flow a collided drop to a free cell and to
// auto-place a pin the server delivered without a position. Wraps a full column at deskHeight.
export function nextFreeCell(taken: Set<string>, deskHeight: number, start: Cell = { column: 0, row: 0 }): Cell {
  const rows = rowsPerColumn(deskHeight)
  for (let column = start.column; column < start.column + 200; column++) {
    const fromRow = column === start.column ? start.row : 0
    for (let row = fromRow; row < rows; row++) {
      const cell = { column, row }
      if (!taken.has(cellKey(cell))) return cell
    }
  }
  return start // grid full (unreachable for any realistic desktop)
}

// Resolve the dropped icon's target cell: snap the drop, then if that cell is already taken by
// ANOTHER pin, deterministically flow to the next free cell. `occupied` is every OTHER pin's cell.
export function resolveDrop(px: Pixel, occupied: Cell[], deskWidth: number, deskHeight: number): Cell {
  const taken = new Set(occupied.map(cellKey))
  const snapped = snapToCell(px, deskWidth, deskHeight)
  return taken.has(cellKey(snapped)) ? nextFreeCell(taken, deskHeight, snapped) : snapped
}

// Assign a concrete cell to every desktop pin, in resolved-list order: a pin with a stored cell
// keeps it (collisions flow to the next free cell so two overrides never stack); a pin the server
// delivered without a position is auto-placed into the next free cell. Deterministic, so a desktop
// reconstitutes identically on reload and across devices. Returns parallel cells for the input list.
export function layoutDesktop(pins: ResolvedPlacement[], deskHeight: number): Cell[] {
  const taken = new Set<string>()
  return pins.map((p) => {
    const pos = p.position as PlacementPosition | null | undefined
    const wanted = pos && pos.column != null && pos.row != null ? { column: pos.column, row: pos.row } : null
    const cell = wanted && !taken.has(cellKey(wanted)) ? wanted : nextFreeCell(taken, deskHeight, wanted ?? undefined)
    taken.add(cellKey(cell))
    return cell
  })
}
