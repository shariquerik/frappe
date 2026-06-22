// ADR-0014 item 4 — the feature-vs-customization classifier and the loud-removal warning.
// Two pure units, no registry/store: `classifyApp` (a decision table over the contribution
// KINDS an app ships) and `warnFeatureAppRemovals` (the classifier-gated loud log that rides
// on top of the resolver's uniform removal shadow). The registry-wired `appKind` projection
// and the end-to-end fileMenuOptions warn/quiet integration live in actions.spec.js.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { classifyApp } from '../src/registry/classify'
import { warnFeatureAppRemovals } from '../src/actions/removals'

// A pure-customization app contributes ONLY command/action/patch kinds (and its own 'app'
// identity); a feature app ships at least one doctype(display-config)/view/applet/card. The
// classifier reads kinds alone — no per-app config (ADR-0014 item 4).
describe('classifyApp (decision table over contribution kinds)', () => {
  it('only command/action kinds → pure-customization (chrome tailoring is its whole job)', () => {
    expect(classifyApp(['command', 'action'])).toBe('pure-customization')
    expect(classifyApp(['action'])).toBe('pure-customization')
  })

  it("the app's own 'app' identity contribution is neutral (every app ships one)", () => {
    expect(classifyApp(['app', 'action'])).toBe('pure-customization')
    expect(classifyApp(['app'])).toBe('pure-customization')
  })

  it('an empty contribution set is pure-customization (ships no feature surface)', () => {
    expect(classifyApp([])).toBe('pure-customization')
  })

  it.each([
    ['display-config (a doctype)', 'display-config'],
    ['doctype-view (a view)', 'doctype-view'],
    ['dashboard-card (a card)', 'dashboard-card'],
    ['applet', 'applet'],
  ])('shipping %s → feature app', (_label, kind) => {
    expect(classifyApp(['action', kind])).toBe('feature')
    expect(classifyApp([kind])).toBe('feature')
  })

  it('a feature kind dominates regardless of how much chrome it also customizes', () => {
    expect(classifyApp(['app', 'command', 'action', 'doctype-view'])).toBe('feature')
  })
})

// The loud warning is gated by classification and rides ONLY on removal shadows: a removal by a
// FEATURE app is the surprising case (warned, attributed to app + region/command); a removal by a
// pure-customization app passes quietly here (the resolver's uniform removal log still records it).
describe('warnFeatureAppRemovals (loud only for feature-app removals)', () => {
  let warn
  beforeEach(() => { warn = vi.spyOn(console, 'warn').mockImplementation(() => {}) })
  afterEach(() => warn.mockRestore())

  const removalShadow = (app) =>
    ({ region: 'menubar:file', command: 'frappe.window.close', reason: 'removal', winner: { sourceApp: app }, loser: { sourceApp: 'frappe' } })

  it('warns loudly + attributed when a FEATURE app removes chrome', () => {
    warnFeatureAppRemovals([removalShadow('erpnext')], (app) => (app === 'erpnext' ? 'feature' : 'pure-customization'))
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('feature app'))
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('erpnext'))         // which app
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('menubar:file/frappe.window.close')) // which region/command
  })

  it('stays quiet when a PURE-CUSTOMIZATION app removes the same chrome', () => {
    warnFeatureAppRemovals([removalShadow('tweaks')], () => 'pure-customization')
    expect(warn).not.toHaveBeenCalledWith(expect.stringContaining('feature app'))
  })

  it('ignores non-removal shadows (overrides/true-ties never warn here, even from a feature app)', () => {
    const override = { region: 'menubar:file', command: 'x', reason: 'override', winner: { sourceApp: 'erpnext' }, loser: { sourceApp: 'frappe' } }
    warnFeatureAppRemovals([override], () => 'feature')
    expect(warn).not.toHaveBeenCalledWith(expect.stringContaining('feature app'))
  })
})
