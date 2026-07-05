// The `actions` resolver engine (docs/design/action-model-next-steps.md, CONTEXT.md →
// Command/Action/Region/Handler/Context/Eligibility). Pure decision-table specs: eligibility
// (equality-as-data), the lexicographic (surfaceCount, windowCount) specificity vector, the
// layer→order→true-tie tiebreak chain, and attributed shadow logging. No mocks — the engine
// is pure data. The File-menu projection (fileMenuOptions) is tested against the real store.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isEligible } from '../src/actions/eligibility'
import { specificity, compareSpecificity } from '../src/actions/specificity'
import { scopeWhen, effectiveWhen } from '../src/actions/scope'
import { resolve } from '../src/actions/resolve'
import { invoke, registerRunHandlers } from '../src/actions/contributions'
import { MENUBAR_COMMANDS, MENUBAR_ACTIONS } from '../src/actions/menu-contributions'
import {
  canonicalBinding, eventBinding, formatShortcut, isTextEntry, shortcutIndex, pickShortcut,
} from '../src/actions/shortcuts'
import { contextForOS } from '../src/actions/context'
import { fileMenuOptions, menuOptions, registerMenuSelection } from '../src/actions/menubar'
import { suppressedToggleCommands, THEME_COMMAND, THEME_SUBMENU } from '../src/actions/menu-contributions'
import { desktopContextItems, dockContextOptions } from '../src/actions/context-menus'
import { suppressedDockHidingCommands, selectedDockPositionCommands } from '../src/actions/context-menu-contributions'
import { toolbarItems } from '../src/actions/toolbar'
import {
  REGIONS, regionById, regionRenders, MENUBAR_REGIONS,
  SYSTEM_REGION, APP_REGION, FILE_REGION, EDIT_REGION, VIEW_REGION, WINDOW_REGION, HELP_REGION,
  LIST_TOOLBAR, LIST_SELECTION, FORM_TOOLBAR, DESKTOP_CONTEXT_REGION, DOCK_CONTEXT_REGION,
  appMenuRegion, parseAppMenuRegion,
} from '../src/actions/regions'
import { isValidKind, kindNamespace, warnForeignKind, ROWS, CORE_KINDS } from '../src/actions/kinds'
import { useOS } from '../src/desktop/index'
import { listSurface } from '../src/surface'
import { initRegistry, useRegistry, registerScopedContributions } from '../src/registry'
import { bootWith as osBoot } from './fixtures/os-boot'

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
    expect(isEligible({ workspace: 'sales' }, { activeApp: 'crm' })).toBe(false)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('workspace'))
    warn.mockRestore()
  })

  it('selection is a known surface key — it matches on presence, no longer an unknown-key warn', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(isEligible({ selection: 'rows' }, { selection: 'rows', doctype: 'CRM Lead' })).toBe(true)
    expect(isEligible({ selection: 'rows' }, { doctype: 'CRM Lead' })).toBe(false) // no selection
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })

  it("the presence marker '*' matches any defined value and non-matches an absent key (ADR-0038)", () => {
    expect(isEligible({ selection: '*' }, { selection: 'rows' })).toBe(true)
    expect(isEligible({ selection: '*' }, { selection: 'message' })).toBe(true) // any value, not just rows
    expect(isEligible({ selection: '*' }, { doctype: 'ToDo' })).toBe(false) // key absent → non-match
  })

  it('focusKind is a known focus-tier key — gates a composer menu on keyboard focus', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(isEligible({ focusKind: 'composer' }, { focusKind: 'composer', doctype: 'Raven Message' })).toBe(true)
    expect(isEligible({ focusKind: 'composer' }, { focusKind: 'message' })).toBe(false) // wrong widget
    expect(isEligible({ focusKind: 'composer' }, { doctype: 'Raven Message' })).toBe(false) // nothing focused
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })
})

