// The fixture-app contribution suite (issue 10): the "Acme" app (tests/fixtures/fixture-app) played
// end to end through the PUBLIC pipeline — registry fold → merged() → projectRegion → the render
// projectors (menuOptions / toolbarItems) and useRegistry().menus. No resolver internals are imported
// (no resolve/specificity/compareActions): every axis is asserted on the rendered projection and on
// the loud shadow warnings, the exact surface a shipped app is judged by. This is the regression net
// the whole menubar-actions folder lands on — freeze the axes, prove them once against a second app.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { menuOptions } from '../src/actions/menubar'
import { toolbarItems } from '../src/actions/toolbar'
import { WINDOW_REGION, FORM_TOOLBAR } from '../src/actions/regions'
import { registerRunHandlers } from '../src/actions/contributions'
import { useOS } from '../src/desktop/index'
import { initRegistry, useRegistry, registerScopedContributions } from '../src/registry'
import {
  ACME, ACME_REPORTS, ACME_TOOLS, ACME_TASK, ACME_NOTE,
  RUN_NOOP, RUN_CLOSE, fixtureBoot, userReRenderClose, acmeTaskSlice,
} from './fixtures/fixture-app/index.js'

const os = useOS()

// Reset the desktop + re-seed the registry from the fixture boot before each case (⊕ any extra the
// case composes). A console.warn spy is installed everywhere because the shadow log IS the public
// evidence of a competition — an axis test that ignored it would assert the winner but not the honesty.
function setup(extra = []) {
  os.state.windows = []; os.state.geo = {}; os.state.selection = {}
  os.state.focusKind = {}; os.state.activeId = null; os.state.paletteOpen = false
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ message: [] }) })))
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  registerRunHandlers({ [RUN_NOOP]: () => {}, [RUN_CLOSE]: () => {} })
  initRegistry(fixtureBoot(extra))
  return warn
}

// A shadow log line is one console.warn call; assert a SINGLE line carries every substring (reason +
// exact region/command + apps), so a same-reason shadow of a different slot can't satisfy the check.
const warnedLine = (warn, ...subs) => warn.mock.calls.some(([line]) => subs.every((s) => String(line).includes(s)))

const windowLabels = () => menuOptions(WINDOW_REGION, os).flatMap((g) => g.items).map((i) => i.label)
const reportsLabels = () => menuOptions(ACME_REPORTS, os).flatMap((g) => g.items).map((i) => i.label)
const formToolbarLabels = () => [...toolbarItems(FORM_TOOLBAR, os).map((i) => i.label)].sort()

// App-menu ownership validation + earned rendering (ADR-0039): a menu whose target is no OS app is
// dropped at fold time; a declared-but-itemless menu never earns a title.
describe('fixture app — app-declared menus (ownership validation + earned rendering)', () => {
  let warn
  beforeEach(() => { warn = setup() })
  afterEach(() => { warn.mockRestore(); vi.unstubAllGlobals(); initRegistry(null) })

  it('drops a menu whose target is not a real OS app, loudly', () => {
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('ghost'))
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('nonesuch'))
  })

  it('keeps only the valid menus, in declared order — the ghost never enters the registry', () => {
    const declared = useRegistry().menus(ACME)
    expect(declared.map((m) => m.id)).toEqual(['reports', 'tools'])
    expect(declared.map((m) => m.title)).toEqual(['Reports', 'Tools'])
  })

  it('earns the Reports menu when Acme is focused (a real eligible item resolves)', () => {
    os.openApp(ACME)
    expect(reportsLabels()).toEqual(['Pipeline Report'])
  })

  it('never earns the itemless Tools menu — an empty menu projects to nothing', () => {
    os.openApp(ACME)
    expect(menuOptions(ACME_TOOLS, os)).toEqual([])
  })

  it('hides the Reports menu when another app is focused (earned per Context)', () => {
    os.openApp('frappe')
    expect(menuOptions(ACME_REPORTS, os)).toEqual([])
  })
})

// Command identity fold (project.ts, ADR-0014): first-seen wins, so an app cannot silently replace an
// OS verb's Handler. Acme re-declares frappe.window.new — the OS keeps the handler, Acme loses loudly.
describe('fixture app — command identity fold (first-seen-wins protects the OS verb)', () => {
  let warn
  beforeEach(() => { warn = setup() })
  afterEach(() => { warn.mockRestore(); vi.unstubAllGlobals(); initRegistry(null) })

  it('logs a command-collision when Acme re-declares a first-party verb id', () => {
    os.openApp(ACME)
    windowLabels() // force merged()/projectRegion, which builds the id map
    expect(warnedLine(warn, 'command-collision', 'frappe.window.new')).toBe(true)
  })

  it('keeps the real OS Handler despite the collision — clicking New still runs the OS verb', () => {
    os.openApp(ACME)
    const item = menuOptions(WINDOW_REGION, os).flatMap((g) => g.items).find((i) => i.label === 'New Acme window')
    const newAppWindow = vi.spyOn(os, 'newAppWindow')
    item.onClick()
    expect(newAppWindow).toHaveBeenCalledWith(ACME) // the OS new-window Handler, not Acme's hijack ref
    newAppWindow.mockRestore()
  })
})

