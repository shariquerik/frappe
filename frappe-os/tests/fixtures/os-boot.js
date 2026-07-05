// Shared boot fixture for offline unit tests (ADR-0042). Since the curated AppDef.modules hardcode
// was retired, doctype→app ownership and workspace grouping come ONLY from boot workspace data — so
// an offline `initRegistry(null)` owns nothing and lists no workspaces. Specs that need real
// app/doctype identity seed this instead: `initRegistry(bootWith())`.
//
// The workspace map mirrors the shape the server delivers (os_core/workspaces.py): real slug ids
// (`frappe.scrub(module)`), a default flag, and the module's doctype set. Production CRM ships ONE
// real workspace (`fcrm`); the fixture adds a second synthetic group so crm stays multi-workspace and
// `openApp('crm')` keeps opening the plain `app:crm` window the routing/store specs assert (a
// single-workspace app skips the hub — a distinct code path those specs don't exercise). Only `fcrm`
// and the ownership it implies are ever asserted; the extra group and the frappe/erpnext ids exist
// only to give the specs' doctypes a home.

export const OS_WORKSPACES = {
  frappe: [
    { id: 'core', label: 'Core', isDefault: true, doctypes: ['User', 'Role', 'ToDo', 'File', 'Notification Log', 'Comment'] },
    { id: 'website', label: 'Website', isDefault: false, doctypes: ['Web Page', 'Blog Post'] },
  ],
  crm: [
    { id: 'fcrm', label: 'CRM', isDefault: true, doctypes: ['CRM Lead', 'CRM Deal', 'Contact', 'CRM Organization'] },
    { id: 'fcrm_activity', label: 'Activity', isDefault: false, doctypes: ['CRM Task', 'Note'] },
  ],
  erpnext: [
    { id: 'selling', label: 'Selling', isDefault: true, doctypes: ['Sales Invoice', 'Sales Order', 'Quotation', 'Customer'] },
    { id: 'stock', label: 'Stock', isDefault: false, doctypes: ['Item', 'Warehouse', 'Stock Entry', 'Delivery Note'] },
  ],
}

// Display names for the first-party apps — the server `name` wins over curated branding in the
// overlay merge, so set it correctly; an unknown app id falls back to the id itself.
const APP_NAMES = { frappe: 'Frappe', crm: 'CRM', erpnext: 'ERPNext' }

// One `app` contribution per fixture app, in registry order. The payload is minimal `{ id, name }` on
// purpose: the overlay merges curated branding (glyph/hex/logo/cards from config/apps.ts) OVER it, so
// a fixture app renders with its real branding. The contribution's presence lets the workspace fold
// own the app's doctypes (it only owns apps in the index) and feeds `useRegistry().apps()`.
const appContribution = (id, order) => ({
  type: 'app', target: '', name: id, sourceApp: id, order,
  payload: { id, name: APP_NAMES[id] ?? id },
})

// A DISPLAY contribution per workspace doctype, attributed to its app — mirrors what the server sends
// (a doctype's meta with `_app_of` ownership). Gives `getMeta(doctype)` a hit offline (so the
// route-map `knownDoctype` guard passes) and seeds ownership directly, the same as production.
function displayContributions(workspaces) {
  const out = []
  const seen = new Set()
  for (const [appId, groups] of Object.entries(workspaces)) {
    for (const group of groups) {
      for (const doctype of group.doctypes) {
        if (seen.has(doctype)) continue
        seen.add(doctype)
        out.push({ type: 'display-config', target: doctype, name: 'display', sourceApp: appId, payload: { label: doctype } })
      }
    }
  }
  return out
}

// A BootData whose registry carries the fixture apps + their doctype DISPLAY contributions, and whose
// `workspaces` seeds grouping. Pass a custom workspace map to vary the fixture; pass explicit
// `contributions` to bypass the derived app/display set entirely.
export function bootWith(workspaces = OS_WORKSPACES, contributions) {
  const apps = Object.keys(workspaces).map(appContribution)
  const contribs = contributions ?? [...apps, ...displayContributions(workspaces)]
  return {
    user: 'a', csrf_token: 't', roles: [], permissions: {},
    registry: { schemaVersion: 1, contributions: contribs },
    workspaces,
  }
}
