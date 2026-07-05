// The boot payload's session predicate: does the resolved user represent a real logged-in session,
// or the anonymous Guest / a missing user? main.ts redirects the latter to /login (the Vite dev
// server serves the shell ungated, so the client re-checks what www/os.py enforces server-side).
import { describe, expect, it } from 'vitest'
import { isRealUser } from '@/data/boot'

describe('isRealUser', () => {
  it('is true for a real logged-in user', () => {
    expect(isRealUser('jane@example.com')).toBe(true)
    expect(isRealUser('Administrator')).toBe(true)
  })

  it('is false for the Guest sentinel', () => {
    expect(isRealUser('Guest')).toBe(false)
  })

  it('is false for a missing user', () => {
    expect(isRealUser(null)).toBe(false)
    expect(isRealUser(undefined)).toBe(false)
    expect(isRealUser('')).toBe(false)
  })
})
