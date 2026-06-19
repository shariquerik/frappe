// Broker (ADR-0009, Strategy 2) AND the public `@frappe-os/api` surface in one file: the
// stable-URL entry an applet's external `@frappe-os/api` specifier resolves to (via the
// host import map), re-exporting the host's OWN bundled OS-API + surface constructors.
//
// Why shared, not bundled: `OS_KEY` is a `Symbol` — an applet's `inject(OS_KEY)` only
// resolves if it references the SAME Symbol instance the host `provide`d, AND runs on the
// same Vue runtime. Bundling a second copy would mint a second Symbol → silent inject miss.
// So this is the one curated module an applet may import; its named exports ARE the applet
// contract (an applet author's tsconfig aliases `@frappe-os/api` → this file). Explicit
// re-exports (not `export *`) keep internals — getOsApi/initOsApi/resolveApplet — private.
export { OS_KEY } from '@/os-api'
export { formSurface, listSurface, appletSurface, dashboardSurface } from '@/surface'
export type { OsApi, Surface, FrappeDoc, GetListOptions } from '@/types'
