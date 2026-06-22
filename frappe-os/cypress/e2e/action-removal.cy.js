// Green-bar spec for Slice 3 of the Action model: erpnext's hook-declared REMOVAL of the OS's
// first-party "Close window" (command `frappe.window.close`), folded from the server registry into
// the File menu and gated `when:{activeApp:'erpnext'}` with `removed:true`. Each assertion is
// FALSIFIABLE — if the server doesn't project erpnext's `removed` os_actions entry, or the client
// doesn't suppress + log it, it fails.
//
// Runs against the BENCH WEBSERVER that serves the BUILT www/os.html + /assets (origin :8016),
// like action-override.cy.js — the registry fold + when-gated suppression live in the built host.
// Build:  (in frappe-os)  yarn build  and ensure erpnext is installed (its os_actions hook drives
// the removal). Requires a LOGGED-IN bench (Guest can't boot). Run:
//   yarn e2e --spec cypress/e2e/action-removal.cy.js \
//     --config baseUrl=http://f2.localhost:8016 --env admin_password=***,origin=http://f2.localhost:8016

const ORIGIN = Cypress.env('origin') || 'http://f2.localhost:8016'
// The menu-bar File button specifically — NOT the frappe sidebar's "File" doctype row.
const FILE_MENU = '[data-menu="file"]'

describe('Slice 3 — erpnext removes Close window (bench-served build)', () => {
  before(() => {
    cy.request({
      method: 'POST',
      url: `${ORIGIN}/api/method/login`,
      form: true,
      body: { usr: 'Administrator', pwd: Cypress.env('admin_password') },
    })
  })

  it('suppresses the Close window item AND logs the attributed removal with an erpnext window focused', () => {
    // Spy on console.warn before boot so we capture the removal shadow the resolver emits on render.
    const warnings = []
    cy.visit(`${ORIGIN}/os/erpnext`, {
      onBeforeLoad(win) {
        cy.stub(win.console, 'warn').callsFake((msg) => warnings.push(String(msg)))
      },
    })

    // erpnext window is focused → the removal wins: the File menu has no Close window item.
    cy.get('[data-active-window]', { timeout: 15000 }).should('exist')
    cy.get(FILE_MENU).click()
    cy.contains('New ERPNext window').should('be.visible') // sibling override still renders
    cy.contains('Close window').should('not.exist') // the OS default is stripped, not hidden-but-present

    // The removal was logged AND attributed to erpnext as a `removal` (never silent, never a true-tie).
    cy.wrap(null).should(() => {
      const strip = warnings.find((w) => w.includes('frappe.window.close') && w.includes('erpnext'))
      expect(strip, 'attributed removal log').to.be.a('string')
      expect(strip).to.include('removal')
      expect(strip).to.not.include('true-tie')
    })
  })

  it('shows Close window when a non-erpnext (frappe) window is focused (removal ineligible)', () => {
    cy.visit(`${ORIGIN}/os/frappe`)
    cy.get('[data-active-window]', { timeout: 15000 }).should('exist')
    cy.get(FILE_MENU).click()
    cy.contains('Close window').should('be.visible') // the removal's `when` does not match → default re-appears
  })
})