// The KIND vocabulary (ADR-0038): a closed OS core plus an app-namespaced escape, governed like
// Regions. Publishers validate a kind is well-formed; a gater on ANOTHER app's namespaced kind warns.
describe('kinds (closed core + namespaced escape + foreign-gate warning)', () => {
  it('the core is the surveyed set, exported as constants', () => {
    expect(CORE_KINDS).toEqual(['rows', 'record', 'composer', 'message', 'card'])
    expect(ROWS).toBe('rows')
  })

  it('a core kind and a well-formed <app>.<kind> validate; malformed values do not', () => {
    expect(isValidKind('rows')).toBe(true)
    expect(isValidKind('raven.voice-note')).toBe(true) // app-namespaced escape passes
    expect(isValidKind('voice-note')).toBe(false) // unknown bare kind is not core
    expect(isValidKind('.x')).toBe(false) // no app half
    expect(isValidKind('raven.')).toBe(false) // no kind half
    expect(isValidKind('')).toBe(false)
  })

  it('kindNamespace reads the app prefix, null for a core kind', () => {
    expect(kindNamespace('raven.voice-note')).toBe('raven')
    expect(kindNamespace('rows')).toBe(null)
  })

  it('an Action gating on another app\'s namespaced kind warns loudly; its own does not', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    warnForeignKind({ command: 'c', region: 'r', sourceApp: 'crm', when: { selection: 'raven.voice-note' } })
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('raven'))
    warn.mockClear()
    warnForeignKind({ command: 'c', region: 'r', sourceApp: 'raven', when: { focusKind: 'raven.voice-note' } })
    warnForeignKind({ command: 'c', region: 'r', sourceApp: 'crm', when: { selection: 'rows' } }) // core kind
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })

  it('resolve fires the foreign-kind warning over the region\'s Actions', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const foreign = { command: 'c', region: 'menubar:file', sourceApp: 'crm', when: { selection: 'raven.message' } }
    resolve([foreign], 'menubar:file', {})
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('foreign kind'))
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

  it('selection counts in the surface tier (a selection predicate ranks above the window tier)', () => {
    expect(specificity({ selection: 'rows' })).toEqual([1, 0])
    expect(compareSpecificity(specificity({ selection: 'rows' }), specificity({ activeApp: 'crm' }))).toBeGreaterThan(0)
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

  // Finding #8: the winner inherits the slot from the default it SHADOWS — the strongest loser it
  // overrides — not from whichever placement-bearing competitor happens to be registered first. A
  // weak global competitor with its own placement, registered first, must NOT hijack the slot.
  it('inherits from the strongest shadowed default, not the first placement-bearing competitor', () => {
    const weak = act('x', { sourceApp: 'noise', group: 'z', order: 9 }) // global tier, registered FIRST
    const shadowed = act('x', { sourceApp: 'frappe', group: 'a', order: 1, when: { activeApp: 'crm' } }) // window tier
    const winner = act('x', { sourceApp: 'erpnext', when: { doctype: 'CRM Lead' } }) // surface tier, no placement
    const { items } = resolve([weak, shadowed, winner], 'menubar:file', { activeApp: 'crm', doctype: 'CRM Lead' })
    expect(items[0]).toMatchObject({ sourceApp: 'erpnext', group: 'a', order: 1 })
  })

  // A re-title chain (App < Site < User, all no-placement above the default): the placement lives on
  // the app default lower down the stack, so the winner must chain past the placement-less runner-up
  // to the strongest loser that actually declares a slot.
  it('chains placement past a placement-less runner-up to the app default that carries the slot', () => {
    const appDefault = act('x', { sourceApp: 'frappe', layer: 'app', group: 'a', order: 1 })
    const siteRetitle = act('x', { sourceApp: 'site', layer: 'site' }) // outranks app default, no placement
    const userWinner = act('x', { sourceApp: 'user', layer: 'user' }) // wins, no placement
    const { items } = resolve([appDefault, siteRetitle, userWinner], 'menubar:file', {})
    expect(items[0]).toMatchObject({ sourceApp: 'user', group: 'a', order: 1 })
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
  const command = (id) => MENUBAR_COMMANDS.find((c) => c.id === id)
  beforeEach(() => {
    os.state.windows = []
    os.state.geo = {}
    os.state.activeId = null
    os.state.paletteOpen = false
  })

  it('New window on the bare desktop opens the Finder, not the frappe hub', () => {
    invoke(command('frappe.window.new'), os)
    expect(os.state.windows).toHaveLength(1)
    expect(os.state.activeId).toBe('finder')
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

// ADR-0037 — a run Handler receives an Invocation (context + selection snapshot, args, os), NOT the
// bare store. invoke SNAPSHOTS the same contextForOS projection that gated the item plus the live
// selection at click time, so the handler acts on what the user saw and never re-derives focus.
describe('invoke builds the Invocation (ADR-0037 contract)', () => {
  const os = useOS()
  const cmd = (ref, args) => ({ id: `t.${ref}`, sourceApp: 'test', title: ref, handler: { kind: 'run', ref, ...(args !== undefined ? { args } : {}) } })
  beforeEach(() => {
    os.state.windows = []
    os.state.geo = {}
    os.state.selection = {}
    os.state.focusKind = {}
    os.state.activeId = null
  })

  it('passes the context + selection snapshot the item was gated on (not the bare store)', () => {
    os.openListGlobal('ToDo')
    os.setSelection(os.state.activeId, 'rows', ['TODO-0001', 'TODO-0002'])
    let seen
    registerRunHandlers({ 'capture-inv': (invocation) => { seen = invocation } })
    invoke(cmd('capture-inv'), os)
    expect(seen.context).toEqual(contextForOS(os)) // the frozen eligibility snapshot
    expect(seen.context.selection).toBe('rows')    // presence marker, not the ids
    expect(seen.selection).toEqual(['TODO-0001', 'TODO-0002']) // the VALUES travel here
    expect(seen.os).toBe(os) // the chrome escape hatch
  })

  it('snapshots at click — a selection change AFTER invoke does not mutate the captured snapshot', () => {
    os.openListGlobal('ToDo')
    os.setSelection(os.state.activeId, 'rows', ['TODO-0001'])
    let seen
    registerRunHandlers({ 'capture-frozen': (invocation) => { seen = invocation } })
    invoke(cmd('capture-frozen'), os)
    os.setSelection(os.state.activeId, 'rows', ['TODO-0009', 'TODO-0010']) // focus moves after the click
    expect(seen.selection).toEqual(['TODO-0001']) // still what the user saw, not the later state
  })

  it('reaches one handler with the args declared on each placement (one ref, two placements)', () => {
    const sides = []
    registerRunHandlers({ 'set-position': ({ args }) => { sides.push(args.side) } })
    invoke(cmd('set-position', { side: 'left' }), os)
    invoke(cmd('set-position', { side: 'right' }), os)
    expect(sides).toEqual(['left', 'right']) // the same ref serves many placements via args
  })

  it('leaves args undefined when the Handler declares none', () => {
    let seen
    registerRunHandlers({ 'no-args': (invocation) => { seen = invocation } })
    invoke(cmd('no-args'), os)
    expect(seen.args).toBeUndefined()
  })
})

// Context = the 6 fields derived from the single focused window (CONTEXT.md → Context). Absent
// coordinates stay undefined (so a `when` scoping on them is a non-match, never a false always).
describe('contextForOS (derive Context from the active window)', () => {
  const os = useOS()
  beforeEach(() => {
    initRegistry(osBoot()) // ownership rides boot workspaces now (CRM Lead→crm; AppDef.modules retired)
    os.state.windows = []
    os.state.geo = {}
    os.state.selection = {}
    os.state.focusKind = {}
    os.state.activeId = null
  })
  afterEach(() => initRegistry(null))

  it('a bare desktop yields an empty Context', () => {
    expect(contextForOS(os)).toEqual({})
  })

  it('a list window carries activeApp, windowRole, view, doctype and the derived workspace — but no recordName', () => {
    os.openListGlobal('ToDo') // ToDo lives in frappe's `core` workspace → the window is scoped to it
    expect(contextForOS(os)).toEqual({ activeApp: 'frappe', windowRole: 'app', view: 'list', doctype: 'ToDo', workspace: 'core' })
  })

  it('a form window adds the recordName coordinate', () => {
    os.openRecordGlobal('CRM Lead', 'CRM-LEAD-0001')
    expect(contextForOS(os)).toMatchObject({ activeApp: 'crm', doctype: 'CRM Lead', recordName: 'CRM-LEAD-0001', view: 'form' })
  })

  it('carries no selection marker while the front list has no selection', () => {
    os.openListGlobal('ToDo')
    expect(contextForOS(os).selection).toBeUndefined()
  })

  it('sets the selection marker (presence, not value) when the front list has selected rows', () => {
    os.openListGlobal('ToDo')
    os.setSelection(os.state.activeId, 'rows', ['TODO-0001', 'TODO-0002'])
    expect(contextForOS(os).selection).toBe('rows')
  })

  it('drops the selection marker again once the selection is cleared', () => {
    os.openListGlobal('ToDo')
    os.setSelection(os.state.activeId, 'rows', ['TODO-0001'])
    os.setSelection(os.state.activeId, 'rows', []) // deselect all → sparse entry removed
    expect(contextForOS(os).selection).toBeUndefined()
  })

  it("publishes the window's workspace when the window is scoped to one (ADR-0042)", () => {
    os.openListGlobal('CRM Lead', undefined, 'sales') // opens the app:crm/sales window
    expect(contextForOS(os).workspace).toBe('sales')
  })

  it('carries no workspace for a plain app window', () => {
    os.openApp('frappe') // the multi-workspace hub opens the plain app:frappe window (no workspace on its id)
    expect(contextForOS(os).workspace).toBeUndefined()
  })

  it('carries no focusKind until a widget publishes one', () => {
    os.openListGlobal('ToDo')
    expect(contextForOS(os).focusKind).toBeUndefined()
  })

  it('publishes the focused widget kind into Context.focusKind (ADR-0038)', () => {
    os.openListGlobal('ToDo')
    os.publishFocus(os.state.activeId, 'composer')
    expect(contextForOS(os).focusKind).toBe('composer')
  })

  it('a form record publishes docstatus + status from the loaded record (slice 04)', () => {
    os.openRecordGlobal('Sales Order', 'SO-0001')
    os.docFor('Sales Order', 'SO-0001').data = { name: 'SO-0001', docstatus: 1, status: 'To Deliver' }
    expect(contextForOS(os)).toMatchObject({ docstatus: '1', status: 'To Deliver' })
  })

  it('stringifies docstatus so equality when can pin the draft/submitted/cancelled state', () => {
    os.openRecordGlobal('Sales Order', 'SO-0002')
    os.docFor('Sales Order', 'SO-0002').data = { name: 'SO-0002', docstatus: 0 }
    expect(contextForOS(os).docstatus).toBe('0')
  })

  it('carries no record-state markers until the front record is loaded', () => {
    os.openRecordGlobal('Sales Order', 'SO-0003') // nothing seeded in the record cache
    const ctx = contextForOS(os)
    expect(ctx.docstatus).toBeUndefined()
    expect(ctx.status).toBeUndefined()
  })

  it('a list surface leaves both record-state fields absent (slice 04)', () => {
    os.openListGlobal('Sales Order')
    const ctx = contextForOS(os)
    expect(ctx.docstatus).toBeUndefined()
    expect(ctx.status).toBeUndefined()
  })

  it('gates a submitted-only verb: {docstatus:1} matches a submitted record, not a draft (slice 04)', () => {
    os.openRecordGlobal('Sales Order', 'SO-0004')
    os.docFor('Sales Order', 'SO-0004').data = { name: 'SO-0004', docstatus: 1, status: 'To Deliver' }
    expect(isEligible({ doctype: 'Sales Order', docstatus: '1' }, contextForOS(os))).toBe(true)
    os.docFor('Sales Order', 'SO-0004').data = { name: 'SO-0004', docstatus: 0, status: 'Draft' }
    expect(isEligible({ doctype: 'Sales Order', docstatus: '1' }, contextForOS(os))).toBe(false)
  })
})

// The focus tier's keyboard-focus facet (ADR-0038): published through publishFocus, persist-until-
// replaced (never cleared on raw DOM blur — the menu bar steals focus), cleared only on surface swap
// and window close. Orthogonal to the selection facet: a message stays selected while the composer
// gains focus, so BOTH markers can be live at once.
describe('focus kind (publishFocus — persist-until-replaced, cleared on swap/close)', () => {
  const os = useOS()
  const app = (id, name, order) => ({ type: 'app', target: '', name: id, sourceApp: id, payload: { id, name }, order })
  const boot = { user: 'a', csrf_token: 't', roles: [], permissions: {}, registry: { schemaVersion: 1, contributions: [app('frappe', 'Frappe', 0)] } }
  let fetchMock
  beforeEach(() => {
    os.state.windows = []; os.state.geo = {}; os.state.selection = {}; os.state.focusKind = {}; os.state.activeId = null
    fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ message: [] }) }))
    vi.stubGlobal('fetch', fetchMock)
    initRegistry(boot)
  })
  afterEach(() => { vi.unstubAllGlobals(); initRegistry(null) })

  it('a later publish replaces the kind; there is no clear-on-blur seam', () => {
    os.openListGlobal('ToDo')
    const winId = os.state.activeId
    os.publishFocus(winId, 'composer')
    expect(os.focusedKind()).toBe('composer')
    os.publishFocus(winId, 'message') // focus moves to another widget
    expect(os.focusedKind()).toBe('message')
  })

  it('selection and focusKind are orthogonal — both stay live together', () => {
    os.openListGlobal('ToDo')
    const winId = os.state.activeId
    os.setSelection(winId, 'message', ['MSG-1'])
    os.publishFocus(winId, 'composer') // focus the composer AFTER selecting a message
    const ctx = contextForOS(os)
    expect(ctx.selection).toBe('message') // the selection survives the focus move
    expect(ctx.focusKind).toBe('composer')
  })

  it('a surface swap clears the focus kind (it belonged to the old surface)', () => {
    os.openListGlobal('ToDo')
    const winId = os.state.activeId
    os.publishFocus(winId, 'composer')
    os.openListGlobal('User') // same window → navigateWindow swaps the surface
    expect(os.focusedKind()).toBeUndefined()
  })

  it('closing a window drops its focus kind so a reused id starts clean', () => {
    os.openListGlobal('ToDo')
    const winId = os.state.activeId
    os.publishFocus(winId, 'composer')
    os.closeWin(winId)
    expect(os.state.focusKind[winId]).toBeUndefined()
  })

  it('refuses a malformed kind with a loud warn — the focus tier stays clean', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    os.openListGlobal('ToDo')
    const winId = os.state.activeId
    os.publishFocus(winId, 'gibberish') // not core, not <app>.<kind>
    expect(os.focusedKind()).toBeUndefined()
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('invalid focus kind'))
    os.publishFocus(winId, 'raven.voice-note') // the namespaced escape is accepted
    expect(os.focusedKind()).toBe('raven.voice-note')
    warn.mockRestore()
  })
})

// The File menu is EARNED, and the OS owns nothing in it (ADR-0039 rule 2: File is a middle menu
// apps populate — the OS's window/pin verbs moved to the Window menu). So fileMenuOptions resolves
// to nothing until an app contributes; MenuBar.vue then never renders a File title.
describe('fileMenuOptions (File is app-earned — the OS contributes nothing)', () => {
  const os = useOS()
  beforeEach(() => {
    os.state.windows = []
    os.state.geo = {}
    os.state.activeId = null
    os.state.paletteOpen = false
  })

  it('resolves to nothing on a bare desktop', () => {
    expect(fileMenuOptions(os)).toEqual([])
  })

  it('still resolves to nothing with an app window focused — no first-party File items remain', () => {
    os.openApp('crm')
    expect(fileMenuOptions(os)).toEqual([])
  })
})

// Slice 2: erpnext's hook-declared override of `frappe`'s New window, folded from the server
// registry into the Window menu's action data and gated `when:{activeApp:'erpnext'}` (New/Close
// window are window verbs — they live in menubar:window now, not File). The Action competes in the
// (menubar:window, frappe.window.new) slot; its commandPatch re-titles the item only when it wins.
// The OS default (global `when`) wins for every other app. Each win shadows the default —
// attributed to erpnext and logged as a clean `override`, never a true-tie.
describe('erpnext New window override (registry-folded, when-gated)', () => {
  const os = useOS()
  const overrideAction = {
    type: 'action', target: 'menubar:window', name: 'frappe.window.new', sourceApp: 'erpnext',
    payload: {
      command: 'frappe.window.new', region: 'menubar:window', sourceApp: 'erpnext',
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
    menuOptions(WINDOW_REGION, os).flatMap((g) => g.items).map((i) => i.label).find((l) => l.startsWith('New'))

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
    menuOptions(WINDOW_REGION, os)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('erpnext'))
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('frappe.window.new'))
    expect(warn).not.toHaveBeenCalledWith(expect.stringContaining('true-tie'))
  })

  it('still runs the real New window handler when the override wins (patch is presentation-only)', () => {
    os.openApp('erpnext')
    const item = menuOptions(WINDOW_REGION, os).flatMap((g) => g.items).find((i) => i.label === 'New ERPNext window')
    const newAppWindow = vi.spyOn(os, 'newAppWindow')
    item.onClick()
    expect(newAppWindow).toHaveBeenCalledWith('erpnext') // the real new-window Handler, unchanged
    newAppWindow.mockRestore()
  })

  it('keeps the re-titled item in the OS default\'s slot — Window\'s divider groups are unchanged', () => {
    os.openApp('erpnext')
    const opts = menuOptions(WINDOW_REGION, os)
    // a (new/close) · b (minimize/zoom) · c (pin verbs) · d (split); override inherits group 'a'.
    expect(opts.map((g) => g.group)).toEqual(['a', 'b', 'c', 'd'])
    expect(opts.find((g) => g.group === 'a').items.map((i) => i.label)).toEqual(['New ERPNext window', 'Close window'])
  })
})

