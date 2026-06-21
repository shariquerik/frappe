// Green-bar spec for Slice 2 of the Action model: erpnext's hook-declared OVERRIDE of the OS's
// first-party "New window" (command `frappe.window.new`), folded from the server registry into
// the File menu and gated `when:{activeApp:'erpnext'}`. Each assertion is FALSIFIABLE — if the
// server doesn't project erpnext's os_actions, or the client doesn't fold/gate it, it fails.
//
// Runs against the BENCH WEBSERVER that serves the BUILT www/os.html + /assets (origin :8016),
// like applet-loader.cy.js — the registry fold + when-gating live in the built host. Build:
//   (in frappe-os)  yarn build
// and ensure erpnext is installed on the site (its os_actions hook drives the override).
//
// Requires a LOGGED-IN bench (Guest can't boot). Run:
//   yarn e2e --spec cypress/e2e/action-override.cy.js \
//     --config baseUrl=http://f2.localhost:8016 --env admin_password=***,origin=http://f2.localhost:8016

const ORIGIN = Cypress.env('origin') || 'http://f2.localhost:8016'
// The menu-bar File button specifically — NOT the frappe sidebar's "File" doctype row.
const FILE_MENU = '[data-menu="file"]'

describe('Slice 2 — erpnext overrides New window (bench-served build)', () => {
  before(() => {
    cy.request({
      method: 'POST',
      url: `${ORIGIN}/api/method/login`,
      form: true,
      body: { usr: 'Administrator', pwd: Cypress.env('admin_password') },
    })
  })

  it('re-titles the File item AND logs the attributed shadow with an erpnext window focused', () => {
    // Spy on console.warn before boot so we capture the shadow log the resolver emits on render.
    const warnings = []
    cy.visit(`${ORIGIN}/os/erpnext`, {
      onBeforeLoad(win) {
        cy.stub(win.console, 'warn').callsFake((msg) => warnings.push(String(msg)))
      },
    })

    // erpnext window is focused → the override wins: the File menu shows erpnext's re-titled item.
    cy.get('[data-active-window]', { timeout: 15000 }).should('exist')
    cy.get(FILE_MENU).click()
    cy.contains('New ERPNext window').should('be.visible')
    cy.contains('New window').should('not.exist') // the OS default is shadowed, not duplicated

    // The shadow was logged AND attributed to erpnext as a clean override (never a true-tie).
    cy.wrap(null).should(() => {
      const shadow = warnings.find((w) => w.includes('frappe.window.new') && w.includes('erpnext'))
      expect(shadow, 'attributed shadow log').to.be.a('string')
      expect(shadow).to.not.include('true-tie')
    })
  })

  it('shows the OS default when a non-erpnext (frappe) window is focused', () => {
    cy.visit(`${ORIGIN}/os/frappe`)
    cy.get('[data-active-window]', { timeout: 15000 }).should('exist')
    cy.get(FILE_MENU).click()
    cy.contains('New window').should('be.visible')
    cy.contains('New ERPNext window').should('not.exist')
  })
})
