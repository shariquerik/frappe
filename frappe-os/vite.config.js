import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import frappeui from 'frappe-ui/vite'
import frameworkUI from '@framework/ui/vite'
import { assertNoChunkCycles } from './build/chunk-cycles.js'
import path from 'node:path'

// The ADR-0009 shared-singleton import map — maps the three bare specifiers a runtime-loaded
// applet externalizes to the host's instances, BEFORE any module loads. Mode-aware because the
// host's modules differ by mode:
//   - BUILD: the brokers are emitted as stable /assets/frappe/os/os-brokers/*.js chunks that
//     re-export the host's BUNDLED instances.
//   - DEV: the host runs unbundled /src/*.ts (Vite's deduped vue/frappe-ui, the live os-api), so
//     point the specifiers at the broker SOURCE modules Vite serves — `export * from 'vue'` /
//     `@/data/os-api` resolve to those SAME dev modules. So a built applet loaded via the bench-proxied
//     /assets/<app>/… binds to the dev host's singletons too (inject(OS_KEY) resolves in dev).
// head-prepend guarantees it precedes Vite's injected entry module script.
function osImportMap() {
  const DEV = {
    vue: '/src/brokers/vue.ts',
    'frappe-ui': '/src/brokers/frappe-ui.ts',
    '@frappe-os/api': '/src/brokers/api.ts',
  }
  const PROD = {
    vue: '/assets/frappe/os/os-brokers/vue.js',
    'frappe-ui': '/assets/frappe/os/os-brokers/frappe-ui.js',
    '@frappe-os/api': '/assets/frappe/os/os-brokers/api.js',
  }
  return {
    name: 'os-import-map',
    transformIndexHtml(_html, ctx) {
      const imports = ctx.server ? DEV : PROD
      return [{
        tag: 'script',
        attrs: { type: 'importmap' },
        children: JSON.stringify({ imports }, null, 2),
        injectTo: 'head-prepend',
      }]
    },
  }
}