// commandPatch (ADR-0007): a presentation patch that applies ONLY in the context its Action wins.
describe('fixture app — commandPatch (contextual re-title, applied only when it wins)', () => {
  let warn
  beforeEach(() => { warn = setup() })
  afterEach(() => { warn.mockRestore(); vi.unstubAllGlobals(); initRegistry(null) })

  it('re-titles New window while Acme is focused', () => {
    os.openApp(ACME)
    expect(windowLabels()).toContain('New Acme window')
  })

  it('shows the OS default title while another app is focused (the patch is ineligible)', () => {
    os.openApp('frappe')
    expect(windowLabels()).toContain('New window')
    expect(windowLabels()).not.toContain('New Acme window')
  })
})

// Removal + shadow (ADR-0014): a winning `removed` suppresses the slot and logs a `removal` shadow,
// attributed to the removing app — never a silent drop.
describe('fixture app — removal (suppress a chrome slot + a logged removal shadow)', () => {
  let warn
  beforeEach(() => { warn = setup() })
  afterEach(() => { warn.mockRestore(); vi.unstubAllGlobals(); initRegistry(null) })

  it('suppresses Close window while Acme is focused', () => {
    os.openApp(ACME)
    expect(windowLabels()).not.toContain('Close window')
  })

  it('logs the strip as a removal shadow of Close window, attributed to Acme', () => {
    os.openApp(ACME)
    windowLabels()
    expect(warnedLine(warn, 'removal', 'frappe.window.close', ACME)).toBe(true)
  })

  it('leaves Close window intact while another app is focused (the removal is ineligible)', () => {
    os.openApp('frappe')
    expect(windowLabels()).toContain('Close window')
  })
})

// Layer override / reversibility (ADR-0014): a User-layer Action (identical `when`, so LAYER alone
// decides) outranks the app's removal and re-renders the item — an app never has the final word.
describe('fixture app — layer override (a User layer reverses an app removal)', () => {
  let warn
  beforeEach(() => { warn = setup([userReRenderClose]) })
  afterEach(() => { warn.mockRestore(); vi.unstubAllGlobals(); initRegistry(null) })

  it('brings Close window back — the higher, non-removed layer wins', () => {
    os.openApp(ACME)
    expect(windowLabels()).toContain('Close window')
  })

  it('logs Close window as a clean override, not a removal — the User layer strictly outranks it', () => {
    os.openApp(ACME)
    windowLabels()
    expect(warnedLine(warn, 'override', 'frappe.window.close')).toBe(true)
    expect(warnedLine(warn, 'removal', 'frappe.window.close')).toBe(false) // the removal now loses, so no strip
  })
})

// Scope carry-forward (ADR-0032): Acme's broad app-scoped Close default rides every Acme form; a
// doctype-scoped override (delivered on live meta) is more specific and wins on Acme Task alone.
describe('fixture app — scope carry-forward (doctype override beats the app-scoped default)', () => {
  let warn
  beforeEach(() => {
    warn = setup()
    registerScopedContributions(ACME_TASK, acmeTaskSlice()) // the Doctype/View delivery half (opening the doctype)
  })
  afterEach(() => { warn.mockRestore(); vi.unstubAllGlobals(); initRegistry(null) })

  it('renders only the broad default on a doctype with no scoped slice', () => {
    os.openRecordGlobal(ACME_NOTE, 'NOTE-0001')
    expect(formToolbarLabels()).toEqual(['Close Task'])
  })

  it('lets the doctype-scoped override win on Acme Task, and adds the doctype-scoped server verb', () => {
    os.openRecordGlobal(ACME_TASK, 'TASK-0001')
    expect(formToolbarLabels()).toEqual(['Close this Task', 'Make Delivery'])
    expect(formToolbarLabels()).not.toContain('Close Task') // the broad default was carried forward, not doubled
  })

  it('wires the doctype-scoped verb to its Command Handler', () => {
    let closed = false
    registerRunHandlers({ [RUN_CLOSE]: () => { closed = true } })
    os.openRecordGlobal(ACME_TASK, 'TASK-0002')
    toolbarItems(FORM_TOOLBAR, os).find((i) => i.label === 'Close this Task').onClick()
    expect(closed).toBe(true)
  })
})

// Foreign focusKind-namespace warn (ADR-0038): Acme gates an item on raven's private kind — a static
// bug the resolver warns on, without ever rendering the item.
describe('fixture app — foreign focusKind namespace (warned, never rendered)', () => {
  let warn
  beforeEach(() => { warn = setup() })
  afterEach(() => { warn.mockRestore(); vi.unstubAllGlobals(); initRegistry(null) })

  it('warns on the foreign kind when the menu resolves, and never renders the gated item', () => {
    os.openApp(ACME)
    expect(reportsLabels()).toEqual(['Pipeline Report']) // Audit Trail stays out — its kind never matches
    expect(warnedLine(warn, 'foreign kind', 'raven', ACME)).toBe(true)
  })
})