// Slice 3: erpnext's hook-declared REMOVAL of `frappe`'s Close window (command
// `frappe.window.close`), folded from the server registry into the Window menu and gated
// `when:{activeApp:'erpnext'}` with `removed:true`. The removal competes in the
// (menubar:window, frappe.window.close) slot; when it wins (an erpnext window focused) the item is
// suppressed — absent from the rendered menu — and the strip is attributed to erpnext and logged
// as `removal`. For every other app the OS default re-appears (the removal's `when` is ineligible).
describe('erpnext Close window removal (registry-folded, when-gated, suppressed + logged)', () => {
  const os = useOS()
  const removalAction = {
    type: 'action', target: 'menubar:window', name: 'frappe.window.close', sourceApp: 'erpnext',
    payload: {
      command: 'frappe.window.close', region: 'menubar:window', sourceApp: 'erpnext',
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

  // Exclude the pin group ('c', the #04 Add/Remove verbs) — this suite covers the Close-window
  // removal, not the pin verbs, which also render in Window for a focused app window.
  const labels = () => menuOptions(WINDOW_REGION, os).filter((g) => g.group !== 'c').flatMap((g) => g.items).map((i) => i.label)

  it('suppresses Close window when an erpnext window is focused', () => {
    os.openApp('erpnext')
    // Close window is gone; the other Window verbs stay.
    expect(labels()).toEqual(['New window', 'Minimize', 'Zoom', 'Enter split view', 'Exit split view'])
  })

  it('keeps Close window when a non-erpnext window is focused (removal ineligible)', () => {
    os.openApp('crm')
    expect(labels()).toEqual(['New window', 'Close window', 'Minimize', 'Zoom', 'Enter split view', 'Exit split view'])
  })

  it('logs the removal attributed to erpnext (never a silent strip)', () => {
    os.openApp('erpnext')
    menuOptions(WINDOW_REGION, os)
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
    type: 'action', target: 'menubar:window', name: 'frappe.window.close', sourceApp,
    payload: { command: 'frappe.window.close', region: 'menubar:window', sourceApp, when, removed: true },
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
    menuOptions(WINDOW_REGION, os)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('feature app'))
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('erpnext'))
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('menubar:window/frappe.window.close'))
  })

  it('stays quiet when a PURE-CUSTOMIZATION app (tweaks, only the removal) removes the same chrome', () => {
    initRegistry(boot([app('frappe', 'Frappe', 0), app('crm', 'CRM', 1), app('tweaks', 'Tweaks', 2), removal('tweaks', { activeApp: 'crm' })]))
    os.openApp('crm')
    menuOptions(WINDOW_REGION, os)
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

  it('warns and skips the orphan — File resolves to nothing (its only Action has no Command)', () => {
    const labels = fileMenuOptions(os).flatMap((g) => g.items).map((i) => i.label)
    expect(labels).toEqual([]) // the orphan does not appear; the OS owns no File items
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('erpnext.ghost'))
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('no such Command'))
  })
})

// ADR-0032 slice 01 — the Scope axis. A Scope (OS/App/Doctype/View) auto-supplies the `when` the
// author would otherwise hand-write (scopeWhen/effectiveWhen), reusing the existing Context keys
// (activeApp/doctype/view) — no parallel activeDoctype/activeView keys. Because View's auto-`when`
// is a two-key surface predicate and Doctype's a one-key one, the EXISTING specificity vector ranks
// View > Doctype > App > OS, so carry-forward override falls out of the same contest — no new axis.
describe('scopeWhen / effectiveWhen (Scope auto-supplies Eligibility)', () => {
  const scoped = (scope, when) => ({ command: 'x', region: 'r', sourceApp: 'a', scope, when })

  it('OS scope (or no binding) is global — an empty when', () => {
    expect(scopeWhen(scoped(undefined))).toEqual({})
    expect(scopeWhen(scoped({ tier: 'os' }))).toEqual({})
  })

  it('App scope auto-derives { activeApp } from the app it is co-located in', () => {
    expect(scopeWhen(scoped({ tier: 'app', app: 'crm' }))).toEqual({ activeApp: 'crm' })
  })

  it('Doctype scope auto-derives { doctype } — the front doctype, any view', () => {
    expect(scopeWhen(scoped({ tier: 'doctype', app: 'crm', doctype: 'CRM Lead' }))).toEqual({ doctype: 'CRM Lead' })
  })

  it('View scope auto-derives { doctype, view } — the front doctype AND view', () => {
    expect(scopeWhen(scoped({ tier: 'view', doctype: 'CRM Lead', view: 'list' })))
      .toEqual({ doctype: 'CRM Lead', view: 'list' })
  })

  it('effectiveWhen composes the auto-when with a hand-written cross-surface when (both AND-ed)', () => {
    const a = scoped({ tier: 'doctype', doctype: 'CRM Lead' }, { windowRole: 'settings' })
    expect(effectiveWhen(a)).toEqual({ doctype: 'CRM Lead', windowRole: 'settings' })
  })

  it('a hand-written key wins a conflict with the auto-derived coordinate (explicit author override)', () => {
    const a = scoped({ tier: 'doctype', doctype: 'CRM Lead' }, { doctype: 'Contact' })
    expect(effectiveWhen(a)).toEqual({ doctype: 'Contact' })
  })

  it('the auto-derived when carries the right specificity (View > Doctype > App > OS)', () => {
    const os = scopeWhen(scoped({ tier: 'os' }))
    const app = scopeWhen(scoped({ tier: 'app', app: 'crm' }))
    const dt = scopeWhen(scoped({ tier: 'doctype', doctype: 'CRM Lead' }))
    const view = scopeWhen(scoped({ tier: 'view', doctype: 'CRM Lead', view: 'list' }))
    expect(compareSpecificity(specificity(app), specificity(os))).toBeGreaterThan(0)
    expect(compareSpecificity(specificity(dt), specificity(app))).toBeGreaterThan(0) // surface tier dominates
    expect(compareSpecificity(specificity(view), specificity(dt))).toBeGreaterThan(0)
  })
})

// Carry-forward through the resolver: OS ⊕ App ⊕ Doctype ⊕ View composed live from the front-most
// stack, filtered by the auto-derived Eligibility. `sc` places a scoped Action with no hand-written
// `when` — the common case the author never has to spell out.
describe('resolve (Scope → auto-Eligibility + carry-forward)', () => {
  let warn
  beforeEach(() => { warn = vi.spyOn(console, 'warn').mockImplementation(() => {}) })
  afterEach(() => warn.mockRestore())

  const sc = (command, scope, over = {}) => ({ command, region: 'menubar:file', sourceApp: 'frappe', scope, ...over })

  it('a Doctype-scoped Action is eligible only when that doctype is front — no hand-written when', () => {
    const a = sc('a', { tier: 'doctype', doctype: 'CRM Lead' })
    expect(resolve([a], 'menubar:file', { doctype: 'CRM Lead' }).items.map((i) => i.command)).toEqual(['a'])
    expect(resolve([a], 'menubar:file', { doctype: 'Contact' }).items).toEqual([]) // wrong doctype
    expect(resolve([a], 'menubar:file', {}).items).toEqual([]) // no front doctype
  })

  it('a View-scoped Action needs both the doctype and the view front', () => {
    const a = sc('a', { tier: 'view', doctype: 'CRM Lead', view: 'list' })
    expect(resolve([a], 'menubar:file', { doctype: 'CRM Lead', view: 'list' }).items).toHaveLength(1)
    expect(resolve([a], 'menubar:file', { doctype: 'CRM Lead', view: 'form' }).items).toEqual([]) // wrong view
  })

  it('composes OS ⊕ App ⊕ Doctype ⊕ View additively — broader scopes carry forward into the front stack', () => {
    const osAct = sc('os', { tier: 'os' })
    const appAct = sc('app', { tier: 'app', app: 'crm' })
    const dtAct = sc('dt', { tier: 'doctype', doctype: 'CRM Lead' })
    const viewAct = sc('view', { tier: 'view', doctype: 'CRM Lead', view: 'list' })
    const ctx = { activeApp: 'crm', doctype: 'CRM Lead', view: 'list' }
    const { items } = resolve([osAct, appAct, dtAct, viewAct], 'menubar:file', ctx)
    expect(items.map((i) => i.command).sort()).toEqual(['app', 'dt', 'os', 'view']) // all four carry forward
  })

  it('swapping focus to another app drops the surface-specific scopes but keeps OS (carry-forward)', () => {
    const osAct = sc('os', { tier: 'os' })
    const dtAct = sc('dt', { tier: 'doctype', doctype: 'CRM Lead' })
    const { items } = resolve([osAct, dtAct], 'menubar:file', { activeApp: 'erpnext', doctype: 'Sales Invoice' })
    expect(items.map((i) => i.command)).toEqual(['os']) // the CRM Lead doctype scope is not front
  })

  it('a narrower Scope OVERRIDES a broader one for the same command (specificity carry-forward)', () => {
    const osDefault = sc('title', { tier: 'os' }, { sourceApp: 'frappe' })
    const dtOverride = sc('title', { tier: 'doctype', doctype: 'CRM Lead' }, { sourceApp: 'crm' })
    const { items, shadows } = resolve([osDefault, dtOverride], 'menubar:file', { doctype: 'CRM Lead' })
    expect(items.map((i) => i.sourceApp)).toEqual(['crm']) // the doctype scope wins
    expect(shadows[0]).toMatchObject({ command: 'title', reason: 'override' })
    expect(shadows[0].loser.sourceApp).toBe('frappe')
  })

  it('a narrower Scope can REMOVE an inherited Action (carry-forward removal, ADR-0014)', () => {
    const osDefault = sc('title', { tier: 'os' }, { sourceApp: 'frappe' })
    const dtRemoval = sc('title', { tier: 'doctype', doctype: 'CRM Lead' }, { sourceApp: 'crm', removed: true })
    // Front doctype matches → the doctype-scoped removal wins and suppresses the inherited OS item.
    expect(resolve([osDefault, dtRemoval], 'menubar:file', { doctype: 'CRM Lead' }).items).toEqual([])
    // A different doctype is front → the removal is ineligible, the OS default carries forward.
    expect(resolve([osDefault, dtRemoval], 'menubar:file', { doctype: 'Contact' }).items.map((i) => i.command))
      .toEqual(['title'])
  })
})