export default defineConfig({
  // No manual `base` — the frappe-ui plugin owns the Vite base via buildConfig
  // (serves at /os through www/os.py in dev via the proxy, and at /assets/frappe/os
  // in production builds).
  plugins: [
    // Reuse the proven frappe-ui serve/build plumbing: dev server proxies /api and
    // /assets to the local bench, jinja boot (from www/os.py) is injected into the
    // page, and the build emits hashed assets + the www/os.html host page.
    ...frappeui({
      lucideIcons: true, // frappe-ui's lucide auto-import resolver (~icons/lucide/*)
      frappeProxy: true,
      jinjaBootData: true,
      buildConfig: {
        outDir: path.resolve(import.meta.dirname, '../frappe/public/os'),
        baseUrl: '/assets/frappe/os/',
        indexHtmlPath: path.resolve(import.meta.dirname, '../frappe/www/os.html'),
        emptyOutDir: true,
        sourcemap: false,
      },
    }),
    vue(),
    vueJsx(),
    // Dedupe shared singletons so the symlinked @framework/ui shares the host's
    // vue / vue-router / frappe-ui / reka-ui instances (provide/inject context).
    frameworkUI(),
    osImportMap(),
    // Build-time guard: a cyclic chunk graph boots to a blank screen (see build/chunk-cycles.js).
    assertNoChunkCycles(),
  ],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, 'src') },
  },
  // Emit the ADR-0009 brokers (src/brokers/*) as additional entries at STABLE, un-hashed
  // URLs under os-brokers/ so the import map in index.html can name them statically. Each
  // re-exports a host singleton; Rollup dedupes the re-export onto the host's one chunk, so
  // a separately-built applet importing the bare specifier binds to the host's instance.
  // Everything non-broker keeps Vite's default hashed name. (Build-only; ignored in dev.)
  build: {
    rollupOptions: {
      // Keep each broker entry's re-exports intact: without this the bundler tree-shakes
      // them away (nothing in the host build imports a broker), leaving an empty side-effect
      // import — and a runtime-loaded applet's `import { OS_KEY }` would resolve to nothing.
      preserveEntrySignatures: 'strict',
      input: {
        index: path.resolve(import.meta.dirname, 'index.html'),
        'broker-vue': path.resolve(import.meta.dirname, 'src/brokers/vue.ts'),
        'broker-frappe-ui': path.resolve(import.meta.dirname, 'src/brokers/frappe-ui.ts'),
        'broker-api': path.resolve(import.meta.dirname, 'src/brokers/api.ts'),
      },
      output: {
        entryFileNames: (chunk) =>
          chunk.name.startsWith('broker-')
            ? `os-brokers/${chunk.name.slice('broker-'.length)}.js`
            : 'assets/[name]-[hash].js',
        // Keep every frappe-ui module in ONE chunk. frappe-ui's barrel (`index.ts` re-exports
        // a component that imports a sibling through the barrel again) makes its module graph
        // cyclic. That's harmless inside a chunk — the bundler orders the modules — but when
        // the chunker scatters those modules across chunks, the cycle is promoted to a CHUNK
        // cycle, and chunks are ESM modules whose evaluation order the bundler no longer
        // controls. A cyclic chunk then reads a not-yet-evaluated binding from its partner:
        // `_export_sfc` is `var`-hoisted, so it reads `undefined` and the page dies at boot
        // with "TypeError: at is not a function". `assertNoChunkCycles` (build/chunk-cycles.js)
        // fails the build if this ever regresses, so the guard can't rot silently.
        // The `vue-sfc-helper` group is the same rule for the `_export_sfc` helper itself:
        // it's a virtual module shared by frappe-ui AND our own SFCs, so pinning it to its
        // own leaf chunk keeps it out of whichever chunk would otherwise close a loop.
        advancedChunks: {
          groups: [
            { name: 'vue-sfc-helper', test: /plugin-vue[:_]export-helper/ },
            { name: 'frappe-ui', test: /[\\/]node_modules[\\/]frappe-ui[\\/]/ },
          ],
        },
      },
    },
  },
  // frappe-ui's FeatherIcon imports the CJS `feather-icons` default; pre-bundle it
  // so the dev server resolves the default export (matches the CRM frontend config).
  // `debug` (CJS, pulled in transitively) needs the same treatment or it throws
  // "does not provide an export named 'default'" at runtime in dev.
  optimizeDeps: {
    // Exclude the big Vue source-distributed libs from esbuild's dep optimizer: its
    // code-splitter mis-handles their deduped Vue esm-bundler chunk and emits a call
    // to `init_shared_esm_bundler` without importing it ("not defined" at runtime).
    // Excluded, they're served as ESM source and their Vue imports resolve to the one
    // optimized `vue` instance. (Rollup's production build doesn't hit this — only dev.)
    exclude: ['frappe-ui', '@framework/ui'],
    // ...but their CJS/UMD leaf deps still need pre-bundling for default-export interop:
    // the socket.io → engine.io → debug realtime chain, FeatherIcon's `feather-icons`,
    // the prosemirror/editor stack, and the drag/sanitize deps used by form views.
    include: [
      'feather-icons',
      'prosemirror-state',
      'prosemirror-view',
      'lowlight',
      'interactjs',
      'socket.io-client',
      'engine.io-client',
      'socket.io-parser',
      'debug',
      // vuedraggable lives in @framework/ui's *nested* node_modules, so it needs the
      // `parent > child` form to target that copy; dompurify resolves top-level.
      '@framework/ui > vuedraggable',
      'dompurify',
    ],
  },
  server: {
    port: 5273,
    open: false,
    fs: { allow: ['..'] },
    // Generic catch-all proxy (ADR-0020). A framed applet's iframe loads an origin-relative path
    // (e.g. `/raven`); in production the OS and the framed SPA share the bench origin so it just
    // works, but in dev the OS is served by Vite (a different origin) and that path would hit
    // Vite's SPA fallback — serving the OS shell back into the iframe, which re-opens the framed
    // applet → infinite recursion. The fix is a catch-all, never a per-app rule: the OS dev server
    // owns ONLY `/os/*` and Vite's own internals; everything else forwards to the bench with the
    // site-preserving router (host header → site cookie binding). No framed app may ever be named
    // here (the retired `^/raven` rule was a privileged-core leak, ADR-0001/0004).
    proxy: {
      '^/': {
        target: 'http://127.0.0.1:8016',
        // No `ws: true`: a catch-all `^/` ws proxy would also intercept Vite's HMR upgrade
        // (protocol `vite-hmr` on `/`) and fight Vite's own HMR server for the socket. HMR must
        // stay local; framed SPAs load over HTTP, which this rule forwards.
        router: (req) => `http://${req.headers.host.split(':')[0]}:8016`,
        // Keep the paths the OS dev server owns local — return the original url to skip the
        // proxy and let Vite's own middleware serve it. `/os/*` is the OS app (base `/os/`),
        // `/src` are the unbundled host/broker modules, `/@*` are Vite's virtual/fs modules,
        // `/node_modules` are pre-bundled deps, `/__*` are Vite endpoints (ping, open-in-editor).
        // Exception: the PWA files `/os/manifest.json` and `/os/sw.js` are served by the bench
        // (www/os/*), not Vite — the negative lookahead lets them fall through to the proxy so
        // dev returns real JSON/JS instead of Vite's SPA fallback (which reads as a manifest
        // syntax error and an unregisterable worker).
        bypass: (req) =>
          /^\/(os(?!\/(manifest\.json|sw\.js)(\?|$))(\/|$)|src\/|node_modules\/|@|__)/.test(req.url)
            ? req.url
            : undefined,
      },
    },
  },
})
