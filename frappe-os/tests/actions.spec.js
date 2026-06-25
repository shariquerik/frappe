// The `actions` resolver engine (docs/design/action-model-next-steps.md, CONTEXT.md →
// Command/Action/Region/Handler/Context/Eligibility). Pure decision-table specs: eligibility
// (equality-as-data), the lexicographic (surfaceCount, windowCount) specificity vector, the
// layer→order→true-tie tiebreak chain, and attributed shadow logging. No mocks — the engine
// is pure data. The File-menu projection (fileMenuOptions) is tested against the real store.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isEligible } from '../src/actions/eligibility'
import { specificity, compareSpecificity } from '../src/actions/specificity'
import { resolve } from '../src/actions/resolve'
import { FILE_COMMANDS, invoke, registerRunHandlers } from '../src/actions/contributions'
import { contextForOS } from '../src/actions/context'
import { fileMenuOptions } from '../src/actions/menubar'
import { useOS } from '../src/desktop/index'
import { initRegistry } from '../src/registry'

describe('eligibility (when, evaluated as data)', () => {
  it('an empty when (global) matches any context', () => {
    expect(isEligible({}, { activeApp: 'crm' })).toBe(true)
    expect(isEligible(undefined, {})).toBe(true)
  })

  it('every key must equal the Context value (all keys, AND-ed)', () => {
    const ctx = { activeApp: 'crm', doctype: 'CRM Lead' }
    expect(isEligible({ activeApp: 'crm' }, ctx)).toBe(true)
    expect(isEligible({ activeApp: 'crm', doctype: 'CRM Lead' }, ctx)).toBe(true)
    expect(isEligible({ activeApp: 'erpnext' }, ctx)).toBe(false) // wrong value
    expect(isEligible({ activeApp: 'crm', doctype: 'Contact' }, ctx)).toBe(false) // one key fails
  })

  it('a key whose Context value is undefined is a non-match', () => {
    expect(isEligible({ recordName: 'CRM-LEAD-0001' }, { doctype: 'CRM Lead' })).toBe(false)
  })

  it('an unknown when key yields no-match and warns loudly', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(isEligible({ selection: 'rows' }, { activeApp: 'crm' })).toBe(false)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('selection'))
    warn.mockRestore()
  })
})

describe('specificity (lexicographic surface,window vector)', () => {
  it('counts surface keys and window keys separately', () => {
    expect(specificity({})).toEqual([0, 0])
    expect(specificity({ activeApp: 'crm' })).toEqual([0, 1])
    expect(specificity({ doctype: 'CRM Lead' })).toEqual([1, 0])
    expect(specificity({ doctype: 'CRM Lead', activeApp: 'crm', windowRole: 'settings' })).toEqual([1, 2])
  })

  it('a one-key surface predicate outranks a two-key window predicate (tier dominates count)', () => {
    expect(compareSpecificity(specificity({ doctype: 'CRM Lead' }),
      specificity({ activeApp: 'crm', windowRole: 'settings' }))).toBeGreaterThan(0)
  })

  it('within the same tier, more keys win', () => {
    expect(compareSpecificity(specificity({ activeApp: 'crm', windowRole: 'app' }),
      specificity({ activeApp: 'crm' }))).toBeGreaterThan(0)
  })

  it('equal vectors compare equal', () => {
    expect(compareSpecificity(specificity({ doctype: 'X' }), specificity({ view: 'list' }))).toBe(0)
  })
})

// Resolver decision tables. `act` builds a minimal Action; commands compete only per
// (region, command), so distinct commands/regions all render. A spy on console.warn keeps
// the loud shadow logging out of the test output and lets us assert it fired.
const act = (command, over = {}) => ({ command, region: 'menubar:file', sourceApp: 'frappe', ...over })

