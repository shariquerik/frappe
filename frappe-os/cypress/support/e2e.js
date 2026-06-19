// Global E2E support: auto-authenticate so the specs run with a plain `yarn e2e` (no
// --env / --config flags). Frappe boot() refuses Guest, so every spec needs a session.
//
// The two specs target DIFFERENT origins, so the auto-login is scoped:
//   - routing.cy.js   — relative visits → `baseUrl` (the dev server, f2.localhost:8096).
//     It has no login of its own, so we establish one here.
//   - applet-loader.cy.js — visits its own absolute origin (the bench, f2.localhost:8016)
//     and logs in itself. We SKIP it here so we don't (a) wipe its bench cookie under
//     Cypress test-isolation, or (b) force the dev server to be up when only that
//     production spec is run.
const password = () => Cypress.env('admin_password')

// Log into a Frappe origin and cache the session (sid cookie) across test-isolation
// resets. Keyed by origin so dev/bench sessions don't collide. `origin=''` → baseUrl.
Cypress.Commands.add('frappeLogin', (origin = '') => {
  cy.session(['frappe', origin], () => {
    cy.request({
      method: 'POST',
      url: `${origin}/api/method/login`,
      form: true,
      body: { usr: 'Administrator', pwd: password() },
    })
  })
})

beforeEach(function () {
  // applet-loader.cy.js owns its bench-origin login; auto-login only the baseUrl specs.
  if (Cypress.spec.name.includes('applet-loader')) return
  if (password()) cy.frappeLogin()
})
