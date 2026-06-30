// Minimal Frappe data layer for Frappe OS (ported from the /x shell's api.js).
// Reads go through whitelisted GET calls (no CSRF needed); writes use the REST
// resource API with the CSRF token from boot.
import type { ListFilters, FrappeDoc, GetListOptions, Contribution } from '@/types'

// The server seeds the CSRF token onto the global as a fallback for direct page loads.
declare global {
  interface Window {
    csrf_token?: string
  }
}

// The Frappe JSON envelope. `message`/`data` carry the method- or doctype-specific
// payload (genuinely dynamic, hence `any`); the rest surface server-side errors.
interface FrappeResponse {
  message?: any
  data?: any
  exception?: string
  _server_messages?: string
}

let csrfToken = ''
export function setCsrf(token: string): void {
  if (token) csrfToken = token
}
function getCsrf(): string {
  if (csrfToken) return csrfToken
  const injected = window.csrf_token
  return injected && !injected.includes('{{') ? injected : ''
}

async function parse(res: Response): Promise<FrappeResponse> {
  const data: FrappeResponse = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = data.exception || (data._server_messages ?? res.statusText)
    throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg))
  }
  return data
}

// Whitelisted method call over GET (reads only). The payload shape is method-specific,
// so callers narrow the `any`.
export async function call(method: string, params: Record<string, unknown> = {}): Promise<any> {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    qs.set(k, typeof v === 'string' ? v : JSON.stringify(v))
  }
  const res = await fetch(`/api/method/${method}?${qs.toString()}`, {
    headers: { Accept: 'application/json' },
  })
  return (await parse(res)).message
}

// Whitelisted method call over POST (writes) — CSRF-signed like the REST writes. Used by the
// placement write seam (ADR-0023) where the GET `call` won't do for a mutating method.
export async function callPost(method: string, params: Record<string, unknown> = {}): Promise<any> {
  const res = await fetch(`/api/method/${method}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-Frappe-CSRF-Token': getCsrf(),
    },
    body: JSON.stringify(params),
  })
  return (await parse(res)).message
}

export async function getList(
  doctype: string,
  { fields, limit = 50, start = 0, order_by = 'modified desc', filters }: GetListOptions = {},
): Promise<FrappeDoc[]> {
  return call('frappe.client.get_list', {
    doctype,
    fields: fields || ['name'],
    limit_page_length: limit,
    limit_start: start,
    order_by,
    ...(filters ? { filters } : {}),
  })
}

export async function getDoc(doctype: string, name: string): Promise<FrappeDoc> {
  const res = await fetch(`/api/resource/${encodeURIComponent(doctype)}/${encodeURIComponent(name)}`, {
    headers: { Accept: 'application/json' },
  })
  return (await parse(res)).data
}

export async function saveDoc(
  doctype: string,
  name: string,
  changes: Record<string, unknown>,
): Promise<FrappeDoc> {
  const res = await fetch(`/api/resource/${encodeURIComponent(doctype)}/${encodeURIComponent(name)}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-Frappe-CSRF-Token': getCsrf(),
    },
    body: JSON.stringify(changes),
  })
  return (await parse(res)).data
}

export async function createDoc(
  doctype: string,
  values: Record<string, unknown>,
): Promise<FrappeDoc> {
  const res = await fetch(`/api/resource/${encodeURIComponent(doctype)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-Frappe-CSRF-Token': getCsrf(),
    },
    body: JSON.stringify(values),
  })
  return (await parse(res)).data
}

// Lean field descriptors (grouped by Section Break) for building the form layout.
export async function getDoctypeMeta(doctype: string): Promise<any> {
  return call('frappe.www.os.get_doctype_meta', { doctype })
}

// Registry contributions for ONE uncurated doctype, resolved on demand so a deep link to any
// DocType opens its list (the boot registry only ships the curated set). Null when the doctype
// is missing or the user may not read it — the caller then falls back to the app's default window.
export async function resolveDoctype(doctype: string): Promise<Contribution[] | null> {
  return call('frappe.www.os.resolve_doctype', { doctype })
}

// Live dashboard card value: a count, or a sum of `fieldname` when given.
export async function cardValue(
  doctype: string,
  filters?: ListFilters,
  fieldname?: string,
): Promise<number> {
  return call('frappe.www.os.card_value', {
    doctype,
    ...(filters ? { filters } : {}),
    ...(fieldname ? { fieldname } : {}),
  })
}