// Delivery-by-scope (ADR-0032): the Doctype/View half. A doctype's scoped Action/Command
// contributions arrive on live meta (get_doctype_meta) and are folded into the registry by
// registerScopedContributions, keyed by doctype for idempotent replace. useRegistry().actions()/
// commands() then expose boot ⊕ live so the projector composes them with the front stack; the
// Scope auto-`when` gates a slice out when its doctype isn't front (no removal step needed).
describe('registerScopedContributions (live-meta Doctype/View overlay)', () => {
  let warn
  beforeEach(() => { warn = vi.spyOn(console, 'warn').mockImplementation(() => {}); initRegistry(null) })
  afterEach(() => { warn.mockRestore(); initRegistry(null) })

  const liveAction = (command, scope, region = 'list:selection') =>
    ({ type: 'action', target: region, name: command, sourceApp: 'erpnext', order: 0,
       payload: { command, region, sourceApp: 'erpnext', scope } })
  const liveCommand = (id) =>
    ({ type: 'command', target: '', name: id, sourceApp: 'erpnext', order: 0,
       payload: { id, sourceApp: 'erpnext', title: id, handler: { kind: 'run', ref: id } } })

  it('folds live actions + commands into useRegistry() with a fresh array identity', () => {
    const before = useRegistry().actions()
    registerScopedContributions('Sales Order', [
      liveAction('so.set-open', { tier: 'view', doctype: 'Sales Order', view: 'list' }),
      liveCommand('so.set-open'),
    ])
    const after = useRegistry().actions()
    expect(after).not.toBe(before) // identity changed → project.ts merged() refolds
    expect(after.some((a) => a.command === 'so.set-open')).toBe(true)
    expect(useRegistry().commands().some((c) => c.id === 'so.set-open')).toBe(true)
  })

  it('replaces a doctype slice idempotently — re-opening never duplicates', () => {
    const contribs = [liveAction('so.set-open', { tier: 'doctype', doctype: 'Sales Order' })]
    registerScopedContributions('Sales Order', contribs)
    registerScopedContributions('Sales Order', contribs)
    expect(useRegistry().actions().filter((a) => a.command === 'so.set-open')).toHaveLength(1)
  })

  it('a doctype shipping no scoped contributions leaves identity untouched (no churn)', () => {
    const before = useRegistry().actions()
    registerScopedContributions('ToDo', [])
    expect(useRegistry().actions()).toBe(before)
  })

  it('a View-scoped live Action is eligible only when its doctype AND view are front', () => {
    registerScopedContributions('Sales Order', [
      liveAction('so.set-open', { tier: 'view', doctype: 'Sales Order', view: 'list' }),
      liveCommand('so.set-open'),
    ])
    const actions = useRegistry().actions()
    const front = resolve(actions, 'list:selection', { doctype: 'Sales Order', view: 'list' })
    const otherDoctype = resolve(actions, 'list:selection', { doctype: 'ToDo', view: 'list' })
    const otherView = resolve(actions, 'list:selection', { doctype: 'Sales Order', view: 'form' })
    expect(front.items.some((a) => a.command === 'so.set-open')).toBe(true)
    expect(otherDoctype.items.some((a) => a.command === 'so.set-open')).toBe(false)
    expect(otherView.items.some((a) => a.command === 'so.set-open')).toBe(false)
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
    const item = menuOptions(WINDOW_REGION, os).flatMap((g) => g.items).find((i) => i.label === 'New window')
    expect(item).toBeDefined() // not re-titled to "HIJACKED"
    item.onClick() // the first-party run Handler, not the colliding "ghost" ref (which would throw)
    expect(os.state.windows).toHaveLength(1)
  })

  it('logs the collision attributed to both apps (never a silent overwrite)', () => {
    menuOptions(WINDOW_REGION, os)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('command-collision'))
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('frappe.window.new'))
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('erpnext')) // the shadowed loser, attributed
  })
})

// ADR-0032 slice 02 — surface-embedded Regions. The closed Region set (ADR-0004) grows to include
// the list toolbar, the selection/bulk bar, and the form toolbar alongside the menu-bar chrome.
// Region ⟂ Scope: a Doctype-scoped Action can render in the global menu bar as readily as its own
// toolbar. Only the selection/bulk bar is gated — it renders solely when a selection exists.
describe('regions (closed set + selection gate)', () => {
  it('the surface-embedded Regions join the closed set alongside the menu-bar chrome', () => {
    const ids = REGIONS.map((r) => r.id)
    expect(ids).toEqual([
      'menubar:system', 'menubar:app', 'menubar:file', 'menubar:edit', 'menubar:view',
      'menubar:window', 'menubar:help', 'list:toolbar', 'list:selection', 'form:toolbar',
      'desktop:context', 'dock:context',
    ])
  })

  it('regionById returns the descriptor; an id outside the set is undefined', () => {
    expect(regionById(LIST_TOOLBAR)).toEqual({ id: 'list:toolbar' })
    expect(regionById(LIST_SELECTION)).toEqual({ id: 'list:selection', when: { selection: '*' } })
    expect(regionById('nope:nope')).toBeUndefined()
  })

  it('an ungated Region always renders; the selection/bulk bar renders only when a selection exists', () => {
    expect(regionRenders(regionById(LIST_TOOLBAR), {})).toBe(true)
    expect(regionRenders(regionById(FORM_TOOLBAR), {})).toBe(true)
    expect(regionRenders(regionById(DESKTOP_CONTEXT_REGION), {})).toBe(true) // chrome context menus are ungated
    expect(regionRenders(regionById(DOCK_CONTEXT_REGION), {})).toBe(true)
    expect(regionRenders(regionById(LIST_SELECTION), {})).toBe(false) // no selection → hidden
    expect(regionRenders(regionById(LIST_SELECTION), { selection: 'rows' })).toBe(true)
    expect(regionRenders(undefined, {})).toBe(true) // an unknown id is ungated
  })
})

// Region and Scope are independent axes (ADR-0032): the same scope-aware resolver drives every
// Region, so a Doctype/View-scoped Action lands wherever its `region` points. These are pure
// resolver tests — no store — proving Actions render into the new Regions through slice 01's engine.
describe('Region ⟂ Scope (surface-embedded Regions render via the resolver)', () => {
  let warn
  beforeEach(() => { warn = vi.spyOn(console, 'warn').mockImplementation(() => {}) })
  afterEach(() => warn.mockRestore())

  const at = (region, scope) => ({ command: 'c', region, sourceApp: 'crm', scope })

  it('a Doctype-scoped Action can target the GLOBAL menu bar (Region independent of Scope)', () => {
    const a = at('menubar:file', { tier: 'doctype', doctype: 'CRM Lead' })
    expect(resolve([a], 'menubar:file', { doctype: 'CRM Lead' }).items).toHaveLength(1)
    expect(resolve([a], 'menubar:file', { doctype: 'Contact' }).items).toEqual([]) // scope still gates
  })

  it('a View-scoped Action renders into the list toolbar only when that doctype+view is front', () => {
    const a = at(LIST_TOOLBAR, { tier: 'view', doctype: 'CRM Lead', view: 'list' })
    expect(resolve([a], LIST_TOOLBAR, { doctype: 'CRM Lead', view: 'list' }).items).toHaveLength(1)
    expect(resolve([a], LIST_TOOLBAR, { doctype: 'CRM Lead', view: 'form' }).items).toEqual([]) // wrong view
    expect(resolve([a], 'menubar:file', { doctype: 'CRM Lead', view: 'list' }).items).toEqual([]) // wrong region
  })

  it('a selection/bulk Action carries no selection when — its scope keys on doctype, the Region gates selection', () => {
    // The bulk Action's own `when` is the auto-derived scope predicate (doctype only); the resolver
    // returns it whenever the doctype is front. Selection existence is the Region's gate, not the
    // Action's — so the Action is free of any hand-written selection `when` (ADR-0032, slice 04).
    const bulk = at(LIST_SELECTION, { tier: 'doctype', doctype: 'CRM Lead' })
    const { items } = resolve([bulk], LIST_SELECTION, { doctype: 'CRM Lead' })
    expect(items).toHaveLength(1)
    expect(items[0].when).toBeUndefined() // no selection when hand-written on the Action
  })
})

