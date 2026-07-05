// Recognising that the server has dropped our session mid-run, and reacting to it. The shell boots
// only for a real user (www/os.py redirects Guest to /login), but a long-lived tab can outlive its
// session — the cookie expires, or the user logs out in another tab. From then on every API call
// comes back as Guest. This port lets the low-level data layer (api.ts) spot that response and fire
// a handler the app wires in at boot (main.ts → redirectToLogin), WITHOUT api.ts importing the
// session/router layer (which would cycle). Silent no-op until wired (offline dev, tests). Mirrors
// the notify port next door.

// The response fields Frappe sets when a session is no longer valid. HTTP 401 carries
// SessionExpired / AuthenticationError (frappe/exceptions.py); `session_expired` is flagged on the
// body whenever the sid cookie is stale (frappe/sessions.py); `exc_type` names the raised exception
// in the v1 error body (frappe/utils/response.py). A PermissionError (403) is deliberately EXCLUDED
// — that is a logged-in user lacking rights on one doctype, not a lost session.
export interface SessionSignal {
  status: number
  session_expired?: number
  exc_type?: string
}

const EXPIRED_EXC_TYPES = ['SessionExpired', 'AuthenticationError']

// Pure so the decision table is unit-tested without a backend (tests/session-expiry.spec.js).
export function isSessionExpired(signal: SessionSignal): boolean {
  return (
    signal.status === 401 ||
    signal.session_expired === 1 ||
    (typeof signal.exc_type === 'string' && EXPIRED_EXC_TYPES.includes(signal.exc_type))
  )
}

type Handler = () => void

let handler: Handler = () => {}

// Wire the concrete reaction (redirectToLogin) once boot resolves.
export function setOnSessionExpired(fn: Handler): void {
  handler = fn
}

// Fire whatever the app wired in. No-op until setOnSessionExpired runs. The handler is expected to
// be idempotent (redirectToLogin guards itself) since a burst of parallel requests can all fail.
export function onSessionExpired(): void {
  handler()
}
