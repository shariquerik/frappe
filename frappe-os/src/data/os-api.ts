// The OS API seam (ADR-0003): the one narrow, published object every component and
// script receives to reach Frappe OS. Components never import the store, router,
// api.ts or records.ts directly — they go through here, so the surface we must keep
// stable forever is exactly this object. Additive-only (ADR-0008).
//
// This module is the ONLY place allowed to wrap those internals: api.ts for reads and
// the `call` escape hatch, the records store for writes (so the shared caches refresh
// and built-in views stay coherent), the window store actions, and curated config.
// See docs/design/surface-and-registry.md §3.
import type { InjectionKey } from 'vue'
import { toast } from 'frappe-ui'
import { getList, getDoc, call } from './api'
import { setNotifier } from './notify'
import { useOS } from '@/desktop'
import { useRegistry, resolveApplet } from '@/registry'
import type {
  BootData, FrappeDoc, GetListOptions, OsApi, OsData, OsRegistry,
  OsSession, OsStore, OsUi, OsWindows, PermissionType, Surface,
} from '@/types'

// ---- data: reads via api.ts, writes via the records store --------------------
function makeData(os: OsStore): OsData {
  return {
    getList: (doctype: string, options?: GetListOptions): Promise<FrappeDoc[]> => getList(doctype, options),
    getDoc: (doctype: string, name: string): Promise<FrappeDoc> => getDoc(doctype, name),
    saveDoc: (doctype, name, changes) => os.saveDoc(doctype, name, changes),
    createDoc: (doctype, values) => os.createDoc(doctype, values),
    call: (method: string, params?: Record<string, unknown>) => call(method, params),
  }
}

// ---- windows: thin wrappers over the window store actions --------------------
function makeWindows(os: OsStore): OsWindows {
  return {
    open: (surface: Surface) => os.openSurface(surface),
    close: (id: string) => os.closeWin(id),
    focus: (id: string) => os.activateWin(id), // raises + un-minimizes
  }
}

// ---- ui: toast notifications + a confirm prompt ------------------------------
function makeUi(): OsUi {
  return {
    notify: (message: string) => toast(message),
    confirm: (message: string) => Promise.resolve(window.confirm(message)),
  }
}

// ---- session: read-only facts projected from the resolved boot payload -------
// The server supplies roles + the read/write/create/delete permission map (ADR-0010);
// `roles` stays Array-guarded so an offline/legacy boot degrades to [] rather than throw.
function makeSession(boot: BootData): OsSession {
  return {
    user: boot.user,
    roles: Array.isArray(boot.roles) ? boot.roles : [],
    hasPermission: (doctype: string, ptype: PermissionType = 'read') => {
      const perms = boot.permissions[doctype]
      return !!(perms && perms[ptype])
    },
  }
}

// ---- registry: read-only projections over the client Registry seam ------------
// Both delegate to useRegistry() (registry/index.ts): one source for display config and
// the views collection, so step 4 flips the backing to the server with no change here.
function makeRegistry(): OsRegistry {
  const reg = useRegistry()
  return {
    displayConfig: (doctype: string) => reg.displayConfig(doctype),
    views: (doctype: string) => reg.views(doctype),
    resolveApplet: (appletId: string) => resolveApplet(appletId),
  }
}

// What the seam can do today (ADR-0008 feature detection). Component-surface
// rendering and scripting land in later steps, so they advertise false for now.
const CAPABILITIES: Record<string, boolean> = {
  'data.read': true,
  'data.write': true,
  'windows.open': true,
  'ui.notify': true,
  'ui.confirm': true,
  applets: true,
}

// Assemble the seam from a resolved boot payload. Pure given (boot, store), so tests
// construct it directly; the app uses initOsApi/getOsApi for the shared singleton.
export function createOsApi(boot: BootData): OsApi {
  const os = useOS()
  return {
    data: makeData(os),
    windows: makeWindows(os),
    ui: makeUi(),
    session: makeSession(boot),
    registry: makeRegistry(),
    capabilities: CAPABILITIES,
  }
}

// The typed provide/inject key for the seam (ADR-0003/0009). The host (OSWindow, the
// mounting ancestor) `provide(OS_KEY, os)`; an applet `inject(OS_KEY)` and gets a typed
// OsApi back — never importing the store or grabbing a module global. Exported from the
// OS-API module so the key and the value it carries share one source of truth.
export const OS_KEY: InjectionKey<OsApi> = Symbol('frappe-os:os')

// The one shared instance handed to applets. Initialised once boot resolves.
let current: OsApi | null = null
export function initOsApi(boot: BootData): OsApi {
  current = createOsApi(boot)
  // Wire the frappe-ui-free data-layer notify port to the seam's toast, so writes below the seam
  // (records.bulkUpdate's enqueued-job feedback) surface through the same notifications as the UI.
  setNotifier(current.ui.notify)
  return current
}
export function getOsApi(): OsApi {
  if (!current) throw new Error('OS API not initialised — call initOsApi(boot) during boot')
  return current
}
// Non-throwing accessor for hosts that provide the seam unconditionally: offline dev
// (no bench behind Vite) never initialises it, but no applet window exists then either,
// so the host simply skips the provide rather than white-screening every window.
export function tryGetOsApi(): OsApi | null {
  return current
}
