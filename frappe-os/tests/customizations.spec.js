// The Customizations view's structural projection (ADR-0015; CONTEXT.md → "Customizations view").
// Pure decision-table spec over an Action[] fixture — no resolve(), no Context, no registry: the
// view describes the contest and its conditions, never one window's live winner. Fixture covers a
// contextual override, an always-on removal, a feature-app removal and a pure-customization
// removal (the acceptance set), plus a plain App-default placement that must NOT surface.
import { describe, it, expect } from 'vitest'
import {
  customizationGroups,
  describeWhen,
  isUnexpectedRemoval,
} from '../src/actions/customizations'

// A contextual override (erpnext re-titles New window only for an erpnext window — a commandPatch
// gated by `when`), an always-on removal (no `when`), a feature-app removal (erpnext, also gated),
// a pure-customization removal (a chrome-only app), and a plain App-default placement (not a
// customization — must be filtered out).
const ACTIONS = [
  { command: 'frappe.window.new', region: 'menubar:file', sourceApp: 'erpnext',
    when: { activeApp: 'erpnext' }, commandPatch: { title: 'New ERPNext window' } },
  { command: 'frappe.window.close', region: 'menubar:file', sourceApp: 'cleaner', removed: true },
  { command: 'frappe.window.close', region: 'menubar:file', sourceApp: 'erpnext',
    when: { activeApp: 'erpnext' }, removed: true },
  { command: 'frappe.file.open', region: 'menubar:file', sourceApp: 'frappe' }, // App default, not a customization
]

describe('customizationGroups (structural projection over the declared Action set)', () => {
  const groups = customizationGroups(ACTIONS)

  it('groups by overriding app, sorted, and drops plain App-default placements', () => {
    expect(groups.map((g) => g.appId)).toEqual(['cleaner', 'erpnext'])
    // frappe's plain `frappe.file.open` (no removed/commandPatch/layer) never surfaces.
    expect(groups.some((g) => g.appId === 'frappe')).toBe(false)
  })

  it('describes a contextual override with its reason and when scope', () => {
    const erpnext = groups.find((g) => g.appId === 'erpnext')
    const override = erpnext.rows.find((r) => r.command === 'frappe.window.new')
    expect(override).toMatchObject({
      sourceApp: 'erpnext',
      region: 'menubar:file',
      command: 'frappe.window.new',
      layer: 'app',
      removed: false,
      reason: 'override',
      whenScope: 'when activeApp = erpnext',
    })
  })

  it('describes an always-on removal as a global removal', () => {
    const cleaner = groups.find((g) => g.appId === 'cleaner').rows[0]
    expect(cleaner).toMatchObject({
      sourceApp: 'cleaner',
      command: 'frappe.window.close',
      removed: true,
      reason: 'removal',
      whenScope: 'always',
    })
  })

  it('carries removed/layer/region/command on every row so a Restore is additive (ADR-0015 §1)', () => {
    for (const group of groups) {
      for (const row of group.rows) {
        expect(row).toHaveProperty('sourceApp')
        expect(row).toHaveProperty('region')
        expect(row).toHaveProperty('command')
        expect(row).toHaveProperty('layer')
        expect(row).toHaveProperty('removed')
      }
    }
  })

  it('treats a non-App layer as a customization even without removed/commandPatch', () => {
    const siteRow = customizationGroups([
      { command: 'frappe.window.new', region: 'menubar:file', sourceApp: 'site', layer: 'site' },
    ])
    expect(siteRow).toHaveLength(1)
    expect(siteRow[0].rows[0]).toMatchObject({ layer: 'site', reason: 'override' })
  })
})

describe('describeWhen (Eligibility as a human scope)', () => {
  it('renders an empty/absent when as "always"', () => {
    expect(describeWhen(undefined)).toBe('always')
    expect(describeWhen({})).toBe('always')
  })

  it('renders each key as "key = value", AND-ed', () => {
    expect(describeWhen({ activeApp: 'erpnext' })).toBe('when activeApp = erpnext')
    expect(describeWhen({ activeApp: 'erpnext', doctype: 'Sales Order' }))
      .toBe('when activeApp = erpnext, doctype = Sales Order')
  })
})

describe('isUnexpectedRemoval (feature-app removal marker, ADR-0015 §5)', () => {
  const groups = customizationGroups(ACTIONS)
  const erpnextRemoval = groups.find((g) => g.appId === 'erpnext').rows
    .find((r) => r.command === 'frappe.window.close')
  const cleanerRemoval = groups.find((g) => g.appId === 'cleaner').rows[0]
  const erpnextOverride = groups.find((g) => g.appId === 'erpnext').rows
    .find((r) => r.command === 'frappe.window.new')

  it('marks a feature app removing chrome (the surprising case)', () => {
    expect(isUnexpectedRemoval(erpnextRemoval, 'feature')).toBe(true)
  })

  it('stays quiet for a pure-customization app removing chrome (its job)', () => {
    expect(isUnexpectedRemoval(cleanerRemoval, 'pure-customization')).toBe(false)
  })

  it('never marks an override, whatever the app kind', () => {
    expect(isUnexpectedRemoval(erpnextOverride, 'feature')).toBe(false)
  })
})
