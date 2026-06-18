import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import frappeui from 'frappe-ui/vite'
import frameworkUI from '@framework/ui/vite'
import path from 'path'

// Reuses the proven frappe-ui serve/build plumbing (dev proxy + jinja boot
// injection + html copy), but the app architecture on top is fresh
// (registry + schema->UI). Served at /x alongside Desk.
export default defineConfig({
  plugins: [
    frappeui({
      frappeProxy: true, // dev server proxies /api, /assets to the local bench
      jinjaBootData: true, // injects boot from www/x.py into the page
      buildConfig: {
        outDir: path.resolve(__dirname, '../frappe/public/shell'),
        baseUrl: '/assets/frappe/shell/',
        indexHtmlPath: path.resolve(__dirname, '../frappe/www/x.html'),
        emptyOutDir: true,
        sourcemap: false,
      },
    }),
    vue(),
    // @framework/ui ships raw .vue/.ts source linked by symlink; dedupe vue /
    // vue-router / frappe-ui / reka-ui to the shell's single copy so provide/inject
    // (Tabs, FormLayout) and reactivity work across the package boundary.
    frameworkUI(),
  ],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  optimizeDeps: {
    // frappe-ui imports `~icons/lucide/*` (e.g. in TextEditor), which only the
    // frappe-ui vite plugin resolves — and that runs in Vite's transform/rollup
    // pipeline, NOT in esbuild's dep pre-bundler. Pre-bundling frappe-ui therefore
    // fails on those virtual imports, so serve it (and @framework/ui) as source.
    exclude: ['frappe-ui', '@framework/ui'],
    // Transitive CJS deps that still need pre-bundling once frappe-ui is excluded.
    // socket.io-client (frappe-ui realtime) is shipped as ESM that default-imports
    // the CJS `debug` package; without pre-bundling, Vite serves it raw and the
    // `import debug from 'debug'` fails ("does not provide an export named 'default'").
    // Pre-bundling the chain lets esbuild apply CJS interop.
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
      // @framework/ui is served as source too, and default-imports two CJS/UMD
      // deps. vuedraggable lives in @framework/ui's *nested* node_modules, so it
      // needs the `parent > child` form to target that copy; dompurify resolves to
      // the top-level copy.
      '@framework/ui > vuedraggable',
      'dompurify',
    ],
  },
  server: {
    // Allow Vite to read @framework/ui's source, which lives outside shell/.
    fs: { allow: [path.resolve(__dirname, '..')] },
  },
})
