// useAccount() — the own-user Account composable over api.ts (the app wires no frappe-ui
// resource). api.ts + boot are mocked, so these pin the composable's contract without a
// backend: the permlevel-0 save allow-list (the security guard), the load lifecycle, and the
// write-through that replaces the cached doc. The allow-list test is the one issue 02 requires
// — a save must never carry roles / user_type / enabled past the permlevel-0 fence.
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/data/api', () => ({
  getDoc: vi.fn(),
  saveDoc: vi.fn(),
  callPost: vi.fn(),
}))
// Stub only getBoot (the network read); keep the real isGuest — it's pure session logic.
vi.mock('@/data/boot', async (importOriginal) => ({
  ...(await importOriginal()),
  getBoot: vi.fn(),
}))

import * as api from '@/data/api'
import { getBoot } from '@/data/boot'
import { pickWritable, WRITABLE_FIELDS, useAccount, changePassword } from '../src/data/account'

beforeEach(() => {
  vi.clearAllMocks()
  // Reset the module-singleton state between tests by clearing the cached doc.
  useAccount().state.doc = null
})

describe('pickWritable — the permlevel-0 allow-list', () => {
  it('keeps only first_name / last_name / user_image', () => {
    expect(WRITABLE_FIELDS).toEqual(['first_name', 'last_name', 'user_image'])
  })

  it('strips privileged / read-only fields a caller or stray bind might smuggle in', () => {
    const out = pickWritable({
      first_name: 'Riya',
      last_name: 'Shah',
      user_image: '/files/r.png',
      roles: [{ role: 'System Manager' }],
      user_type: 'System User',
      enabled: 1,
      full_name: 'hacked',
      api_key: 'secret',
    })
    expect(out).toEqual({ first_name: 'Riya', last_name: 'Shah', user_image: '/files/r.png' })
  })

  it('omits writable fields that were not supplied (no undefined keys)', () => {
    expect(pickWritable({ first_name: 'Riya' })).toEqual({ first_name: 'Riya' })
  })
})

describe('load — reads the session user’s own User doc', () => {
  it('fetches the boot user and stores the doc', async () => {
    getBoot.mockResolvedValue({ user: 'riya@example.com' })
    api.getDoc.mockResolvedValue({ name: 'riya@example.com', first_name: 'Riya' })
    const account = useAccount()
    await account.load()
    expect(api.getDoc).toHaveBeenCalledWith('User', 'riya@example.com')
    expect(account.state.doc).toEqual({ name: 'riya@example.com', first_name: 'Riya' })
  })

  it('records the error and leaves no doc on failure', async () => {
    getBoot.mockResolvedValue({ user: 'riya@example.com' })
    api.getDoc.mockRejectedValue(new Error('403'))
    const account = useAccount()
    await account.load()
    expect(account.state.error).toBe('403')
    expect(account.state.doc).toBe(null)
  })

  it.each([{ user: null }, { user: 'Guest' }])(
    'guards a broken session (%o) — errors, never fetches',
    async (boot) => {
      getBoot.mockResolvedValue(boot)
      const account = useAccount()
      await account.load()
      expect(api.getDoc).not.toHaveBeenCalled()
      expect(account.state.error).toBe('No session user to load an account for')
      expect(account.state.doc).toBe(null)
    },
  )
})

describe('save — only the allow-list reaches the wire', () => {
  it('PUTs just the permlevel-0 fields and caches the returned doc', async () => {
    getBoot.mockResolvedValue({ user: 'riya@example.com' })
    api.getDoc.mockResolvedValue({ name: 'riya@example.com', first_name: 'Riya' })
    const account = useAccount()
    await account.load()

    const saved = { name: 'riya@example.com', first_name: 'Riya', last_name: 'Shah', full_name: 'Riya Shah' }
    api.saveDoc.mockResolvedValue(saved)
    await account.save({ first_name: 'Riya', last_name: 'Shah', roles: [{ role: 'System Manager' }] })

    expect(api.saveDoc).toHaveBeenCalledWith('User', 'riya@example.com', { first_name: 'Riya', last_name: 'Shah' })
    expect(account.state.doc).toEqual(saved)
  })

  it('is a no-op when nothing in the allow-list changed', async () => {
    getBoot.mockResolvedValue({ user: 'riya@example.com' })
    api.getDoc.mockResolvedValue({ name: 'riya@example.com' })
    const account = useAccount()
    await account.load()
    await account.save({ roles: [{ role: 'System Manager' }], enabled: 1 })
    expect(api.saveDoc).not.toHaveBeenCalled()
  })
})

describe('changePassword — rides the rate-limited whitelisted method', () => {
  it('POSTs both passwords as snake_case params, not a doc save', async () => {
    api.callPost.mockResolvedValue(null)
    await changePassword('old-secret', 'new-secret')
    expect(api.callPost).toHaveBeenCalledWith('frappe.os_core.account.change_password', {
      old_password: 'old-secret',
      new_password: 'new-secret',
    })
    expect(api.saveDoc).not.toHaveBeenCalled()
  })

  it('propagates a server rejection (wrong current password / rate-limited)', async () => {
    api.callPost.mockRejectedValue(new Error('Incorrect User or Password'))
    await expect(changePassword('wrong', 'new-secret')).rejects.toThrow('Incorrect User or Password')
  })
})
