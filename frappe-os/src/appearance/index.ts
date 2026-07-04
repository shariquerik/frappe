// Appearance seam — the ONE place the OS chrome touches frappe-ui's theme engine. The System menu's
// Theme submenu is declared as pure data in the actions module (frappe-ui-free, so the resolver's
// unit tests stay pure); this seam supplies the behavior at boot: the `set-theme-*` run Handlers the
// submenu's Commands cite, and the live-selection provider that checkmarks the active option.
//
// Both ride frappe-ui's useTheme singleton (utils/theme.ts) — it owns `<html data-theme>` and
// persistence, and the Settings ▸ Appearance Select drives the same singleton, so a menu pick and a
// Select pick stay in lockstep. useTheme is module-scoped (not inject-based), so calling it here —
// outside a component, at boot — is safe. Wired from main.ts (never the unit-test graph).
import { useTheme } from 'frappe-ui'
import { registerRunHandlers, registerMenuSelection, THEME_COMMAND } from '@/actions'

export function initAppearance(): void {
  registerRunHandlers({
    'set-theme-light': () => useTheme().setTheme('light'),
    'set-theme-dark': () => useTheme().setTheme('dark'),
    'set-theme-system': () => useTheme().setTheme('system'),
  })
  // Read at projection time (menuOptions runs on every render), so the checkmark tracks the live
  // theme reactively — useTheme().currentTheme is a Vue ref the menu-bar render depends on.
  registerMenuSelection(() => {
    const command = THEME_COMMAND[useTheme().currentTheme.value]
    return new Set(command ? [command] : [])
  })
}
