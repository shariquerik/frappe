// Boot payload for Frappe OS. In production www/os.py injects window.user,
// window.csrf_token, window.registry and window.permissions into the page. In Vite
// dev those globals are absent, so we fetch the same payload from the whitelisted
// boot() method. Either way we seed api.js's CSRF token for writes.

import { call, setCsrf } from '@/api'
import type { BootData } from '@/types'

let cached: BootData | null = null

// The injected globals are untyped page-scope values, so read window through `any`
// and coerce defensively — a missing or template-literal token degrades to ''.
function fromWindow(): BootData {
  const w = window as any
  const token: unknown = w.csrf_token
  return {
    user: w.user || null,
    csrf_token: typeof token === 'string' && !token.includes('{{') ? token : '',
    roles: Array.isArray(w.roles) ? w.roles : [],
    registry: w.registry || [],
    permissions: w.permissions || {},
  }
}

export async function getBoot(): Promise<BootData> {
  if (cached) return cached
  const injected = fromWindow()
  cached = injected.user ? injected : ((await call('frappe.www.os.boot')) as BootData)
  setCsrf(cached.csrf_token)
  return cached
}

export { setCsrf }
