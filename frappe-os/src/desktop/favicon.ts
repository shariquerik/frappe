// Browser-tab favicon mirroring: the tab icon follows the FOCUSED window's app identity —
// an app window shows its app's logo, system windows (Settings/Finder) and the bare
// desktop fall back to the Frappe OS icon. The resolver is pure and reactive here;
// main.ts owns the DOM watcher (wiring only), like the URL projection.
import { computed } from 'vue'
import { surfaceAppId, windowRole } from '@/surface'
import { useRegistry } from '@/registry'
import { state } from './state'
import type { OsWindow } from '@/types'

export const OS_FAVICON = '/assets/frappe/images/os-icon-192.png'

// Pure: the favicon href for a focused window. Only an ordinary app window carries its
// app's branding into the tab; an unbranded app (no logo) keeps the OS icon rather than
// showing a broken image.
export function faviconFor(
  win: OsWindow | undefined,
  logoOf: (appId: string) => string | undefined,
): string {
  if (!win || windowRole(win.id) !== 'app') return OS_FAVICON
  return logoOf(surfaceAppId(win.surface)) || OS_FAVICON
}

// The live href for the current focus — main.ts watches this into applyFavicon.
export const faviconHref = computed(() =>
  faviconFor(
    state.windows.find((w) => w.id === state.activeId),
    (appId) => useRegistry().app(appId)?.logo,
  ),
)

// Idempotent DOM apply: retarget the host page's icon link (creating it if the host
// page shipped none), touching the DOM only on a real change.
export function applyFavicon(href: string): void {
  let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
  if (!link) {
    link = document.createElement('link')
    link.rel = 'icon'
    document.head.append(link)
  }
  if (link.getAttribute('href') !== href) link.setAttribute('href', href)
}
