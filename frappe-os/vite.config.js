import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import frappeui from 'frappe-ui/vite'
import frameworkUI from '@framework/ui/vite'
import path from 'node:path'

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
  ],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, 'src') },
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
  server: { port: 5273, open: false, fs: { allow: ['..'] } },
})