// ADR-0039 rule 2 — app-declared menus. The App slot grows a parameterized Region
// `menubar:app:<appId>:<menuId>`: an app declares menus into a bar, ANY app may declare into a REAL
// app's band (cross-app extension, ADR-0001), and each renders only while its owning app is focused.
describe('app-declared menus (menubar:app:<appId>:<menuId>, ADR-0039 rule 2)', () => {
  it('builds and parses the app-qualified Region', () => {
    expect(appMenuRegion('erpnext', 'reports')).toBe('menubar:app:erpnext:reports')
    expect(parseAppMenuRegion('menubar:app:erpnext:reports')).toEqual({ appId: 'erpnext', menuId: 'reports' })
  })

  it('parseAppMenuRegion rejects the bare App menu, OS-frame regions, and malformed tails', () => {
    expect(parseAppMenuRegion(APP_REGION)).toBeNull()             // the OS-owned App menu, not app-declared
    expect(parseAppMenuRegion(FILE_REGION)).toBeNull()            // an OS-frame region
    expect(parseAppMenuRegion('menubar:app:erpnext')).toBeNull()  // missing menuId
    expect(parseAppMenuRegion('menubar:app:erpnext:a:b')).toBeNull() // a colon inside the tail
  })

  it('an app-menu Region sits outside the closed set, so it is ungated — its Actions carry the gate', () => {
    const region = appMenuRegion('erpnext', 'reports')
    expect(regionById(region)).toBeUndefined()
    expect(regionRenders(regionById(region), {})).toBe(true)
  })

  it('an app-scoped Action into an app-menu Region resolves only when that app is front', () => {
    const region = appMenuRegion('erpnext', 'reports')
    const a = { command: 'c', region, sourceApp: 'erpnext', scope: { tier: 'app', app: 'erpnext' } }
    expect(resolve([a], region, { activeApp: 'erpnext' }).items).toHaveLength(1)
    expect(resolve([a], region, { activeApp: 'crm' }).items).toEqual([]) // another app front → hidden
  })

  // Cross-app: crm authors an Action into erpnext's Reports menu (Shariq's custom-app case). The item
  // is eligible under erpnext's Context (an explicit when), so it renders in erpnext's bar though crm
  // shipped it — placement crosses apps freely (ADR-0001); only the menu grammar stays closed.
  const os = useOS()
  const app = (id, name, order) => ({ type: 'app', target: '', name: id, sourceApp: id, payload: { id, name }, order })
  const menu = (id, title, target, sourceApp, order) =>
    ({ type: 'app-menu', target, name: id, sourceApp, payload: { id, title, order } })
  const REPORTS = appMenuRegion('erpnext', 'reports')
  const command = {
    type: 'command', target: '', name: 'crm.report.pipeline', sourceApp: 'crm',
    payload: { id: 'crm.report.pipeline', sourceApp: 'crm', title: 'Pipeline Report', handler: { kind: 'run', ref: 'noop' } },
  }
  const crmItemInErpnextReports = {
    type: 'action', target: REPORTS, name: 'crm.report.pipeline', sourceApp: 'crm',
    payload: { command: 'crm.report.pipeline', region: REPORTS, sourceApp: 'crm', when: { activeApp: 'erpnext' } },
  }
  const boot = {
    user: 'a', csrf_token: 't', roles: [], permissions: {},
    registry: { schemaVersion: 1, contributions: [
      app('frappe', 'Frappe', 0), app('crm', 'CRM', 1), app('erpnext', 'ERPNext', 2),
      menu('reports', 'Reports', 'erpnext', 'erpnext', 20), command, crmItemInErpnextReports,
    ] },
  }
  let warn
  beforeEach(() => {
    os.state.windows = []; os.state.geo = {}; os.state.activeId = null
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    registerRunHandlers({ noop: () => {} })
    initRegistry(boot)
  })
  afterEach(() => { warn.mockRestore(); initRegistry(null) })

  it('renders erpnext\'s Reports menu carrying crm\'s item when erpnext is focused (cross-app, earned)', () => {
    os.openApp('erpnext')
    expect(menuOptions(REPORTS, os).flatMap((g) => g.items).map((i) => i.label)).toEqual(['Pipeline Report'])
  })

  it('hides the same menu when another app is focused (earned — no eligible Action resolves)', () => {
    os.openApp('crm')
    expect(menuOptions(REPORTS, os)).toEqual([])
  })
})

// The toolbar render contract (toolbarItems) — the pure projector the toolbar components draw,
// mirroring fileMenuOptions. Contribution data → resolver → flat buttons → run Handler. Seeded from
// the server registry so an app-declared toolbar Action folds through the same merge the File menu
// uses. The selection/bulk bar stays empty until a selection exists (the Region gate).
describe('toolbarItems (surface-embedded Region render contract)', () => {
  const os = useOS()
  const command = {
    type: 'command', target: '', name: 'frappe.todo.close', sourceApp: 'frappe',
    payload: { id: 'frappe.todo.close', sourceApp: 'frappe', title: 'Close ToDo', handler: { kind: 'run', ref: 'todo-close' } },
  }
  const toolbarAction = {
    type: 'action', target: 'list:toolbar', name: 'frappe.todo.close', sourceApp: 'frappe',
    payload: { command: 'frappe.todo.close', region: 'list:toolbar', sourceApp: 'frappe', scope: { tier: 'doctype', doctype: 'ToDo' } },
  }
  const bulkAction = {
    type: 'action', target: 'list:selection', name: 'frappe.todo.close', sourceApp: 'frappe',
    payload: { command: 'frappe.todo.close', region: 'list:selection', sourceApp: 'frappe', scope: { tier: 'doctype', doctype: 'ToDo' } },
  }
  const app = (id, name, order) => ({ type: 'app', target: '', name: id, sourceApp: id, payload: { id, name }, order })
  const boot = {
    user: 'a', csrf_token: 't', roles: [], permissions: {},
    registry: { schemaVersion: 1, contributions: [app('frappe', 'Frappe', 0), command, toolbarAction, bulkAction] },
  }
  let warn
  beforeEach(() => {
    os.state.windows = []
    os.state.geo = {}
    os.state.activeId = null
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    registerRunHandlers({ 'todo-close': () => { closed = true } })
    initRegistry(boot)
  })
  afterEach(() => { warn.mockRestore(); initRegistry(null) })
  let closed = false

  it('renders an app-declared toolbar Action into the list toolbar when its doctype is front', () => {
    os.openListGlobal('ToDo')
    expect(toolbarItems(LIST_TOOLBAR, os).map((i) => i.label)).toEqual(['Close ToDo'])
  })

  it('wires each button to its Command handler — clicking fires the run Handler by ref', () => {
    os.openListGlobal('ToDo')
    closed = false
    toolbarItems(LIST_TOOLBAR, os)[0].onClick()
    expect(closed).toBe(true)
  })

  it('is empty when the front doctype does not match the Action scope', () => {
    os.openListGlobal('Note')
    expect(toolbarItems(LIST_TOOLBAR, os)).toEqual([])
  })

  it('the selection/bulk bar stays empty while no selection exists, even with a scope-eligible Action', () => {
    os.openListGlobal('ToDo') // doctype matches, but contextForOS carries no selection yet
    expect(toolbarItems(LIST_SELECTION, os)).toEqual([])
  })
})

// ADR-0032 slice 04 — the bulk-action-as-data tracer. "Set as Open" is a Command with a `run`
// Handler placed by a View-scoped Action into `list:selection`, its `when` auto-derived from Scope.
// The declarative half is DATA (ToDo's os/list.json manifest, delivered on live meta and folded via
// registerScopedContributions — the slice-03 shape); only the imperative half (`todo-set-open`) is
// bundled, self-registered when project.ts pulls in bulk-verbs. This drives the whole path:
// manifest → resolve → selection Region → run Handler over a multi-row selection.
describe('bulk action as data tracer — "Set as Open" (ADR-0032 slice 04)', () => {
  const os = useOS()
  const command = {
    type: 'command', target: '', name: 'frappe.todo.set-open', sourceApp: 'frappe',
    payload: { id: 'frappe.todo.set-open', sourceApp: 'frappe', title: 'Set as Open', handler: { kind: 'run', ref: 'todo-set-open' } },
  }
  const action = {
    type: 'action', target: 'list:selection', name: 'frappe.todo.set-open', sourceApp: 'frappe',
    payload: { command: 'frappe.todo.set-open', region: 'list:selection', sourceApp: 'frappe', scope: { tier: 'view', doctype: 'ToDo', view: 'list' } },
  }
  const app = (id, name, order) => ({ type: 'app', target: '', name: id, sourceApp: id, payload: { id, name }, order })
  const boot = { user: 'a', csrf_token: 't', roles: [], permissions: {}, registry: { schemaVersion: 1, contributions: [app('frappe', 'Frappe', 0)] } }
  let warn, fetchMock
  beforeEach(() => {
    os.state.windows = []; os.state.geo = {}; os.state.selection = {}; os.state.focusKind = {}; os.state.activeId = null
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ message: [] }) }))
    vi.stubGlobal('fetch', fetchMock)
    initRegistry(boot)
    registerScopedContributions('ToDo', [command, action]) // live-meta delivery, like opening the ToDo list
  })
  afterEach(() => { warn.mockRestore(); vi.unstubAllGlobals(); initRegistry(null) })

  const bulkCall = () => fetchMock.mock.calls.find(([url]) => String(url).includes('submit_cancel_or_update_docs'))
  const setOpenVerb = () => useRegistry().commands().find((c) => c.id === 'frappe.todo.set-open')

  it('places the verb into list:selection via View scope, with no hand-written selection when', () => {
    const { items } = resolve(useRegistry().actions(), 'list:selection', { doctype: 'ToDo', view: 'list', selection: 'rows' })
    const set = items.find((a) => a.command === 'frappe.todo.set-open')
    expect(set).toBeDefined()
    expect(set.when).toBeUndefined() // eligibility is the Scope auto-when, not a hand-written selection when
  })

  it('the selection Region gates the verb on selection existence, not the Action', () => {
    expect(regionRenders(regionById(LIST_SELECTION), { doctype: 'ToDo' })).toBe(false)
    expect(regionRenders(regionById(LIST_SELECTION), { doctype: 'ToDo', selection: 'rows' })).toBe(true)
  })

  it('invoking over a multi-row selection calls the standard bulk-update method with the selected rows', async () => {
    os.openListGlobal('ToDo')
    os.setSelection(os.state.activeId, 'rows', ['TODO-0001', 'TODO-0002'])
    invoke(setOpenVerb(), os) // fires the run Handler; the write POSTs after joining the job room first
    await new Promise((resolve) => setTimeout(resolve)) // drain the pre-write watchTask (subscribe-before-write, review #2)
    const call = bulkCall()
    expect(call).toBeDefined()
    expect(call[1].method).toBe('POST')
    const body = JSON.parse(call[1].body)
    expect(body).toMatchObject({ doctype: 'ToDo', action: 'update', data: { status: 'Open' } })
    expect(body.docnames).toEqual(['TODO-0001', 'TODO-0002'])
    await new Promise((resolve) => setTimeout(resolve)) // drain the fire-and-forget write+reload before teardown
  })

  it('is a clean no-op (no server call) when nothing is selected — the verb never fires blind', () => {
    os.openListGlobal('ToDo') // no selection seeded
    invoke(setOpenVerb(), os)
    expect(bulkCall()).toBeUndefined()
  })

  it('an enqueued bulk run (20+ rows → null) fires the write but does NOT refresh the list', async () => {
    // The bulk method enqueues 20+ rows in the background and returns null (nothing applied yet).
    // The write seam must not then re-fetch the list — a refresh would paint stale rows under a
    // false "done" — so no get_list call follows the bulk POST.
    fetchMock.mockImplementation(async (url) =>
      String(url).includes('submit_cancel_or_update_docs')
        ? { ok: true, json: async () => ({ message: null }) }
        : { ok: true, json: async () => ({ message: [] }) })
    os.openListGlobal('ToDo')
    os.setSelection(os.state.activeId, 'rows', Array.from({ length: 25 }, (_, i) => `TODO-${i}`))
    await new Promise((resolve) => setTimeout(resolve)) // let the list-open's own load settle
    fetchMock.mockClear() // watch only the calls the bulk invoke makes
    invoke(setOpenVerb(), os)
    await new Promise((resolve) => setTimeout(resolve)) // drain the pre-write watchTask, then the write POSTs
    expect(bulkCall()).toBeDefined() // the bulk POST still fires
    await new Promise((resolve) => setTimeout(resolve)) // drain the fire-and-forget write
    const listCall = fetchMock.mock.calls.find(([url]) => String(url).includes('get_list'))
    expect(listCall).toBeUndefined() // no stale refresh on the enqueued path
  })
})

