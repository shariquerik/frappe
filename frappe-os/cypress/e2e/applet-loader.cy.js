// Green-bar spec for the ADR-0009 applet LOADER (B): a separately-built, erpnext-shipped
// applet loaded at runtime as native ESM, sharing the host's single Vue / frappe-ui / OS-API
// via the import map + brokers. Each assertion below is FALSIFIABLE — if the shared-singleton
// wiring is wrong (two Vues / unshared OS_KEY Symbol / missing broker), it fails loudly.
//
// PRODUCTION-ONLY mechanism: the loader shares the host's Vue/OS-API via the import map +
// brokers, which only exist in the BUILT host. The Vite dev server (:5273 / :8096) serves the
// host as unbundled /src/*.ts modules — a SECOND Vue/OS_KEY instance from the brokers' built
// chunks → inject(OS_KEY) returns nothing. So this MUST run against the BENCH WEBSERVER that
// serves the built www/os.html + /assets (origin :8016), NOT the dev server. Build + ship:
//   (in frappe-os)  yarn build && yarn build:applet:erpnext
//
// Requires a LOGGED-IN bench (Guest can't boot) — NOT a headless gate. Run:
//   yarn e2e --spec cypress/e2e/applet-loader.cy.js \
//     --config baseUrl=http://f2.localhost:8016 --env admin_password=***,origin=http://f2.localhost:8016
// See memory frappe-os-applet-loader / frappe-os-applet-tracer-bullet.
//
// A DIRECT deep-link visit works in production thanks to the `/os/<path:app_path>` →`os`
// website_route_rule (frappe/hooks.py): the webserver serves the single os page for any /os/*
// path and vue-router resolves the sub-path client-side (mirrors /desk). The earlier 404 was
// the missing fallback route.

const ORIGIN = Cypress.env('origin') || 'http://f2.localhost:8016'
const APPLET = '[data-applet="erp-hello"]'

describe('ADR-0009 applet loader — erpnext Hello green bar (bench-served build)', () => {
  before(() => {
    // Log in against the bench origin so the session cookie is set for that domain.
    cy.request({
      method: 'POST',
      url: `${ORIGIN}/api/method/login`,
      form: true,
      body: { usr: 'Administrator', pwd: Cypress.env('admin_password') },
    })
  })

  it('loads the runtime applet on the host Vue and passes all five checks', () => {
    // Direct deep-link to the applet — the real user flow (served via the /os/* route rule).
    cy.visit(`${ORIGIN}/os/erpnext/erp-hello`)

    // (1) inject(OS_KEY) resolved — the loud failure state would carry data-os="missing".
    cy.get(APPLET, { timeout: 15000 }).should('have.attr', 'data-os', 'ok')

    // (2) data.getList across the boundary rendered rows (DocType is readable for Admin).
    cy.get(`${APPLET} [data-testid="row"]`).its('length').should('be.gte', 1)

    // (4) reactivity on the shared scheduler — the local ref counter increments.
    cy.get('[data-testid="counter-btn"]').should('contain.text', 'Count: 0').click()
    cy.get('[data-testid="counter-btn"]').should('contain.text', 'Count: 1')

    // (3) a frappe-ui Button (shared external #2) → host toast through the OS API.
    cy.get('[data-testid="notify-btn"]').click()
    cy.contains('Hello from the ERPNext applet').should('be.visible')

    // (5) windows.open(formSurface(...)) across the boundary spawns a builtin window.
    cy.get('[data-win-id]').then(($before) => {
      cy.get('[data-testid="open-btn"]').click()
      cy.get('[data-win-id]').its('length').should('be.gt', $before.length)
    })
  })
})
