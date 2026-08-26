// The v2 boot: a NEW small payload, not frappe.sessions.get().
//
// #42070 §3 measured the existing boot at 147,711 bytes, ~120 KB of it desk v1
// workspace furniture. It is left untouched and retires with v1.

export type Boot = {
  // --- framework core ---
  frappe_version: string
  site_name: string
  socketio_port: number
  read_only_mode: boolean
  csrf_token: string
  setup_complete: boolean
  sysdefaults: Record<string, unknown>
  timezone: string
  user: { name: string; full_name: string; user_image?: string }
  translations_version: string

  // --- routing: the runtime answer to a question that used to be build-time ---
  //
  // `app_route` is THIS request's prefix. It replaces __FRONTEND_ROUTE__ (#42065).
  //
  // NOTE: `app_route` is the name the map's fog flags as already taken -- it exists
  // today as a derived boot key at frappe/boot.py:396-402, computed FROM
  // add_to_apps_screen[0].route and read by sidebar.js:1081-1086. This is a v2-only
  // boot, so the two never share a payload and the collision is survivable -- but the
  // scaffold cannot make it go away, and the fog says it must land before the skeleton.
  app_route: string
  app: string

  // Enough of the {prefix: app} registry to navigate out of here. What "enough" means
  // is #42102's -- crossing prefixes needs a boot re-fetch (#42070, handed onward),
  // so this may be a full page load rather than a router push.
  prefixes: Record<string, string>

  // --- the declaring app's contribution, merged under core (#42070 §4) ---
  // Core plus the declaring app only. Not every installed app.
  [appKey: string]: unknown
}

export async function fetchBoot(): Promise<Boot> {
  // Scoped to the requested prefix, because composition is prefix-dependent.
  // window.location.pathname is the only input the client has -- the document
  // carries nothing (see index.html).
  const res = await fetch(`/api/method/frappe.boot.v2.get_boot?path=${location.pathname}`)
  if (res.status === 403) throw new Error('unauthorized') // -> #42112
  return (await res.json()).message
}