// ADR-0032 slice 04 — per-window selection (state.selection[winId]) must not outlive the surface
// it was made on. A window that swaps its surface (in-window nav, back/fwd, close) carries a bulk
// verb's docnames; if the stale selection survives, a verb fires against the WRONG doctype
// (select ToDo rows → nav same window to User → "Set as Open" would bulkUpdate('User', ['TODO-1',…])).
// clearSelection(winId) at every surface-swap seam is the guard. With only 'frappe' registered,
// appForDoctype(dt) === 'frappe' for every dt, so ToDo and User share window 'app:frappe' and the
// second openListGlobal is an in-window navigateWindow — exactly the seam under test.
describe('per-window selection is cleared on surface swap (ADR-0032 slice 04)', () => {
  const os = useOS()
  const app = (id, name, order) => ({ type: 'app', target: '', name: id, sourceApp: id, payload: { id, name }, order })
  const boot = { user: 'a', csrf_token: 't', roles: [], permissions: {}, registry: { schemaVersion: 1, contributions: [app('frappe', 'Frappe', 0)] } }
  let fetchMock
  beforeEach(() => {
    os.state.windows = []; os.state.geo = {}; os.state.selection = {}; os.state.focusKind = {}; os.state.activeId = null
    fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ message: [] }) }))
    vi.stubGlobal('fetch', fetchMock)
    initRegistry(boot)
  })
  afterEach(() => { vi.unstubAllGlobals(); initRegistry(null) })

  it('in-window navigation to another list clears the stale selection', () => {
    os.openListGlobal('ToDo')
    const winId = os.state.activeId
    os.setSelection(winId, 'rows', ['TODO-0001', 'TODO-0002'])
    expect(os.selectedRecords()).toEqual(['TODO-0001', 'TODO-0002'])
    os.openListGlobal('User') // same window → navigateWindow fires (appForDoctype is 'frappe' for both)
    expect(os.selectedRecords()).toEqual([]) // front window's selection is gone
    expect(os.state.selection[winId]).toBeUndefined() // and the slice itself was deleted, not emptied
  })

  it('winBack clears the selection too', () => {
    os.openListGlobal('ToDo')
    const winId = os.state.activeId
    os.openListGlobal('User') // push back-history so there's a prior surface to return to
    os.setSelection(winId, 'rows', ['USR-0001']) // seed a selection on the current (User) surface
    os.winBack(winId)
    expect(os.state.selection[winId]).toBeUndefined()
    expect(os.selectedRecords()).toEqual([])
  })

  it('closing a window drops its selection so a reused id starts clean', () => {
    os.openListGlobal('ToDo')
    const winId = os.state.activeId
    os.setSelection(winId, 'rows', ['TODO-1'])
    os.closeWin(winId)
    expect(os.state.selection[winId]).toBeUndefined()
  })

  it('restoreWin (browser back/forward onto another surface) clears the stale selection too', () => {
    os.openListGlobal('ToDo')
    const winId = os.state.activeId
    os.setSelection(winId, 'rows', ['TODO-0001', 'TODO-0002'])
    // The browser-history path swaps the surface WITHOUT touching the per-window stacks; it must
    // still drop the selection, or a bulk verb fires against the newly-shown doctype's rows.
    os.restoreWin(winId, listSurface('User'))
    expect(os.selectedRecords()).toEqual([])
    expect(os.state.selection[winId]).toBeUndefined()
  })

  it('restoreWin onto the SAME surface (pure refocus) keeps the selection', () => {
    os.openListGlobal('ToDo')
    const winId = os.state.activeId
    os.setSelection(winId, 'rows', ['TODO-0001', 'TODO-0002'])
    // Browser back/forward between two same-doctype instances refocuses a window with the surface it
    // already shows; that is not a surface swap, so the per-window selection must survive it.
    os.restoreWin(winId, listSurface('ToDo'))
    expect(os.selectedRecords()).toEqual(['TODO-0001', 'TODO-0002'])
  })
})

// Issue 06 — ADR-0001 dogfooding completed. The six formerly-literal menus (system, app, edit,
// view, window, help) are now `menubar:<menu>` Regions fed by first-party frappe Commands/Actions
// and projected through the SAME menuOptions path as File. These lock the render parity and the two
// live decisions the menus carry: View eligibility and the fullscreen/`{app}` presentation.
describe('every menu-bar menu renders from the resolver (no literal arrays)', () => {
  const os = useOS()
  beforeEach(() => {
    os.state.windows = []; os.state.geo = {}; os.state.activeId = null; os.state.split = null
    os.isFullscreen.value = false
  })
  const labels = (region) => menuOptions(region, os).flatMap((g) => g.items).map((i) => i.label)

  it('MENUBAR_REGIONS lists the seven menus in bar order', () => {
    expect(MENUBAR_REGIONS).toEqual([
      'menubar:system', 'menubar:app', 'menubar:file', 'menubar:edit',
      'menubar:view', 'menubar:window', 'menubar:help',
    ])
  })

  it('the system menu resolves its workspace + session verbs, plus whole-OS full screen', () => {
    // The three Theme options nest under the "Theme" parent, so the flat item list shows the parent
    // (not the options) between Switch to Desk… and Log out… — both group 'e'.
    expect(labels(SYSTEM_REGION)).toEqual([
      'About this workspace', 'Settings…', 'Change wallpaper…', 'Enter full screen', 'Switch to Desk…', THEME_SUBMENU, 'Log out…',
    ])
    expect(menuOptions(SYSTEM_REGION, os).map((g) => g.group)).toEqual(['a', 'b', 'c', 'd', 'e'])
  })

  it('the Theme submenu nests its three appearance options, each with a leading icon', () => {
    const group = menuOptions(SYSTEM_REGION, os).find((g) => g.group === 'e')
    const parent = group.items.find((i) => i.label === THEME_SUBMENU)
    // The parent is a pure submenu holder — no click of its own, just the nested options.
    expect(parent.onClick).toBeUndefined()
    expect(parent.submenu.map((i) => i.label)).toEqual(['Light Mode', 'Dark Mode', 'System Default'])
    expect(parent.submenu.every((i) => typeof i.icon === 'string' && i.icon.startsWith('lucide-'))).toBe(true)
  })

  it('registerMenuSelection checkmarks the live Theme option (the injected radio selection)', () => {
    registerMenuSelection(() => new Set([THEME_COMMAND.dark]))
    const parent = menuOptions(SYSTEM_REGION, os).find((g) => g.group === 'e').items.find((i) => i.label === THEME_SUBMENU)
    const selected = parent.submenu.filter((i) => i.selected).map((i) => i.label)
    expect(selected).toEqual(['Dark Mode'])
    registerMenuSelection(() => new Set()) // restore the frappe-ui-free default for other specs
  })

  it('the edit menu resolves nothing — its noop stubs were deleted (ADR-0039 rule 1)', () => {
    expect(labels(EDIT_REGION)).toEqual([])
  })

  it('the window menu resolves New/Close plus Minimize/Zoom and both split verbs', () => {
    expect(labels(WINDOW_REGION)).toEqual(['New window', 'Close window', 'Minimize', 'Zoom', 'Enter split view', 'Exit split view'])
  })

  it('the help menu resolves Frappe help', () => {
    expect(labels(HELP_REGION)).toEqual(['Frappe help'])
  })
})

// The app menu's `{app}` token — presentation interpolated at render time to the front app's name
// (or "Finder" on a bare desktop), the one dynamic label the literal menu used to hand-build.
describe('the app menu interpolates {app} to the front app name', () => {
  const os = useOS()
  beforeEach(() => { os.state.windows = []; os.state.geo = {}; os.state.activeId = null; os.state.split = null })
  const labels = () => menuOptions(APP_REGION, os).flatMap((g) => g.items).map((i) => i.label)

  it('names the focused app in every item', () => {
    os.openApp('crm')
    const name = os.DATA.APP.crm.name
    expect(labels()).toEqual([`${name} settings…`, `Hide ${name}`, `Quit ${name}`])
  })

  it('falls back to Finder on a bare desktop', () => {
    expect(labels()).toEqual(['Finder settings…', 'Hide Finder', 'Quit Finder'])
  })

  it('names the Finder — not its host app — when the Finder window is front', () => {
    os.openFinder()
    expect(labels()).toEqual(['Finder settings…', 'Hide Finder', 'Quit Finder'])
  })

  it('Quit removes every window of the front app and clears focus', () => {
    os.openApp('crm')
    const quit = menuOptions(APP_REGION, os).flatMap((g) => g.items).find((i) => i.label.startsWith('Quit'))
    quit.onClick()
    expect(os.state.windows).toHaveLength(0)
    expect(os.state.activeId).toBeNull()
  })
})

// The Finder is the OS's desktop shell, not the framework app: its app-menu / Window verbs route to
// the Finder (open/close/settings), never to a frappe app window.
describe('menu verbs route the Finder to itself, not the frappe app', () => {
  const os = useOS()
  const command = (id) => MENUBAR_COMMANDS.find((c) => c.id === id)
  beforeEach(() => { os.state.windows = []; os.state.geo = {}; os.state.activeId = null; os.state.split = null })

  it('New window opens the Finder when the Finder is front', () => {
    os.openFinder()
    invoke(command('frappe.window.new'), os)
    expect(os.state.windows.map((w) => w.id)).toContain('finder')
    expect(os.state.activeId).toBe('finder')
  })

  it('Quit closes only the Finder window, leaving app windows open', () => {
    os.openApp('crm')
    os.openFinder()
    invoke(command('frappe.app.quit'), os)
    expect(os.state.windows.some((w) => w.id === 'finder')).toBe(false)
    expect(os.state.windows.some((w) => w.id === 'app:crm')).toBe(true)
  })

  it('Finder settings opens the desktop Settings window', () => {
    os.openFinder()
    invoke(command('frappe.app.settings'), os)
    expect(os.state.windows.some((w) => w.id === 'settings')).toBe(true)
  })
})

