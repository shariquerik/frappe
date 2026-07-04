// Boot payload for Frappe OS. In production www/os.py injects window.user,
// window.csrf_token, window.registry and window.permissions into the page. In Vite
// dev those globals are absent, so we fetch the same payload from the whitelisted
// boot() method. Either way we seed api.js's CSRF token for writes.

import { call, setCsrf } from './api'
import type { BootData } from '@/types'

let cached: BootData | null = null

// The injected globals are untyped page-scope values, so read window through `any`
// and coerce defensively — a missing or template-literal token degrades to ''.
function fromWindow(): BootData {
  const w = window as any
  const token: unknown = w.csrf_token
  return {
    user: w.user || null,
    user_fullname: typeof w.user_fullname === 'string' ? w.user_fullname : '',
    csrf_token: typeof token === 'string' && !token.includes('{{') ? token : '',
    roles: Array.isArray(w.roles) ? w.roles : [],
    registry: w.registry || [],
    permissions: w.permissions || {},
    placements: Array.isArray(w.placements) ? w.placements : [],
    recents: Array.isArray(w.recents) ? w.recents : [],
    // The per-app workspace lists (ADR-0042). Tolerated defensively — an older server / offline
    // boot omits it, so workspace resolution degrades to the curated AppDef.modules fallback.
    workspaces: w.workspaces && typeof w.workspaces === 'object' ? w.workspaces : {},
    // Wallpaper catalog + the chosen wallpaper name (ADR-0036); tolerated defensively so an older
    // server / offline boot degrades to the built-in default rather than throwing.
    wallpapers: Array.isArray(w.wallpapers) ? w.wallpapers : [],
    wallpaper: typeof w.wallpaper === 'string' ? w.wallpaper : null,
    // Realtime coordinates (data/realtime.ts). Injected as window globals in production;
    // read defensively so an older server / offline boot degrades to no live refresh.
    sitename: typeof w.sitename === 'string' ? w.sitename : undefined,
    socketio_port: typeof w.socketio_port === 'number' ? w.socketio_port : undefined,
    developer_mode: !!w.developer_mode,
    // Framework version for the About dialog (ADR-0039); tolerated like sitename so an older
    // server / offline boot simply shows no version line.
    version: typeof w.version === 'string' ? w.version : undefined,
  }
}

export async function getBoot(): Promise<BootData> {
  if (cached) return cached
  const injected = fromWindow()
  cached = injected.user ? injected : ((await call('frappe.os_core.boot.boot')) as BootData)
  setCsrf(cached.csrf_token)
  return cached
}

export { setCsrf }
