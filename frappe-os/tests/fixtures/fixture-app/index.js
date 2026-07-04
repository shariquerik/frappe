// A test-only app — "Acme" — that plays a REAL app end to end through the public contribution
// pipeline (registry fold → merged() → projectRegion), the regression net every menubar-actions
// slice lands on (issue 10). It is DATA, not resolver inputs: a boot registry of app/command/action/
// app-menu contributions plus a server handler, a scoped live-meta slice, and workspace-gated
// placements — the same shapes a shipped app's manifest carries. No axis is hand-built against the
// resolver; specs feed this through initRegistry and read the rendered projection.
//
// Casing is OS-authored camelCase / dotted ids (acme.report.pipeline); the ONE snake_case boundary
// is the server handler's whitelisted `method` and the coordinate args it receives (Frappe-native).

export const ACME = 'acme'

// The app-declared menu Regions (ADR-0039 rule 2) — literal strings, exactly as a manifest ships
// them (`menubar:app:<owningApp>:<menuId>`). REPORTS earns items; TOOLS is declared but never earns.
export const ACME_REPORTS = 'menubar:app:acme:reports'
export const ACME_TOOLS = 'menubar:app:acme:tools'

// Two doctypes Acme owns (its module lists them, so appForDoctype resolves them to Acme and a form
// context carries activeApp:'acme'). TASK gets a live-meta slice; NOTE never does — the pair proves
// scope carry-forward (a doctype override on TASK vs Acme's broad app-scoped default on NOTE).
export const ACME_TASK = 'Acme Task'
export const ACME_NOTE = 'Acme Note'

// Acme's one module → its one workspace (slugified name, ADR-0040), the coordinate a workspace-gated
// placement gates on.
export const ACME_MODULE = 'Selling'
export const ACME_WORKSPACE = 'selling'

// The run-Handler refs Acme's `run` commands resolve by id (ADR-0037). Specs register trackers under
// these to prove a rendered item fires its verb; the fixture ships inert defaults for resolution-only
// cases.
export const RUN_NOOP = 'acme-noop'
export const RUN_CLOSE = 'acme-close'

// ── contribution factories (the manifest shapes, ADR-0007 identity tuple) ──────────────────
const app = (id, name, modules = []) => ({ type: 'app', target: '', name: id, sourceApp: id, payload: { id, name, modules } })
const command = (id, title, handler, sourceApp = ACME) => ({ type: 'command', target: '', name: id, sourceApp, payload: { id, sourceApp, title, handler } })
const action = (payload) => ({ type: 'action', target: payload.region, name: payload.command, sourceApp: payload.sourceApp, payload })
const menu = (id, title, target, order) => ({ type: 'app-menu', target, name: id, sourceApp: ACME, payload: { id, title, order } })

// ── commands (verbs, placement-agnostic) ───────────────────────────────────────────────────
const commands = [
  command('acme.report.pipeline', 'Pipeline Report', { kind: 'run', ref: RUN_NOOP }),
  // The foreign-kind carrier: gates on raven's private kind — a static bug the resolver warns on
  // (ADR-0038), never eligible here so it only ever earns the warning.
  command('acme.audit.trail', 'Audit Trail', { kind: 'run', ref: RUN_NOOP }),
  // The codeless server verb (ADR-0041): a whitelisted method + a declared after-effect, no client JS.
  command('acme.order.deliver', 'Make Delivery', { kind: 'server', method: 'acme.selling.make_delivery', then: 'notify' }),
  command('acme.task.close', 'Close Task', { kind: 'run', ref: RUN_CLOSE }),
  // The collision: Acme re-declares a first-party verb id. First-seen (the OS default) keeps the
  // handler + title; this loses loudly (project.ts command-collision), so an app can't hijack a verb.
  command('frappe.window.new', 'Acme New (hijack attempt)', { kind: 'run', ref: RUN_NOOP }),
]

