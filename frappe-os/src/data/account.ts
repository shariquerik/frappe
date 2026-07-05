// useAccount() — the logged-in user's own Account, backed by the app's data layer (api.ts),
// not a frappe-ui resource (this app wires none). The composable exists so the Account pane
// never depends on the data source (ADR-0027).
//
// A non-admin may read/write their OWN User doc through the *standard* save path: on creation
// `User.share_with_self()` grants a self-DocShare (write=1), so the REST PUT in `saveDoc`
// succeeds without System Manager — with **permlevel** still gating fields. We therefore
// persist only the permlevel-0 identity fields; `roles` / `user_type` / `enabled` / API keys
// are permlevel 1 or read-only and are stripped before the write (pickWritable).
import { reactive } from 'vue'
import { callPost, getDoc, saveDoc } from '@/data/api'
import { getBoot, isRealUser } from '@/data/boot'
import type { FrappeDoc } from '@/types'

// The only User fields the self-DocShare can persist at permlevel 0. `full_name` is read-only
// (server-computed from first/last); `roles` / `user_type` live at permlevel 1.
export const WRITABLE_FIELDS = ['first_name', 'last_name', 'user_image'] as const
export type AccountField = (typeof WRITABLE_FIELDS)[number]

// Keep only the permlevel-0 fields, so neither a caller nor a stray two-way bind can smuggle a
// privileged field (roles, user_type, enabled) into the save payload. The allow-list is the
// guard — not the caller's discipline.
export function pickWritable(changes: Record<string, unknown>): Partial<Record<AccountField, unknown>> {
  const out: Partial<Record<AccountField, unknown>> = {}
  for (const field of WRITABLE_FIELDS) {
    if (field in changes) out[field] = changes[field]
  }
  return out
}

interface AccountState {
  doc: FrappeDoc | null
  loading: boolean
  saving: boolean
  error: string | null
}

// Module singleton (like the records caches): every Settings ▸ Account pane shares one doc.
const state = reactive<AccountState>({ doc: null, loading: false, saving: false, error: null })

// Read the session user's own User doc once; pass force to re-read after a save elsewhere.
async function load(force = false): Promise<void> {
  if (state.loading || (state.doc && !force)) return
  state.loading = true
  state.error = null
  try {
    // /os redirects Guest to /login before the shell boots, so a real user is expected — but
    // guard anyway: a missing user, or the "Guest" sentinel, is a broken session (no own account
    // to load), not a User doc to fetch.
    const { user } = await getBoot()
    if (!isRealUser(user)) throw new Error('No session user to load an account for')
    state.doc = await getDoc('User', user)
  } catch (e) {
    state.error = (e as Error).message
  } finally {
    state.loading = false
  }
}

// Persist a subset of the identity fields, dropping anything outside the allow-list first.
// The saved doc (full_name recomputed server-side) replaces the cached one.
async function save(changes: Record<string, unknown>): Promise<void> {
  const name = state.doc?.name
  if (!name) return
  const payload = pickWritable(changes)
  if (!Object.keys(payload).length) return
  state.saving = true
  state.error = null
  try {
    state.doc = await saveDoc('User', name, payload)
  } catch (e) {
    state.error = (e as Error).message
    throw e
  } finally {
    state.saving = false
  }
}

// Change the session user's own password. Not a doc save: it rides the rate-limited
// `change_password` whitelisted method, which verifies the old password server-side (a wrong
// current password or a rate-limit hit rejects with a message the dialog surfaces).
export async function changePassword(oldPassword: string, newPassword: string): Promise<void> {
  await callPost('frappe.os_core.account.change_password', { old_password: oldPassword, new_password: newPassword })
}

export function useAccount() {
  return { state, load, save }
}
