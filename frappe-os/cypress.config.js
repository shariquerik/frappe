import { defineConfig } from 'cypress'

// E2E runs against a LIVE, LOGGED-IN bench (site f2.localhost) — Frappe boot() refuses
// Guest, so the app can't mount otherwise. The session is established automatically by
// cypress/support/e2e.js, so a plain `yarn e2e` works with no extra flags. Prereqs:
//   - routing.cy.js          → needs `yarn dev` up (proxies /api to the bench). The dev
//     server binds f2.localhost:8096 (the frappe-ui plugin's port); the `f2.localhost`
//     host — not `localhost` — is what lets the proxy resolve the multitenant site.
//   - applet-loader.cy.js    → needs the BUILT host shipped to the bench and served at
//     f2.localhost:8016 (`yarn build && yarn build-applet …`); it targets that origin
//     directly via `env.origin` and logs in itself.
// Override the bench password for a different site with `CYPRESS_admin_password=…`.
export default defineConfig({
  e2e: {
    baseUrl: 'http://f2.localhost:8096',
    supportFile: 'cypress/support/e2e.js',
    specPattern: 'cypress/e2e/**/*.cy.js',
    video: false,
    env: {
      // Local dev bench admin credentials / the bench-served origin for applet-loader.
      admin_password: 'admin',
      origin: 'http://f2.localhost:8016',
    },
  },
})
