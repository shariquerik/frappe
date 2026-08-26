// PROTOTYPE. The framework's ONE vite config. There is no other in any app.
//
// Deleting crm/frontend2/vite.config.js is the single most legible piece of evidence
// that the charter landed, so it is worth reading the two side by side. Everything
// that file works around -- the __SOCKETIO_PORT__ define reading
// common_site_config.json, the '@framework/ui' alias into a sibling repo, the
// optimizeDeps include/exclude fixing dual-instance prosemirror -- exists only
// because it was one of N hosts. In one module graph none of them has a cause.

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import contributions from './plugin/contributions'
import { readManifest, enforceSingletons } from './plugin/manifest'

// Assembled by Python, because app_route is Python-only truth and a prefix cannot be
// globbed for (#42069 §1). Read before vite starts so the singleton check can fail
// before it does.
const manifest = readManifest()
enforceSingletons(manifest)

export default defineConfig({
  plugins: [vue(), contributions(manifest)],
  build: {
    // ONE root, /assets/frappe/frontend/. Per-app asset URLs are lost; app identity
    // rides in the chunk name instead (#42069 §7).
    outDir: '../frappe/public/frontend',
    // NOT emptyOutDir. A failed build must leave the previously-built assets
    // untouched -- crm/frontend2/vite.config.js:31 does exactly the wrong thing today
    // (#42069 §4).
    emptyOutDir: false,
    sourcemap: true,
  },
  resolve: {
    // NOT resolve.dedupe. dedupe silently picks a winner; under one bundle a version
    // conflict is a real disagreement between two app authors and must be reported
    // (#42069 §3).
  },
  server: {
    // Every app's source is outside this root, so all of them must be readable. This
    // generalises the single escape hatch crm/frontend2/vite.config.js:66 already
    // needs for one sibling repo.
    fs: { allow: manifest.map((app) => app.source_dir) },
  },
})