describe('resolve (region filter + eligibility + competition)', () => {
  let warn
  beforeEach(() => { warn = vi.spyOn(console, 'warn').mockImplementation(() => {}) })
  afterEach(() => warn.mockRestore())

  it('returns only Actions in the asked region', () => {
    const actions = [act('a'), act('b', { region: 'menubar:edit' })]
    const { items } = resolve(actions, 'menubar:file', {})
    expect(items.map((i) => i.command)).toEqual(['a'])
  })

  it('drops ineligible Actions before competition', () => {
    const actions = [act('a', { when: { activeApp: 'erpnext' } })]
    expect(resolve(actions, 'menubar:file', { activeApp: 'crm' }).items).toEqual([])
  })

  it('different commands never compete — all eligible ones render', () => {
    const actions = [act('a'), act('b')]
    expect(resolve(actions, 'menubar:file', {}).items.map((i) => i.command)).toEqual(['a', 'b'])
  })
})

describe('resolve (tiebreak chain: specificity → layer → order → true-tie)', () => {
  let warn
  beforeEach(() => { warn = vi.spyOn(console, 'warn').mockImplementation(() => {}) })
  afterEach(() => warn.mockRestore())

  it('more-specific shadows global for the same command (clean override)', () => {
    const global = act('new', { sourceApp: 'frappe' })
    const scoped = act('new', { sourceApp: 'erpnext', when: { activeApp: 'erpnext' } })
    const { items, shadows } = resolve([global, scoped], 'menubar:file', { activeApp: 'erpnext' })
    expect(items.map((i) => i.sourceApp)).toEqual(['erpnext']) // the scoped winner renders
    expect(shadows).toHaveLength(1)
    expect(shadows[0]).toMatchObject({ command: 'new', reason: 'override' })
    expect(shadows[0].loser.sourceApp).toBe('frappe')
  })

  it('layer (App < Site < User) breaks an equal-specificity tie', () => {
    const appLayer = act('x', { sourceApp: 'frappe', layer: 'app' })
    const userLayer = act('x', { sourceApp: 'frappe', layer: 'user' })
    const { items } = resolve([appLayer, userLayer], 'menubar:file', {})
    expect(items[0].layer).toBe('user')
  })

  it('explicit priority breaks an equal specificity+layer tie — higher wins (a separate axis from render order)', () => {
    const lo = act('x', { priority: 1 })
    const hi = act('x', { priority: 9 })
    expect(resolve([lo, hi], 'menubar:file', {}).items[0].priority).toBe(9)
  })

  it('render order does NOT decide a competition — equal priority is a true tie, not "higher order wins"', () => {
    const lo = act('x', { sourceApp: 'appA', order: 9 }) // renders later, but no priority edge
    const hi = act('x', { sourceApp: 'appB', order: 1 })
    const { items, shadows } = resolve([lo, hi], 'menubar:file', {})
    expect(items[0].sourceApp).toBe('appA') // first competitor wins the tie; order is render-only
    expect(shadows[0].reason).toBe('true-tie')
  })

  it('a genuine tie is logged ⚠ true-tie and resolved to the first competitor', () => {
    const first = act('x', { sourceApp: 'appA' })
    const second = act('x', { sourceApp: 'appB' })
    const { items, shadows } = resolve([first, second], 'menubar:file', {})
    expect(items[0].sourceApp).toBe('appA') // deterministic, not a coin-flip
    expect(shadows[0].reason).toBe('true-tie')
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('⚠ true-tie'))
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('appB')) // attributed
  })

  // 3+-way competition: every loser is shadowed by the FINAL winner, not by whichever Action was
  // winning mid-fold — an intermediate loser is never credited to an Action that itself then lost.
  it('attributes every shadow to the final winner in a 3-way competition', () => {
    const medium = act('x', { sourceApp: 'med', when: { activeApp: 'crm' } }) // window tier [0,1]
    const weak = act('x', { sourceApp: 'weak' }) // global [0,0]
    const strong = act('x', { sourceApp: 'strong', when: { doctype: 'CRM Lead' } }) // surface tier [1,0]
    const ctx = { activeApp: 'crm', doctype: 'CRM Lead' }
    const { items, shadows } = resolve([medium, weak, strong], 'menubar:file', ctx)
    expect(items[0].sourceApp).toBe('strong') // surface tier dominates
    expect(shadows.every((s) => s.winner.sourceApp === 'strong')).toBe(true) // never credited to 'med'
    expect(shadows.map((s) => s.loser.sourceApp).sort()).toEqual(['med', 'weak'])
    expect(shadows.every((s) => s.reason === 'override')).toBe(true) // both strictly outranked
  })

  // A winning override that declares no group/order inherits the slot's render placement from the
  // default it shadows — re-presenting a default must not relocate it across divider groups.
  it('a winning override inherits the shadowed default\'s group + order when it sets none', () => {
    const base = act('x', { sourceApp: 'frappe', group: 'a', order: 1 })
    const override = act('x', { sourceApp: 'erpnext', when: { activeApp: 'erpnext' } }) // no group/order
    const { items } = resolve([base, override], 'menubar:file', { activeApp: 'erpnext' })
    expect(items[0]).toMatchObject({ sourceApp: 'erpnext', group: 'a', order: 1 })
  })

  it('an override that DOES set group/order keeps its own (a deliberate relocation)', () => {
    const base = act('x', { sourceApp: 'frappe', group: 'a', order: 1 })
    const override = act('x', { sourceApp: 'erpnext', when: { activeApp: 'erpnext' }, group: 'z', order: 5 })
    const { items } = resolve([base, override], 'menubar:file', { activeApp: 'erpnext' })
    expect(items[0]).toMatchObject({ group: 'z', order: 5 })
  })
})

