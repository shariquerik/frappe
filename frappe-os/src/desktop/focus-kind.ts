// The focused widget's KIND per window — which kind of thing holds keyboard focus (ADR-0038), keyed
// by winId like `selection`/`geo`. Published through a small seam (`publishFocus`) so any surface or
// applet widget can raise its focus without the OS knowing the widget. `contextForOS` reads the front
// window's kind into `Context.focusKind`, gating composer-style menus (`when: { focusKind: 'composer' }`).
//
// Persist-until-replaced: the kind changes ONLY when another widget publishes, the surface swaps, or
// the window closes — never on raw DOM blur. Opening the menu bar steals focus, so clear-on-blur would
// empty the Format menu at the exact moment the user reaches for it; persist-until-replaced avoids that
// classic menu-focus bug by construction (ADR-0038).
import { state } from './state'
import { isValidKind } from '@/actions/kinds'

// Publish which widget kind now holds keyboard focus in a window. A malformed kind (not core, not
// `<app>.<kind>`) is refused with a loud warn (kinds.ts) rather than poisoning the focus tier.
export function publishFocus(winId: string, kind: string): void {
  if (!isValidKind(kind)) {
    console.warn(`[actions] ⚠ invalid focus kind "${kind}" — ignored (not a core or <app>.<kind> kind)`)
    return
  }
  state.focusKind[winId] = kind
}

// Clear a window's focus kind — called ONLY on surface swap and window close (persist-until-replaced),
// the same seams that clear its selection. Never on DOM blur (see the module note).
export function clearFocusKind(winId: string): void {
  delete state.focusKind[winId]
}

// The focus kind of the FRONT window, or undefined when none is published — the value `contextForOS`
// reads into `Context.focusKind` for `when: { focusKind: 'composer' }` gating.
export function focusedKind(): string | undefined {
  const id = state.activeId
  return id ? state.focusKind[id] : undefined
}
