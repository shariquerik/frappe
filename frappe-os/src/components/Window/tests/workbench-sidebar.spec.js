// workbenchItems — the workbench sidebar's pure item builder (ADR-0042). It turns a workspace's
// derived doctype names into rendered rows and, crucially, degrades gracefully: a doctype it can't
// build a row for is skipped with a console.warn, never crashing the sidebar. The doctype
// derivation + exclusions live server-side (os_core/workspaces.py); this only pins the client's
// skip-and-warn contract and order preservation.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { workbenchItems } from '../workbench-sidebar'

describe('workbenchItems', () => {
  afterEach(() => vi.restoreAllMocks())

  it('builds one row per doctype, order preserved', () => {
    const items = workbenchItems(['Sales Order', 'Quotation'], (dt) => ({ label: dt }))
    expect(items).toEqual([{ label: 'Sales Order' }, { label: 'Quotation' }])
  })

  it('skips a doctype the builder throws on, warns, and renders the rest', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const items = workbenchItems(['Sales Order', 'Broken', 'Quotation'], (dt) => {
      if (dt === 'Broken') throw new Error('no meta')
      return { label: dt }
    })
    expect(items).toEqual([{ label: 'Sales Order' }, { label: 'Quotation' }])
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0][0]).toContain('Broken')
  })

  it('skips a doctype the builder returns null for, with a warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const items = workbenchItems(['Good', 'Skip'], (dt) => (dt === 'Skip' ? null : { label: dt }))
    expect(items).toEqual([{ label: 'Good' }])
    expect(warn).toHaveBeenCalledTimes(1)
  })

  it('skips an empty/falsy doctype name without calling the builder', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const build = vi.fn((dt) => ({ label: dt }))
    const items = workbenchItems(['', 'Real'], build)
    expect(items).toEqual([{ label: 'Real' }])
    expect(build).toHaveBeenCalledTimes(1)
    expect(warn).toHaveBeenCalledTimes(1)
  })
})
