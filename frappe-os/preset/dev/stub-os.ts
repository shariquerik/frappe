// Stub OS API for the applet dev harness (ADR-0009 dev loop). NOT throwaway — this is how
// every applet author iterates on a SFC with HMR, before the build+bench integration loop.
// It implements just enough of the OS API seam for an SFC, hitting the bench REST API directly
// (the Vite dev server proxies /api to the bench). The real host provides the full seam.
// Lives in frappe-os (the toolchain owner), reused by every applet — apps ship no dev harness.
import type { OsApi } from "@frappe-os/api";

async function rest(path: string): Promise<any> {
  const res = await fetch(`/api/${path}`, { headers: { "X-Frappe-CSRF-Token": (window as any).csrf_token || "" } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return (await res.json()).data ?? (await res.json()).message;
}

export const stubOs: OsApi = {
  data: {
    getList: async (doctype, options) => {
      const fields = JSON.stringify(options?.fields ?? ["name"]);
      const limit = options?.limit ?? 20;
      return rest(`resource/${encodeURIComponent(doctype)}?fields=${encodeURIComponent(fields)}&limit_page_length=${limit}`);
    },
    getDoc: async (doctype, name) => rest(`resource/${encodeURIComponent(doctype)}/${encodeURIComponent(name)}`),
    saveDoc: async (_d, _n, _c) => { throw new Error("stub-os: saveDoc not implemented"); },
    createDoc: async (_d, _v) => { throw new Error("stub-os: createDoc not implemented"); },
    call: async (_m, _p) => { throw new Error("stub-os: call not implemented"); },
  },
  windows: {
    open: (surface) => console.info("[stub-os] windows.open", surface),
    close: (id) => console.info("[stub-os] windows.close", id),
    focus: (id) => console.info("[stub-os] windows.focus", id),
  },
  ui: {
    notify: (message) => console.info("[stub-os] notify:", message),
    confirm: (message) => Promise.resolve(window.confirm(message)),
  },
  session: { user: "Administrator", roles: [], hasPermission: () => true },
  registry: { displayConfig: () => null, views: () => [] },
  capabilities: { "data.read": true },
};