// ── actions (placements, app layer, ride boot) ──────────────────────────────────────────────
const actions = [
  // A presentation Patch that wins only while an Acme window is focused (ADR-0007) — re-titles the
  // OS's New window without touching its Handler (the collision above protects that).
  action({ command: 'frappe.window.new', region: 'menubar:window', sourceApp: ACME, when: { activeApp: ACME }, commandPatch: { title: 'New Acme window' } }),
  // A REMOVAL (ADR-0014): Acme suppresses the OS Close window while focused — a winning `removed`
  // strips the slot and logs a `removal` shadow. Reversible: userReRenderClose (a User layer) undoes it.
  action({ command: 'frappe.window.close', region: 'menubar:window', sourceApp: ACME, when: { activeApp: ACME }, removed: true }),
  // Earns the Reports menu (app-scoped → eligible only while Acme is front).
  action({ command: 'acme.report.pipeline', region: ACME_REPORTS, sourceApp: ACME, scope: { tier: 'app', app: ACME } }),
  // Placed in Reports too but gated on a FOREIGN namespaced kind (raven's) — never eligible, always
  // warned. Reports still renders exactly Pipeline Report.
  action({ command: 'acme.audit.trail', region: ACME_REPORTS, sourceApp: ACME, when: { focusKind: 'raven.voice-note' } }),
  // Acme's BROAD default for its Close verb: app-scoped, so it rides every Acme form (incl. NOTE).
  action({ command: 'acme.task.close', region: 'form:toolbar', sourceApp: ACME, scope: { tier: 'app', app: ACME } }),
]

// ── app-declared menus (containers; earned by their items) ──────────────────────────────────
const menus = [
  menu('reports', 'Reports', ACME, 10),      // valid — target is a real OS app
  menu('tools', 'Tools', ACME, 20),          // valid but ITEMLESS → never earns a title
  menu('ghost', 'Ghost', 'nonesuch', 30),    // invalid — target is no OS app; dropped loudly (ADR-0039)
]

// The base contribution set: Acme ⊕ frappe (for the OS defaults it patches/removes/collides with).
export function fixtureContributions() {
  return [
    app('frappe', 'Frappe'),
    app('acme', 'Acme', [{ name: ACME_MODULE, doctypes: [ACME_TASK, ACME_NOTE] }]),
    ...commands, ...actions, ...menus,
  ]
}

// A boot payload seeded from the base set (⊕ any extra contributions a case composes in, e.g. the
// User-layer re-render). Same shape www/os.py injects.
export function fixtureBoot(extra = []) {
  return {
    user: 'acme-user', csrf_token: 't', roles: [], permissions: {},
    registry: { schemaVersion: 1, contributions: [...fixtureContributions(), ...extra] },
  }
}

// A User-layer re-render of Close window (ADR-0014): identical `when` to the app-layer removal, so
// the LAYER alone decides — User outranks App, the non-removed Action wins, the item returns. Kept
// out of the base so one boot shows the pure removal and boot ⊕ this shows a person overruling it.
export const userReRenderClose = action({
  command: 'frappe.window.close', region: 'menubar:window', sourceApp: ACME,
  when: { activeApp: ACME }, layer: 'user',
})

// Acme Task's live-meta slice (ADR-0032), delivered by registerScopedContributions when the doctype
// opens — the Doctype/View half of delivery-by-scope. A doctype-scoped override of Close (re-titled)
// and the doctype-scoped Make Delivery placement. On Acme Task both the broad app default and this
// narrower override compete; specificity carries the doctype one forward.
export function acmeTaskSlice() {
  return [
    action({ command: 'acme.task.close', region: 'form:toolbar', sourceApp: ACME, scope: { tier: 'doctype', doctype: ACME_TASK }, commandPatch: { title: 'Close this Task' } }),
    action({ command: 'acme.order.deliver', region: 'form:toolbar', sourceApp: ACME, scope: { tier: 'doctype', doctype: ACME_TASK } }),
  ]
}
