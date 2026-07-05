// Session-level exits from the OS shell: ending the session (logout) and handing back to classic
// Desk. Both are whole-page navigations — the shell is a server-rendered page at /os, so we leave it
// by setting window.location rather than routing inside the SPA. Kept out of account.ts: those are
// the user's *identity* (their own User doc); these are where the session *goes*.
import { callPost } from '@/data/api'

// End the Frappe session, then land on the login page. `logout` is the framework's whitelisted
// method; it clears the session cookie server-side before we navigate away.
export async function logout(): Promise<void> {
  await callPost('logout')
  window.location.href = '/login'
}

// Involuntary exit: the server dropped our session (expiry, or a logout in another tab), so every
// API call now returns as Guest. Leave for the login page, remembering where we were so the
// post-login redirect lands the user back on the same OS deep link — the same `redirect-to`
// contract www/os.py uses when a Guest cold-loads a deep link. Wired to the data layer's
// session-expiry port at boot (main.ts). Guarded so a burst of failing requests navigates once.
let leaving = false
export function redirectToLogin(): void {
  if (leaving) return
  leaving = true
  const here = window.location.pathname + window.location.search
  window.location.href = `/login?${new URLSearchParams({ 'redirect-to': here })}`
}

// Hand back to classic Desk and remember the choice, so the next login lands on Desk too. The
// symmetric partner of Desk's "Switch to OS" navbar action — both write the same per-user default.
export async function switchToDesk(): Promise<void> {
  await callPost('frappe.os_core.desk.set_preferred_shell', { shell: 'desk' })
  window.location.href = '/desk'
}
