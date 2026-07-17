import { describe, it, expect } from 'vitest'
import { findChunkCycles } from '../build/chunk-cycles.js'

const chunk = (imports = [], dynamicImports = []) => ({ type: 'chunk', imports, dynamicImports })

describe('findChunkCycles', () => {
  it('passes an acyclic graph', () => {
    expect(
      findChunkCycles({
        'index.js': chunk(['src.js', 'frappe-ui.js']),
        'src.js': chunk(['frappe-ui.js']),
        'frappe-ui.js': chunk([]),
      }),
    ).toEqual([])
  })

  it('catches the two-chunk cycle that broke the OS boot', () => {
    // The real shape: frappe-ui's SidebarItem landed in its own chunk while its
    // sibling internals (_export_sfc, Spinner) stayed in src → mutual imports.
    const cycles = findChunkCycles({
      'index.js': chunk(['src.js']),
      'src.js': chunk(['SidebarItem.js']),
      'SidebarItem.js': chunk(['src.js']),
    })
    expect(cycles).toHaveLength(1)
    expect(cycles[0][0]).toBe(cycles[0].at(-1)) // closed path
    expect(cycles[0]).toContain('SidebarItem.js')
    expect(cycles[0]).toContain('src.js')
  })

  it('catches a longer cycle through an intermediate chunk', () => {
    const cycles = findChunkCycles({
      'src.js': chunk(['frappe-ui.js']),
      'frappe-ui.js': chunk(['ImageGroupUploadDialog.js']),
      'ImageGroupUploadDialog.js': chunk(['src.js']),
    })
    expect(cycles).toHaveLength(1)
    expect(cycles[0]).toHaveLength(4)
  })

  it('ignores dynamic imports — a lazy edge evaluates after both chunks', () => {
    expect(
      findChunkCycles({
        'src.js': chunk([], ['Applet.js']),
        'Applet.js': chunk(['src.js']),
      }),
    ).toEqual([])
  })

  it('ignores non-chunk assets', () => {
    expect(
      findChunkCycles({
        'style.css': { type: 'asset' },
        'index.js': chunk(['style.css']),
      }),
    ).toEqual([])
  })
})