// View menu decision table: Show dashboard / Show as list are gated to an app window (a real
// `when`), and the fullscreen item is a live-state toggle — a command PAIR whose dead half
// suppressedToggleCommands drops, so exactly one correctly-labelled item renders.
describe('view menu eligibility + fullscreen toggle (decision table)', () => {
  const os = useOS()
  beforeEach(() => {
    os.state.windows = []; os.state.geo = {}; os.state.activeId = null; os.state.split = null
    os.isFullscreen.value = false
  })
  const labels = () => menuOptions(VIEW_REGION, os).flatMap((g) => g.items).map((i) => i.label)

  it('shows Show dashboard / Show as list only when an app window is front', () => {
    os.openApp('crm')
    expect(labels()).toEqual(expect.arrayContaining(['Show dashboard', 'Show as list']))
  })

  it('hides the dashboard/list verbs on a non-app (system) window', () => {
    os.openSettings()
    expect(labels()).not.toContain('Show dashboard')
    expect(labels()).not.toContain('Show as list')
  })

  it('hides them on a bare desktop (no window role to satisfy the when)', () => {
    expect(labels()).not.toContain('Show dashboard')
  })

  // Full screen moved to the System menu (ADR-0039 rule 3 — a whole-OS toggle, not a View verb).
  const systemLabels = () => menuOptions(SYSTEM_REGION, os).flatMap((g) => g.items).map((i) => i.label)

  it('the View menu no longer carries the fullscreen verbs', () => {
    expect(labels()).not.toContain('Enter full screen')
    expect(labels()).not.toContain('Exit full screen')
  })

  it('System shows Enter full screen when windowed and Exit full screen when full-screen — never both', () => {
    os.isFullscreen.value = false
    expect(systemLabels()).toContain('Enter full screen')
    expect(systemLabels()).not.toContain('Exit full screen')
    os.isFullscreen.value = true
    expect(systemLabels()).toContain('Exit full screen')
    expect(systemLabels()).not.toContain('Enter full screen')
  })

  it('suppressedToggleCommands drops exactly the dead half of the fullscreen pair', () => {
    os.isFullscreen.value = false
    expect([...suppressedToggleCommands(os)]).toEqual(['frappe.system.exit-fullscreen'])
    os.isFullscreen.value = true
    expect([...suppressedToggleCommands(os)]).toEqual(['frappe.system.enter-fullscreen'])
  })
})

// ADR-0039 acceptance — the menu bar is earned + honest. Rule 1: an empty region yields no menu
// (MenuBar.vue renders only menus whose menuOptions is non-empty); no handler is a noop; About is a
// real dialog. Rule 3: an os-scope command in an app-connoting menu warns loudly at projection time.
describe('ADR-0039 — earned menus, no noops, scope honesty', () => {
  const os = useOS()
  beforeEach(() => {
    os.state.windows = []; os.state.geo = {}; os.state.activeId = null
    os.state.aboutOpen = false; os.isFullscreen.value = false
  })

  it('on a bare desktop the middle menus resolve to nothing — File/Edit/View earn no title', () => {
    expect(menuOptions(FILE_REGION, os)).toEqual([]) // OS owns no File items (app-earned)
    expect(menuOptions(EDIT_REGION, os)).toEqual([]) // noop stubs deleted
    expect(menuOptions(VIEW_REGION, os)).toEqual([]) // dashboard/list gated to an app window
  })

  it('the frame menus stay backed on a bare desktop — System/Window/Help never empty', () => {
    expect(menuOptions(SYSTEM_REGION, os).length).toBeGreaterThan(0)
    expect(menuOptions(WINDOW_REGION, os).length).toBeGreaterThan(0)
    expect(menuOptions(HELP_REGION, os).length).toBeGreaterThan(0)
  })

  it('no first-party menu command points at a noop ref (registering a ref asserts behavior)', () => {
    expect(MENUBAR_COMMANDS.map((c) => c.handler.ref)).not.toContain('noop')
  })

  it('About this workspace opens the real dialog through its run handler (no more noop)', () => {
    const about = MENUBAR_COMMANDS.find((c) => c.id === 'frappe.system.about')
    invoke(about, os)
    expect(os.state.aboutOpen).toBe(true)
  })

  it('warns loudly when an os-scope command is placed in an app-connoting menu (rule 3)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const app = (id, name, order) => ({ type: 'app', target: '', name: id, sourceApp: id, payload: { id, name }, order })
    const command = { type: 'command', target: '', name: 'x.big', sourceApp: 'x', payload: { id: 'x.big', sourceApp: 'x', title: 'Whole-OS thing', handler: { kind: 'run', ref: 'x-run' } } }
    const action = { type: 'action', target: 'menubar:view', name: 'x.big', sourceApp: 'x', payload: { command: 'x.big', region: 'menubar:view', sourceApp: 'x', scope: { tier: 'os' } } }
    initRegistry({ user: 'a', csrf_token: 't', roles: [], permissions: {}, registry: { schemaVersion: 1, contributions: [app('frappe', 'Frappe', 0), app('x', 'X', 1), command, action] } })
    menuOptions(VIEW_REGION, os)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('scope-dishonesty'))
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('x.big'))
    warn.mockRestore(); initRegistry(null)
  })

  it('does NOT warn for the os-scope full screen in the System menu (System is the OS\'s own)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    menuOptions(SYSTEM_REGION, os)
    expect(warn).not.toHaveBeenCalledWith(expect.stringContaining('scope-dishonesty'))
    warn.mockRestore()
  })
})

// Acceptance #4: an app-layer Action contributed to menubar:window folds through the same server
// registry → resolver → menuOptions path and renders alongside the OS defaults — proving the six
// migrated menus are as customizable as File always was (Region ⟂ Scope, ADR-0032).
describe('an app-layer Action contributed to menubar:window shows up', () => {
  const os = useOS()
  const command = {
    type: 'command', target: '', name: 'crm.window.tile', sourceApp: 'crm',
    payload: { id: 'crm.window.tile', sourceApp: 'crm', title: 'Tile all windows', handler: { kind: 'run', ref: 'crm-tile' } },
  }
  const action = {
    type: 'action', target: 'menubar:window', name: 'crm.window.tile', sourceApp: 'crm',
    payload: { command: 'crm.window.tile', region: 'menubar:window', sourceApp: 'crm', group: 'b', order: 9 },
  }
  const app = (id, name, order) => ({ type: 'app', target: '', name: id, sourceApp: id, payload: { id, name }, order })
  const boot = {
    user: 'a', csrf_token: 't', roles: [], permissions: {},
    registry: { schemaVersion: 1, contributions: [app('frappe', 'Frappe', 0), app('crm', 'CRM', 1), command, action] },
  }
  let warn
  beforeEach(() => {
    os.state.windows = []; os.state.geo = {}; os.state.activeId = null; os.state.split = null
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    registerRunHandlers({ 'crm-tile': () => {} })
    initRegistry(boot)
  })
  afterEach(() => { warn.mockRestore(); initRegistry(null) })

  it('renders the app-declared Window item alongside the OS defaults', () => {
    const labels = menuOptions(WINDOW_REGION, os).flatMap((g) => g.items).map((i) => i.label)
    expect(labels).toContain('Tile all windows')
    expect(labels).toEqual(expect.arrayContaining(['Minimize', 'Zoom'])) // OS defaults survive
  })

  it('wires the app item to its run Handler by ref', () => {
    let tiled = false
    registerRunHandlers({ 'crm-tile': () => { tiled = true } })
    menuOptions(WINDOW_REGION, os).flatMap((g) => g.items).find((i) => i.label === 'Tile all windows').onClick()
    expect(tiled).toBe(true)
  })
})

// Issue 07 — the desktop and dock right-click menus, migrated off literal arrays onto the resolver
// (desktop:context / dock:context Regions). Pure decision tables for the two new Regions plus the
// two projectors rendered against the real store: the dock's live auto-hide toggle and position
// selection are live-state overlays (like the menu bar's fullscreen pair), and any app can
// contribute into either menu the way it customizes any menu-bar menu (ADR-0001).
describe('desktop/dock context Regions render through the resolver (no literal arrays)', () => {
  let warn
  beforeEach(() => { warn = vi.spyOn(console, 'warn').mockImplementation(() => {}) })
  afterEach(() => warn.mockRestore())

  const at = (command, region, over = {}) => ({ command, region, sourceApp: 'crm', ...over })

  it('an Action targets desktop:context and renders there, not in another Region', () => {
    const a = at('c', DESKTOP_CONTEXT_REGION)
    expect(resolve([a], DESKTOP_CONTEXT_REGION, {}).items).toHaveLength(1)
    expect(resolve([a], DOCK_CONTEXT_REGION, {}).items).toEqual([]) // wrong region
    expect(resolve([a], 'menubar:file', {}).items).toEqual([]) // wrong region
  })

  it('an Action targets dock:context and renders there only', () => {
    const a = at('c', DOCK_CONTEXT_REGION)
    expect(resolve([a], DOCK_CONTEXT_REGION, {}).items).toHaveLength(1)
    expect(resolve([a], DESKTOP_CONTEXT_REGION, {}).items).toEqual([])
  })

  it('the resolver carries the submenu placement axis through untouched', () => {
    const a = at('c', DOCK_CONTEXT_REGION, { submenu: 'Position on Screen', order: 1 })
    expect(resolve([a], DOCK_CONTEXT_REGION, {}).items[0].submenu).toBe('Position on Screen')
  })
})