// Slice 3 (ADR-0014 removal): a removal is an ordinary Action carrying `removed:true` instead of
// a commandPatch — same (region, command) identity. It still COMPETES; when it WINS it is a
// SUPPRESSION (absent from the rendered items), logged with a new `reason:'removal'` attributed to
// the removing app. Reversibility (ADR-0014 item 2) falls out of the layer order: a higher-layer
// Action without `removed` beats an App-layer removal and the item re-renders.
describe('resolve (removal — a winning removed Action is suppressed, attributed + logged)', () => {
  let warn
  beforeEach(() => { warn = vi.spyOn(console, 'warn').mockImplementation(() => {}) })
  afterEach(() => warn.mockRestore())

  it('a winning removal suppresses the item (absent from render) and logs reason:removal', () => {
    const dflt = act('close', { sourceApp: 'frappe' }) // global [0,0]
    const removal = act('close', { sourceApp: 'erpnext', when: { activeApp: 'erpnext' }, removed: true }) // window [0,1]
    const { items, shadows } = resolve([dflt, removal], 'menubar:file', { activeApp: 'erpnext' })
    expect(items).toEqual([]) // the removal won and renders nothing — the item is gone
    expect(shadows).toHaveLength(1)
    expect(shadows[0]).toMatchObject({ command: 'close', reason: 'removal' })
    expect(shadows[0].winner.sourceApp).toBe('erpnext') // attributed to the removing app
    expect(shadows[0].loser.sourceApp).toBe('frappe') // the suppressed OS default
  })

  it('logs the removal loudly, attributed (never a silent strip)', () => {
    const dflt = act('close', { sourceApp: 'frappe' })
    const removal = act('close', { sourceApp: 'erpnext', when: { activeApp: 'erpnext' }, removed: true })
    resolve([dflt, removal], 'menubar:file', { activeApp: 'erpnext' })
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('removal'))
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('erpnext')) // attributed
    expect(warn).not.toHaveBeenCalledWith(expect.stringContaining('true-tie'))
  })

  it('the OS default re-appears where the removal is ineligible (its when does not match)', () => {
    const dflt = act('close', { sourceApp: 'frappe' })
    const removal = act('close', { sourceApp: 'erpnext', when: { activeApp: 'erpnext' }, removed: true })
    const { items } = resolve([dflt, removal], 'menubar:file', { activeApp: 'crm' })
    expect(items.map((i) => i.command)).toEqual(['close']) // removal not eligible → default renders
  })

  // Reversibility (ADR-0014 item 2): the App < Site < User order means a higher-layer Action without
  // `removed` outranks the App-layer removal — the item re-renders, the audit log showing the
  // restoration shadowing the removal. An app never has the final word over a person.
  it('a higher-layer Action without removed beats an App-layer removal — the item re-renders', () => {
    const removal = act('close', { sourceApp: 'erpnext', when: { activeApp: 'erpnext' }, layer: 'app', removed: true })
    const restore = act('close', { sourceApp: 'frappe', when: { activeApp: 'erpnext' }, layer: 'user' }) // no removed
    const { items, shadows } = resolve([removal, restore], 'menubar:file', { activeApp: 'erpnext' })
    expect(items.map((i) => i.command)).toEqual(['close']) // restored — the user layer wins
    expect(items[0].removed).toBeFalsy() // the rendered winner is the non-removal Action
    expect(shadows).toHaveLength(1)
    expect(shadows[0]).toMatchObject({ command: 'close', reason: 'override' }) // restoration shadows the removal
    expect(shadows[0].loser.removed).toBe(true) // the shadowed loser is the App-layer removal
  })
})

