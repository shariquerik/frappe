import { defineConfig } from 'vitest/config'
import path from 'node:path'

// Unit tests cover pure desktop/route logic (store state machine + route-map
// projection). They import plain .js modules only — no .vue, no frappe-ui — so the
// heavyweight vite.config.js plugin stack is intentionally not reused here. The `@`
// alias mirrors vite.config.js, since the store slices import config/* and api via it.
export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, 'src') },
  },
  test: {
    environment: 'jsdom', // store.hydrate reads localStorage
    include: ['tests/**/*.spec.js'],
  },
})
