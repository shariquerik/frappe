// The official Frappe OS applet build preset (ADR-0009). An app uses this to compile an
// Applet into a single native-ESM artifact that:
//   - EXTERNALIZES the three host singletons (`vue`, `frappe-ui`, `@frappe-os/api`) — they
//     are never bundled; at runtime the host import map resolves them to the OS's instances.
//   - BUNDLES everything else (the applet is self-contained except for those three).
//   - emits a STABLE, un-hashed filename so the OS can name its assetUrl statically.
// The applet's entry must `export default` the SFC (the module default IS the component).
//
// This is a real, shipped artifact — not throwaway. Every applet author's vite.config.js
// calls it; the externals here are the architecture's hard dependency boundary.
//
// It also owns the `yarn dev` AUTHORING harness (preset/dev/): in serve mode the config roots
// at that harness, mounts the applet's SFC (reached via the `@applet/entry` alias) on a
// throwaway Vue with a stub OS, and gives HMR. The harness lives once here, so apps ship no
// dev scaffolding of their own — only their SFC + this config.
import path from 'node:path'
import vue from '@vitejs/plugin-vue'

// The closed shared set (ADR-0009 addendum). Expanding it is a host-only, deliberate,
// rare compatibility event — an app can never unilaterally add a shared singleton.
export const SHARED_EXTERNALS = ['vue', 'frappe-ui', '@frappe-os/api']

const DEV_ROOT = path.resolve(import.meta.dirname, 'dev') // preset/dev — the authoring harness
const FRAPPE_OS = path.resolve(import.meta.dirname, '..')  // serves node_modules + os-api source

// root      — the applet package dir (absolute).
// entry     — the entry module that default-exports the SFC (absolute).
// outDir    — where the artifact lands (absolute; the app's public assets).
// fileName  — the stable output filename, e.g. 'hello.js'.
// devApiPath — absolute path to the host's @frappe-os/api source, aliased in for `vite dev`
//              of the stub-OS harness (in dev the externals are NOT externalized; the
//              harness runs the SFC on its own Vue for HMR authoring — ADR-0009's dev loop).
//
// Returns a Vite config FUNCTION: build roots at the applet dir and emits the lib; serve roots
// at the shared dev harness and reaches back to the applet's SFC via the `@applet/entry` alias.
export function appletConfig({ root, entry, outDir, fileName, devApiPath }) {
  return ({ command }) => {
    const serving = command === 'serve'
    return {
      root: serving ? DEV_ROOT : root,
      plugins: [vue()],
      // Dev: alias the OS API to the host source + the applet's entry, and dedupe the host
      // singletons so the SFC and harness share ONE copy resolved from frappe-os/node_modules.
      resolve: serving
        ? {
            alias: {
              '@frappe-os/api': devApiPath, '@applet/entry': entry,
              '@': path.resolve(FRAPPE_OS, 'src'), // the os-api broker re-imports host @/* modules
            },
            dedupe: ['vue', 'frappe-ui'],
          }
        : undefined,
      // Dev: the SFC lives outside the harness root, so allow serving the applet dir + frappe-os.
      server: serving ? { fs: { allow: [FRAPPE_OS, root] } } : undefined,
      build: {
        outDir,
        emptyOutDir: false, // share the app's public dir with its other assets
        lib: { entry, formats: ['es'], fileName: () => fileName },
        rollupOptions: { external: SHARED_EXTERNALS },
      },
    }
  }
}