// The first-party `frappe` File Commands + their run Handlers, resolved through the open
// RUN_HANDLERS map (an app registers its own the same way — no server round-trip for the OS's
// own defaults). Run against the real store, reset between cases (module singleton).
describe('first-party File commands + invoke', () => {
  const os = useOS()
  const command = (id) => FILE_COMMANDS.find((c) => c.id === id)
  beforeEach(() => {
    os.state.windows = []
    os.state.geo = {}
    os.state.activeId = null
    os.state.paletteOpen = false
  })

  it('New window runs a real handler — it no longer no-ops', () => {
    invoke(command('frappe.window.new'), os)
    expect(os.state.windows).toHaveLength(1)
    expect(os.state.activeId).toBe('app:frappe')
  })

  it('Open… opens the command palette through its run handler', () => {
    invoke(command('frappe.file.open'), os)
    expect(os.state.paletteOpen).toBe(true)
  })

  it('Close window closes the active window through its run handler', () => {
    os.openApp('crm')
    invoke(command('frappe.window.close'), os)
    expect(os.state.windows).toHaveLength(0)
  })

  it('throws loudly when a run ref is not registered', () => {
    const ghost = { id: 'x', sourceApp: 'frappe', title: 'X', handler: { kind: 'run', ref: 'ghost' } }
    expect(() => invoke(ghost, os)).toThrow(/ghost/)
  })

  it('invokes an app-registered run handler — the open seam, not a first-party-only map', () => {
    let called = false
    registerRunHandlers({ 'erp-thing': () => { called = true } })
    const appCommand = { id: 'erpnext.thing', sourceApp: 'erpnext', title: 'Thing', handler: { kind: 'run', ref: 'erp-thing' } }
    invoke(appCommand, os)
    expect(called).toBe(true)
  })
})

// Context = the 6 fields derived from the single focused window (CONTEXT.md → Context). Absent
// coordinates stay undefined (so a `when` scoping on them is a non-match, never a false always).
describe('contextForOS (derive Context from the active window)', () => {
  const os = useOS()
  beforeEach(() => {
    os.state.windows = []
    os.state.geo = {}
    os.state.activeId = null
  })

  it('a bare desktop yields an empty Context', () => {
    expect(contextForOS(os)).toEqual({})
  })

  it('a list window carries activeApp, windowRole, view and doctype — but no recordName', () => {
    os.openListGlobal('ToDo')
    expect(contextForOS(os)).toEqual({ activeApp: 'frappe', windowRole: 'app', view: 'list', doctype: 'ToDo' })
  })

  it('a form window adds the recordName coordinate', () => {
    os.openRecordGlobal('CRM Lead', 'CRM-LEAD-0001')
    expect(contextForOS(os)).toMatchObject({ activeApp: 'crm', doctype: 'CRM Lead', recordName: 'CRM-LEAD-0001', view: 'form' })
  })
})

// The File-menu projection — the testable seam MenuBar.vue renders (vitest deliberately
// excludes .vue; this pure projector is the render contract, like route-map.ts / toolbar.ts).
describe('fileMenuOptions (File menu rendered from resolved Actions)', () => {
  const os = useOS()
  beforeEach(() => {
    os.state.windows = []
    os.state.geo = {}
    os.state.activeId = null
    os.state.paletteOpen = false
  })

  it('renders the File items from the resolver, in two divider groups', () => {
    const opts = fileMenuOptions(os)
    expect(opts.flatMap((g) => g.items.map((i) => i.label))).toEqual(['Open…', 'New window', 'Close window'])
    expect(opts.map((g) => g.group)).toEqual(['a', 'b'])
  })

  it('wires each item to its Command handler — New window actually opens a window', () => {
    const newWindow = fileMenuOptions(os).flatMap((g) => g.items).find((i) => i.label === 'New window')
    newWindow.onClick()
    expect(os.state.windows).toHaveLength(1)
  })
})

