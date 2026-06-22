// Green-bar spec for Issue 04 — the read-only Customizations view (ADR-0014 item 3, ADR-0015): a
// first-party applet at /os/frappe/customizations that lists, grouped by app, the overrides and
// removals apps impose on this site. Each assertion is FALSIFIABLE — if the server doesn't project
// erpnext's os_actions, or the projection drops a contender, or the feature-app marker predicate is
// wrong, it fails. The view reads the same folded registry the File menu competes over, so the
// erpnext override (commandPatch on frappe.window.new) and removal (removed on frappe.window.close)
// both surface here as structural rows — without any window needing to be focused (no resolve()).
//
// Runs against the BENCH WEBSERVER that serves the BUILT www/os.html + /assets (origin :8016), like
// action-override.cy.js — the registry fold lives in the built host. Build: (in frappe-os) yarn
// build, and ensure erpnext is installed (its os_actions hook drives the override + removal).
// Requires a LOGGED-IN bench (Guest can't boot). Run:
//   yarn e2e --spec cypress/e2e/customizations-view.cy.js \
//     --config baseUrl=http://f2.localhost:8016 --env admin_password=***,origin=http://f2.localhost:8016

const ORIGIN = Cypress.env('origin') || 'http://f2.localhost:8016'
const VIEW = '[data-applet="customizations"]'
const ERPNEXT = `${VIEW} [data-app="erpnext"]`

describe('Issue 04 — Customizations view (bench-served build)', () => {
  before(() => {
    cy.request({
      method: 'POST',
      url: `${ORIGIN}/api/method/login`,
      form: true,
      body: { usr: 'Administrator', pwd: Cypress.env('admin_password') },
    })
  })

  it('lists erpnext as a feature app with its override and removal, marking the removal', () => {
    cy.visit(`${ORIGIN}/os/frappe/customizations`)
    cy.get(VIEW, { timeout: 15000 }).should('exist')

    // erpnext groups under its own header, classified as a feature app (ADR-0014 item 4).
    cy.get(ERPNEXT).should('exist')
    cy.get(`${ERPNEXT} [data-app-kind="feature"]`).should('exist')

    // The contextual override of "New window" surfaces as an override row, scoped to erpnext.
    cy.get(`${ERPNEXT} [data-row-command="frappe.window.new"]`)
      .should('have.attr', 'data-row-reason', 'override')
      .and('contain.text', 'when activeApp = erpnext')

    // The removal of "Close window" surfaces as a removal row AND carries the "review this" marker
    // (a feature app stripping shared chrome is the surprising case, ADR-0015 §5).
    cy.get(`${ERPNEXT} [data-row-command="frappe.window.close"]`)
      .should('have.attr', 'data-row-reason', 'removal')
      .find('[data-review-this]')
      .should('exist')
  })
})
