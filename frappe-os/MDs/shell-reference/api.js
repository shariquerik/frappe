// Minimal Frappe data layer for the shell.
// Reads go through whitelisted GET calls (no CSRF needed); writes use the REST
// resource API with the CSRF token from boot.

let csrfToken = ''
export function setCsrf(token) {
  if (token) csrfToken = token
}
function getCsrf() {
  if (csrfToken) return csrfToken
  const injected = window.csrf_token
  return injected && !injected.includes('{{') ? injected : ''
}

async function parse(res) {
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = data.exception || (data._server_messages ?? res.statusText)
    throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg))
  }
  return data
}

// Whitelisted method call over GET (reads only).
export async function call(method, params = {}) {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    qs.set(k, typeof v === 'string' ? v : JSON.stringify(v))
  }
  const res = await fetch(`/api/method/${method}?${qs.toString()}`, {
    headers: { Accept: 'application/json' },
  })
  return (await parse(res)).message
}

export async function getList(doctype, { fields, limit = 50, order_by = 'modified desc', filters } = {}) {
  return call('frappe.client.get_list', {
    doctype,
    fields: fields || ['name'],
    limit_page_length: limit,
    order_by,
    ...(filters ? { filters } : {}),
  })
}

export async function getDoc(doctype, name) {
  const res = await fetch(`/api/resource/${encodeURIComponent(doctype)}/${encodeURIComponent(name)}`, {
    headers: { Accept: 'application/json' },
  })
  return (await parse(res)).data
}

export async function updateDoc(doctype, name, changes) {
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

export async function createDoc(doctype, values) {
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