// Slice 2: erpnext's hook-declared override of `frappe`'s New window, folded from the server
// registry into the File menu's action data and gated `when:{activeApp:'erpnext'}`. The Action
// competes in the (menubar:file, frappe.window.new) slot; its commandPatch re-titles the item
// only when it wins. The OS default (global `when`) wins for every other app. Each win shadows
// the default — attributed to erpnext and logged as a clean `override`, never a true-tie.
describe('erpnext New window override (registry-folded, when-gated)', () => {
  const os = useOS()
  const overrideAction = {
    type: 'action', target: 'menubar:file', name: 'frappe.window.new', sourceApp: 'erpnext',
    payload: {
      command: 'frappe.window.new', region: 'menubar:file', sourceApp: 'erpnext',
      when: { activeApp: 'erpnext' }, commandPatch: { title: 'New ERPNext window' },
    },
  }
  const app = (id, name, order) => ({ type: 'app', target: '', name: id, sourceApp: id, payload: { id, name }, order })
  const boot = {
    user: 'a', csrf_token: 't', roles: [], permissions: {},
    registry: {
      schemaVersion: 1,
      contributions: [
        app('frappe', 'Frappe', 0), app('crm', 'CRM', 1), app('erpnext', 'ERPNext', 2),
        overrideAction,
      ],
    },
  }
  let warn
  beforeEach(() => {
    os.state.windows = []
    os.state.geo = {}
    os.state.activeId = null
    os.state.paletteOpen = false
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    initRegistry(boot)
  })
  afterEach(() => { warn.mockRestore(); initRegistry(null) })

  const newWindowLabel = () =>
    fileMenuOptions(os).flatMap((g) => g.items).map((i) => i.label).find((l) => l.includes('window') || l.includes('Window'))

  it('shows erpnext\'s re-titled item when an erpnext window is focused', () => {
    os.openApp('erpnext')
    expect(newWindowLabel()).toBe('New ERPNext window')
  })

  it('shows the OS default when a non-erpnext window is focused (global beats an ineligible scope)', () => {
    os.openApp('crm')
    expect(newWindowLabel()).toBe('New window')
  })

  it('logs the shadow attributed to erpnext as a clean override, not a true-tie', () => {
    os.openApp('erpnext')
    fileMenuOptions(os)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('erpnext'))
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('frappe.window.new'))
    expect(warn).not.toHaveBeenCalledWith(expect.stringContaining('true-tie'))
  })

  it('still runs the real New window handler when the override wins (patch is presentation-only)', () => {
    os.openApp('erpnext')
    const item = fileMenuOptions(os).flatMap((g) => g.items).find((i) => i.label === 'New ERPNext window')
    const newAppWindow = vi.spyOn(os, 'newAppWindow')
    item.onClick()
    expect(newAppWindow).toHaveBeenCalledWith('erpnext') // the real new-window Handler, unchanged
    newAppWindow.mockRestore()
  })

  it('keeps the re-titled item in the OS default\'s slot — still two divider groups, not three', () => {
    os.openApp('erpnext')
    const opts = fileMenuOptions(os).filter((g) => g.group !== 'p') // 'p' = the #04 Add/Remove verbs
    expect(opts.map((g) => g.group)).toEqual(['a', 'b']) // override inherits group 'a', no stray '' group
    expect(opts.find((g) => g.group === 'a').items.map((i) => i.label)).toEqual(['Open…', 'New ERPNext window'])
  })
})