describe('desktopContextItems (the desktop menu rendered from resolved Actions)', () => {
  const os = useOS()
  afterEach(() => { initRegistry(null) })

  it('resolves the first-party Change Wallpaper entry', () => {
    expect(desktopContextItems(os).map((i) => i.label)).toEqual(['Change Wallpaper…'])
  })

  it('Change Wallpaper opens Settings on the Wallpaper pane', () => {
    const openSettings = vi.spyOn(os, 'openSettings').mockImplementation(() => {})
    desktopContextItems(os).find((i) => i.label === 'Change Wallpaper…').onClick()
    expect(openSettings).toHaveBeenCalledWith('Wallpaper')
    openSettings.mockRestore()
  })

  it('a contributed Action targeting desktop:context appears in the menu', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const app = (id, name, order) => ({ type: 'app', target: '', name: id, sourceApp: id, payload: { id, name }, order })
    const command = { type: 'command', target: '', name: 'tweaks.hello', sourceApp: 'tweaks', payload: { id: 'tweaks.hello', sourceApp: 'tweaks', title: 'Hello', handler: { kind: 'run', ref: 'noop' } } }
    const action = { type: 'action', target: DESKTOP_CONTEXT_REGION, name: 'tweaks.hello', sourceApp: 'tweaks', payload: { command: 'tweaks.hello', region: DESKTOP_CONTEXT_REGION, sourceApp: 'tweaks', order: 5 } }
    initRegistry({ user: 'a', csrf_token: 't', roles: [], permissions: {}, registry: { schemaVersion: 1, contributions: [app('frappe', 'Frappe', 0), app('tweaks', 'Tweaks', 1), command, action] } })
    expect(desktopContextItems(os).map((i) => i.label)).toEqual(['Change Wallpaper…', 'Hello'])
    warn.mockRestore()
  })
})

describe('dockContextOptions (the dock menu rendered from resolved Actions)', () => {
  const os = useOS()
  const items = () => dockContextOptions(os).filter((o) => !o.separator)
  const labels = () => items().map((i) => i.label)
  const find = (label) => items().find((i) => i.label === label)

  it('renders the toggle, the Position submenu, and Dock Settings as one list with a group divider', () => {
    os.setDockAutoHide(false)
    const opts = dockContextOptions(os)
    expect(labels()).toEqual(['Turn Hiding On', 'Position on Screen', 'Dock Settings…'])
    // The two Action groups are flattened into one list, separated by a divider (not a group wrapper).
    expect(opts.filter((o) => o.separator)).toHaveLength(1)
    expect(opts.findIndex((o) => o.separator)).toBe(2) // after the position section, before Settings
    expect(find('Position on Screen').submenu.map((i) => i.label)).toEqual(['Left', 'Bottom', 'Right'])
  })

  it('the auto-hide toggle flips its label with live state (one verb renders, not both)', () => {
    os.setDockAutoHide(false)
    expect(labels()).toContain('Turn Hiding On')
    expect(labels()).not.toContain('Turn Hiding Off')
    os.setDockAutoHide(true)
    expect(labels()).toContain('Turn Hiding Off')
    expect(labels()).not.toContain('Turn Hiding On')
  })

  it('the toggle runs the auto-hide Handler through the OS API', () => {
    os.setDockAutoHide(false)
    find('Turn Hiding On').onClick()
    expect(os.state.dockAutoHide).toBe(true)
  })

  it('marks the current dock position selected and runs the position Handler', () => {
    os.setDockPosition('bottom')
    const submenu = find('Position on Screen').submenu
    expect(submenu.find((i) => i.label === 'Bottom').selected).toBe(true)
    expect(submenu.find((i) => i.label === 'Left').selected).toBeUndefined()
    submenu.find((i) => i.label === 'Left').onClick()
    expect(os.state.dockPosition).toBe('left')
  })

  it('Dock Settings opens Settings on the Dock pane', () => {
    const openSettings = vi.spyOn(os, 'openSettings').mockImplementation(() => {})
    find('Dock Settings…').onClick()
    expect(openSettings).toHaveBeenCalledWith('Dock')
    openSettings.mockRestore()
  })
})

describe('the dock live-state overlay helpers', () => {
  const os = useOS()

  it('suppresses the toggle half that matches the live auto-hide state', () => {
    os.setDockAutoHide(true)
    expect([...suppressedDockHidingCommands(os)]).toEqual(['frappe.dock.hiding-on'])
    os.setDockAutoHide(false)
    expect([...suppressedDockHidingCommands(os)]).toEqual(['frappe.dock.hiding-off'])
  })

  it('selects exactly the position command matching the live side', () => {
    os.setDockPosition('right')
    expect([...selectedDockPositionCommands(os)]).toEqual(['frappe.dock.position-right'])
  })
})

// ADR-0037 — a keyboard shortcut is a Command field (`shortcut`), one OS dispatcher, the SAME
// resolve/eligibility as menus. Pure-data specs: canonicalization (author string ↔ KeyboardEvent),
// the first-seen-wins binding index (ADR-0007 shadow), and pickShortcut's eligibility + text-entry
// guard. No DOM, no boot — pickShortcut takes its commands/actions/context as plain data.
describe('keyboard shortcuts (ADR-0037 — a Command field, one dispatcher)', () => {
  const cmd = (id, shortcut, over = {}) =>
    ({ id, sourceApp: 'test', title: id, handler: { kind: 'run', ref: id }, shortcut, ...over })
  const act = (command, when) =>
    ({ command, region: 'menubar:window', sourceApp: 'test', ...(when ? { when } : {}) })

  describe('binding canonicalization', () => {
    it('canonicalizes author strings to a stable form (mod folds cmd/ctrl, modifiers ordered)', () => {
      expect(canonicalBinding('mod+n')).toBe('mod+n')
      expect(canonicalBinding('Cmd+Shift+K')).toBe('mod+shift+k')
      expect(canonicalBinding('ctrl+k')).toBe('mod+k')
      expect(canonicalBinding('shift+mod+k')).toBe('mod+shift+k')
    })
    it('reads the same canonical form off a KeyboardEvent (meta or ctrl → mod)', () => {
      expect(eventBinding({ metaKey: true, key: 'n' })).toBe('mod+n')
      expect(eventBinding({ ctrlKey: true, key: 'k' })).toBe('mod+k')
      expect(eventBinding({ metaKey: true, shiftKey: true, key: 'K' })).toBe('mod+shift+k')
    })
    it('a modifier-only keypress is not a binding', () => {
      expect(eventBinding({ metaKey: true, key: 'Meta' })).toBe(null)
      expect(eventBinding({ shiftKey: true, key: 'Shift' })).toBe(null)
    })
    it('formats a binding as macOS glyphs for the menu chip', () => {
      expect(formatShortcut('mod+n')).toBe('⌘N')
      expect(formatShortcut('mod+shift+k')).toBe('⌘⇧K')
    })
  })

  describe('the binding index (first-seen-wins + loud shadow warn, ADR-0007)', () => {
    it('keeps the first command for a binding and warns the shadowed one loudly', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const index = shortcutIndex([cmd('a.first', 'mod+j'), cmd('b.second', 'mod+j')])
      expect(index.get('mod+j').id).toBe('a.first')
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('shortcut-collision'))
      warn.mockRestore()
    })
    it('skips commands with no shortcut', () => {
      const index = shortcutIndex([{ id: 'x', sourceApp: 't', title: 'x', handler: { kind: 'run', ref: 'x' } }])
      expect(index.size).toBe(0)
    })
  })

  describe('resolution (same eligibility as menus, plus the text-entry guard)', () => {
    const context = { activeApp: 'crm', doctype: 'CRM Lead' }
    it('fires only when the command has an eligible placement for the Context', () => {
      const commands = [cmd('t.deal', 'mod+d')]
      const eligible = [act('t.deal', { activeApp: 'crm' })]
      const ineligible = [act('t.deal', { activeApp: 'erpnext' })]
      expect(pickShortcut('mod+d', false, commands, eligible, context).id).toBe('t.deal')
      expect(pickShortcut('mod+d', false, commands, ineligible, context)).toBe(null)
    })
    it('a command with no placement is a global verb (the keyboard-only palette case)', () => {
      const commands = [cmd('t.palette', 'mod+k')]
      expect(pickShortcut('mod+k', false, commands, [], context).id).toBe('t.palette')
    })
    it('an unbound keystroke resolves to nothing', () => {
      expect(pickShortcut('mod+z', false, [cmd('t.deal', 'mod+d')], [], context)).toBe(null)
    })
    it('never fires a non-global shortcut while a text input holds focus', () => {
      expect(pickShortcut('mod+d', true, [cmd('t.deal', 'mod+d')], [], context)).toBe(null)
    })
    it('a shortcut marked allowInInput still fires while typing', () => {
      const commands = [cmd('t.send', 'mod+enter', { allowInInput: true })]
      expect(pickShortcut('mod+enter', true, commands, [], context).id).toBe('t.send')
    })
  })

  describe('the text-entry guard predicate', () => {
    it('flags inputs, textareas and contenteditable, nothing else', () => {
      expect(isTextEntry({ tagName: 'INPUT', isContentEditable: false })).toBe(true)
      expect(isTextEntry({ tagName: 'TEXTAREA', isContentEditable: false })).toBe(true)
      expect(isTextEntry({ tagName: 'DIV', isContentEditable: true })).toBe(true)
      expect(isTextEntry({ tagName: 'DIV', isContentEditable: false })).toBe(false)
      expect(isTextEntry(null)).toBe(false)
    })
  })

  describe('the first-party OS shortcuts ride their Commands', () => {
    it('New window declares its mod+n shortcut', () => {
      expect(MENUBAR_COMMANDS.find((c) => c.id === 'frappe.window.new').shortcut).toBe('mod+n')
    })
    it('the palette command is keyboard-only (mod+k, no menu placement)', () => {
      const palette = MENUBAR_COMMANDS.find((c) => c.id === 'frappe.palette.open')
      expect(palette.shortcut).toBe('mod+k')
      expect(MENUBAR_ACTIONS.some((a) => a.command === 'frappe.palette.open')).toBe(false)
    })
  })
})

// The menu chip (ADR-0037): a menu item carries its Command's binding as a display glyph, so the
// renderer draws it as trailing presentation. Runs against the real store like the other menu specs.
describe('menu items display their command shortcut (ADR-0037 chip)', () => {
  const os = useOS()
  const app = (id, name, order) => ({ type: 'app', target: '', name: id, sourceApp: id, payload: { id, name }, order })
  const boot = {
    user: 'a', csrf_token: 't', roles: [], permissions: {},
    registry: { schemaVersion: 1, contributions: [app('frappe', 'Frappe', 0)] },
  }
  beforeEach(() => { os.state.windows = []; os.state.geo = {}; os.state.activeId = null; initRegistry(boot) })
  afterEach(() => { initRegistry(null) })

  it('the New window item carries its ⌘N binding for the renderer', () => {
    const item = menuOptions(WINDOW_REGION, os).flatMap((g) => g.items).find((i) => i.label === 'New window')
    expect(item.shortcut).toBe('⌘N')
  })

  it('an item whose command has no shortcut leaves the chip empty', () => {
    const item = menuOptions(WINDOW_REGION, os).flatMap((g) => g.items).find((i) => i.label === 'Minimize')
    expect(item.shortcut).toBeUndefined()
  })
})
