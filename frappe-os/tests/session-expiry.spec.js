// The session-expiry seam: the pure predicate that tells a dropped session apart from an ordinary
// error, and the wired-handler port api.ts fires when it spots one. Backend-free — the predicate is
// a plain decision table over the response fields Frappe sets (status, session_expired, exc_type).
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { isSessionExpired, setOnSessionExpired, onSessionExpired } from '@/data/session-expiry'

describe('isSessionExpired', () => {
  it('treats HTTP 401 as a lost session', () => {
    expect(isSessionExpired({ status: 401 })).toBe(true)
  })

  it('treats the session_expired body flag as a lost session, even on a 403', () => {
    // A stale sid cookie proceeds as Guest and can surface as 403, but the flag is set (sessions.py).
    expect(isSessionExpired({ status: 403, session_expired: 1 })).toBe(true)
  })

  it('treats SessionExpired / AuthenticationError exc_type as a lost session', () => {
    expect(isSessionExpired({ status: 403, exc_type: 'SessionExpired' })).toBe(true)
    expect(isSessionExpired({ status: 401, exc_type: 'AuthenticationError' })).toBe(true)
  })

  it('does NOT treat a PermissionError (logged in, no rights) as a lost session', () => {
    expect(isSessionExpired({ status: 403, exc_type: 'PermissionError' })).toBe(false)
  })

  it('does NOT treat other server errors or an ok response as a lost session', () => {
    expect(isSessionExpired({ status: 500, exc_type: 'ValidationError' })).toBe(false)
    expect(isSessionExpired({ status: 200 })).toBe(false)
  })
})

describe('onSessionExpired port', () => {
  beforeEach(() => setOnSessionExpired(() => {}))

  it('fires the wired handler', () => {
    const react = vi.fn()
    setOnSessionExpired(react)
    onSessionExpired()
    expect(react).toHaveBeenCalledOnce()
  })

  it('is a silent no-op until a handler is wired', () => {
    expect(() => onSessionExpired()).not.toThrow()
  })
})