// Slice 3: erpnext's hook-declared REMOVAL of `frappe`'s Close window (command
// `frappe.window.close`), folded from the server registry into the File menu and gated
// `when:{activeApp:'erpnext'}` with `removed:true`. The removal competes in the
// (menubar:file, frappe.window.close) slot; when it wins (an erpnext window focused) the item is
// suppressed — absent from the rendered menu — and the strip is attributed to erpnext and logged
// as `removal`. For every other app the OS default re-appears (the removal's `when` is ineligible).
describe('erpnext Close window removal (registry-folded, when-gated, suppressed + logged)', () => {
  const os = useOS()
  const removalAction = {
    type: 'action', target: 'menubar:file', name: 'frappe.window.close', sourceApp: 'erpnext',
    payload: {
      command: 'frappe.window.close', region: 'menubar:file', sourceApp: 'erpnext',
      when: { activeApp: 'erpnext' }, removed: true,
    },
  }
  const app = (id, name, order) => ({ type: 'app', target: '', name: id, sourceApp: id, payload: { id, name }, order })
  const boot = {
    user: 'a', csrf_token: 't', roles: [], permissions: {},
    registry: {
      schemaVersion: 1,
      contributions: [
        app('frappe', 'Frappe', 0), app('crm', 'CRM', 1), app('erpnext', 'ERPNext', 2),
        removalAction,
      ],
    },
  }
  let warn
  beforeEach(() => {
    os.state.windows = []
    os.state.geo = {}
    os.state.activeId = null
    os.state.paletteOpen = false
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    initRegistry(boot)
  })
  afterEach(() => { warn.mockRestore(); initRegistry(null) })

  // Exclude the #04 Add/Remove placement verbs (group 'p') — this suite covers the Close-window
  // removal, not the placement verbs, which now also render for a focused window.
  const labels = () => fileMenuOptions(os).filter((g) => g.group !== 'p').flatMap((g) => g.items).map((i) => i.label)

  it('suppresses Close window when an erpnext window is focused', () => {
    os.openApp('erpnext')
    expect(labels()).toEqual(['Open…', 'New window']) // Close window is gone, the others stay
  })

  it('keeps Close window when a non-erpnext window is focused (removal ineligible)', () => {
    os.openApp('crm')
    expect(labels()).toEqual(['Open…', 'New window', 'Close window'])
  })

  it('logs the removal attributed to erpnext (never a silent strip)', () => {
    os.openApp('erpnext')
    fileMenuOptions(os)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('removal'))
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('frappe.window.close'))
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('erpnext'))
  })
})

// Slice 5 (ADR-0014 item 4): the same Close-window removal is classified by the REMOVING app's
// kind and warned about accordingly through the live File-menu projection. erpnext ships a feature
// surface (here an applet), so its removal is the SURPRISING case — a loud `feature app` warning on
// top of the uniform removal log. A synthetic pure-customization app ('tweaks') that contributes
// ONLY the removal is doing its whole job — it passes quietly (no `feature app` warning). The
// classifier is derived from the folded registry alone, with nothing declared per app.
describe('feature-vs-customization removal warning (fileMenuOptions, ADR-0014 item 4)', () => {
  const os = useOS()
  const app = (id, name, order) => ({ type: 'app', target: '', name: id, sourceApp: id, payload: { id, name }, order })
  const removal = (sourceApp, when) => ({
    type: 'action', target: 'menubar:file', name: 'frappe.window.close', sourceApp,
    payload: { command: 'frappe.window.close', region: 'menubar:file', sourceApp, when, removed: true },
  })
  // What makes erpnext a FEATURE app in this fixture: it ships an applet (a feature surface), not
  // merely chrome customizations. 'tweaks' ships only the removal action → pure-customization.
  const erpnextApplet = {
    type: 'applet', target: '', name: 'erpnext.report', sourceApp: 'erpnext',
    payload: { appletId: 'erpnext.report', appId: 'erpnext', assetUrl: '/assets/erpnext/report.js', label: 'Report' },
  }
  const boot = (contributions) =>
    ({ user: 'a', csrf_token: 't', roles: [], permissions: {}, registry: { schemaVersion: 1, contributions } })
  let warn
  beforeEach(() => {
    os.state.windows = []
    os.state.geo = {}
    os.state.activeId = null
    os.state.paletteOpen = false
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterEach(() => { warn.mockRestore(); initRegistry(null) })

  it('warns loudly when a FEATURE app (erpnext, ships an applet) removes Close window', () => {
    initRegistry(boot([app('frappe', 'Frappe', 0), app('erpnext', 'ERPNext', 1), erpnextApplet, removal('erpnext', { activeApp: 'erpnext' })]))
    os.openApp('erpnext')
    fileMenuOptions(os)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('feature app'))
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('erpnext'))
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('menubar:file/frappe.window.close'))
  })

  it('stays quiet when a PURE-CUSTOMIZATION app (tweaks, only the removal) removes the same chrome', () => {
    initRegistry(boot([app('frappe', 'Frappe', 0), app('crm', 'CRM', 1), app('tweaks', 'Tweaks', 2), removal('tweaks', { activeApp: 'crm' })]))
    os.openApp('crm')
    fileMenuOptions(os)
    expect(warn).not.toHaveBeenCalledWith(expect.stringContaining('feature app'))
    // ...but the removal is still recorded by the resolver's uniform log — never silent (slice 3).
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('removal'))
  })
})

