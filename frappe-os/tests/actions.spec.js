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
    expect(specificity({ doctype: 'CRM Lead', activeApp: 'crm', windowRole: 'record' })).toEqual([1, 2])
  })

  it('a one-key surface predicate outranks a two-key window predicate (tier dominates count)', () => {
    expect(compareSpecificity(specificity({ doctype: 'CRM Lead' }),
      specificity({ activeApp: 'crm', windowRole: 'record' }))).toBeGreaterThan(0)
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
    const openApp = vi.spyOn(os, 'openApp')
    item.onClick()
    expect(openApp).toHaveBeenCalledWith('erpnext') // the real new-window Handler, unchanged
    openApp.mockRestore()
  })

  it('keeps the re-titled item in the OS default\'s slot — still two divider groups, not three', () => {
    os.openApp('erpnext')
    const opts = fileMenuOptions(os)
    expect(opts.map((g) => g.group)).toEqual(['a', 'b']) // override inherits group 'a', no stray '' group
    expect(opts.find((g) => g.group === 'a').items.map((i) => i.label)).toEqual(['Open…', 'New ERPNext window'])
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
