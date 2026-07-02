// A frappe-ui-free notify port for the data layer. records.ts (and the rest of the store import
// graph) must stay OUT of the frappe-ui import graph — the store's unit tests can't resolve
// frappe-ui, so a direct `import { toast } from 'frappe-ui'` there breaks every test that loads the
// store. Instead the data layer calls this port; the app wires the real toast in at boot
// (os-api.ts → setNotifier), and until then it's a silent no-op (offline dev, tests).

type Notifier = (message: string) => void

let notifier: Notifier = () => {}

// Wire the concrete notifier (the frappe-ui toast, via the OsUi seam) once boot resolves.
export function setNotifier(fn: Notifier): void {
  notifier = fn
}

// Raise a transient notification through whatever the app wired in. No-op until setNotifier runs.
export function notify(message: string): void {
  notifier(message)
}