// An Action whose Command id has no contribution can't render. The File-menu projection must
// warn and skip it — never a silent drop (an app shipping os_actions but forgetting os_commands).
describe('Action referencing a missing Command (warned, not silently dropped)', () => {
  const os = useOS()
  const orphan = {
    type: 'action', target: 'menubar:file', name: 'erpnext.ghost', sourceApp: 'erpnext',
    payload: { command: 'erpnext.ghost', region: 'menubar:file', sourceApp: 'erpnext' },
  }
  const app = (id, name, order) => ({ type: 'app', target: '', name: id, sourceApp: id, payload: { id, name }, order })
  const boot = {
    user: 'a', csrf_token: 't', roles: [], permissions: {},
    registry: { schemaVersion: 1, contributions: [app('frappe', 'Frappe', 0), app('erpnext', 'ERPNext', 1), orphan] },
  }
  let warn
  beforeEach(() => {
    os.state.windows = []
    os.state.geo = {}
    os.state.activeId = null
    os.state.paletteOpen = false
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    initRegistry(boot)
  })
  afterEach(() => { warn.mockRestore(); initRegistry(null) })

  it('warns and renders only the first-party items', () => {
    const labels = fileMenuOptions(os).flatMap((g) => g.items).map((i) => i.label)
    expect(labels).toEqual(['Open…', 'New window', 'Close window']) // the orphan does not appear
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('erpnext.ghost'))
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('no such Command'))
  })
})

// Command-axis collision: an app re-declares a first-party Command id (here a hijack of
// frappe.window.new with its own title + handler). The Command axis has no resolver — the
// File-menu fold must keep the first-party verb (first-seen wins, FILE_COMMANDS lead) and
// LOG the shadow attributed to the loser, never silently last-wins overwrite the OS default
// verb's run Handler/title across every context (ADR-0014 — apps override presentation via an
// Action's commandPatch, not by re-declaring the Command).
describe('command-axis collision (an app cannot silently hijack a first-party verb)', () => {
  const os = useOS()
  const hijack = {
    type: 'command', target: '', name: 'frappe.window.new', sourceApp: 'erpnext',
    payload: { id: 'frappe.window.new', sourceApp: 'erpnext', title: 'HIJACKED', handler: { kind: 'run', ref: 'ghost' } },
  }
  const app = (id, name, order) => ({ type: 'app', target: '', name: id, sourceApp: id, payload: { id, name }, order })
  const boot = {
    user: 'a', csrf_token: 't', roles: [], permissions: {},
    registry: { schemaVersion: 1, contributions: [app('frappe', 'Frappe', 0), app('erpnext', 'ERPNext', 1), hijack] },
  }
  let warn
  beforeEach(() => {
    os.state.windows = []
    os.state.geo = {}
    os.state.activeId = null
    os.state.paletteOpen = false
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    initRegistry(boot)
  })
  afterEach(() => { warn.mockRestore(); initRegistry(null) })

  it('keeps the first-party verb — title and run Handler are not overwritten', () => {
    const item = fileMenuOptions(os).flatMap((g) => g.items).find((i) => i.label === 'New window')
    expect(item).toBeDefined() // not re-titled to "HIJACKED"
    item.onClick() // the first-party run Handler, not the colliding "ghost" ref (which would throw)
    expect(os.state.windows).toHaveLength(1)
  })

  it('logs the collision attributed to both apps (never a silent overwrite)', () => {
    fileMenuOptions(os)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('command-collision'))
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('frappe.window.new'))
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('erpnext')) // the shadowed loser, attributed
  })
})
