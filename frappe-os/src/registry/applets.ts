// Applet contributions (ADR-0009): the applet TYPES, the bundled first-party catalog, and the
// pure loader. The index-reading applet accessors (listApplets/appletKind/knownApplet/
// resolveApplet) live in ./store — they need the seeded index; this module is the leaf they and
// the index-builder both draw the applet shapes from, so it depends on nothing in the registry.
import type { Component } from 'vue'

// The two applet kinds (ADR-0020), distinguished only by how the window content is produced:
// a `native` applet renders a Vue component directly against the host; a `framed` applet is a
// thin host mounting an <iframe> over a foreign-stack SPA, shown full-window with no nav rail.
export type AppletKind = 'native' | 'framed'

// A resolvable applet entry in the seeded index. Resolves a Vue component two ways (mutually
// exclusive): `load` for a FIRST-PARTY applet bundled into the OS (a static import the OS build
// code-splits), or `assetUrl` for a SEPARATELY-BUILT applet shipped in another app's public
// assets, loaded at runtime as native ESM (ADR-0009). The assetUrl path is the architecture's
// real promise — no OS rebuild when the app ships a new applet; the import map binds its
// externals to the host's singletons.
export interface AppletEntry {
  appId: string
  label: string
  load?: () => Promise<{ default: Component }>
  assetUrl?: string
  kind: AppletKind
  // Whether this applet wants the OS app nav rail beside it (ADR-0026) — orthogonal to `kind`.
  nav: boolean
}

// The server `applet` contribution payload (ADR-0009, projected from the `os/applets/` manifest).
// `kind` is optional on the wire (ADR-0020) — absent means a native applet.
export interface AppletPayload {
  appletId: string
  appId: string
  assetUrl: string
  label: string
  kind?: AppletKind
  // Whether the applet wants the nav rail (ADR-0026); absent on the wire → no rail.
  nav?: boolean
}

// One enumerable applet info row (palette entry points read this).
export interface AppletInfo { appletId: string; appId: string; label: string }

// FIRST_PARTY are bundled into the OS build (can't come from the server — they're static
// import()s the build code-splits); server contributions arrive from each app's `os/applets/`
// manifest and fold in at index time. Offline / unit-test = FIRST_PARTY only.
export const FIRST_PARTY: Record<string, AppletEntry> = {
  'my-todos': { appId: 'frappe', label: 'My open ToDos', load: () => import('@/applets/MyTodos'), kind: 'native', nav: false },
  'customizations': { appId: 'frappe', label: 'Customizations', load: () => import('@/applets/Customizations'), kind: 'native', nav: false },
}

// Load one entry to its Vue component (the loaded module's default export IS the SFC).
// `assetUrl` → native dynamic import of the separately-built artifact (ADR-0009; @vite-ignore
// keeps Vite from trying to bundle a runtime URL); else the first-party static `load`. The
// importer is injected so the assetUrl branch is unit-testable without a real network module.
type AppletImporter = (url: string) => Promise<{ default: Component }>
const importByUrl: AppletImporter = (url) => import(/* @vite-ignore */ url)

export async function loadApplet(entry: AppletEntry, importer: AppletImporter = importByUrl): Promise<Component> {
  const mod = entry.assetUrl ? await importer(entry.assetUrl) : await entry.load!()
  return mod.default
}
