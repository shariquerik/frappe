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

// Hand back to classic Desk and remember the choice, so the next login lands on Desk too. The
// symmetric partner of Desk's "Switch to OS" navbar action — both write the same per-user default.
export async function switchToDesk(): Promise<void> {
  await callPost('frappe.www.os.set_preferred_shell', { shell: 'desk' })
  window.location.href = '/desk'
}
