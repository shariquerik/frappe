// E2E for the Finder (ADR-0024) — a singleton `system`-role window that the unit suite
// can't reach: the real /finder route respawning the window from the URL, the dock
// launcher button opening it, the sidebar Location switch, and the System Settings
// precedent that a `system` window is NEVER written to the saved desktop blob.
//
// Like routing.cy.js, these need `yarn dev` proxying a logged-in bench (live boot).

const BLOB_KEY = 'frappe-os:desktop'

describe('Finder singleton window (ADR-0024)', () => {
  beforeEach(() => cy.clearLocalStorage())

  it('a /finder deep link opens the singleton Finder and survives a reload', () => {
    cy.visit('/os/finder')
    cy.get('[data-active-window]').should('have.attr', 'data-active-window', 'finder')
    cy.get('[data-win-id="finder"]').should('be.visible').contains('LOCATIONS')
    cy.reload()
    cy.location('pathname').should('eq', '/os/finder')
    cy.get('[data-win-id="finder"]').should('be.visible')
  })

  it('is transient — a `system` window is never written to the saved desktop blob', () => {
    // System Settings precedent: serialize() excludes settings/system roles, so opening
    // the Finder must not leak it into localStorage (it is respawned from URL, not persisted).
    cy.visit('/os/finder')
    cy.get('[data-win-id="finder"]').should('be.visible')
    cy.window().then((win) => {
      const blob = win.localStorage.getItem(BLOB_KEY)
      if (blob) expect(JSON.stringify(JSON.parse(blob).windows || [])).not.to.contain('finder')
    })
  })

  it('the dock launcher button opens the Finder; ⌘K still opens the palette', () => {
    cy.visit('/os/')
    cy.get('[title="Finder"]').click()
    cy.get('[data-win-id="finder"]').should('be.visible')
    cy.get('[data-active-window]').should('have.attr', 'data-active-window', 'finder')
    // ⌘K remains the command palette (the Launchpad-vs-Spotlight split) — unaffected.
    cy.get('body').type('{meta}k')
    cy.get('[data-win-id="finder"]').should('be.visible') // palette is an overlay; Finder stays
  })

  it('clicking a sidebar Location switches the body within the same window', () => {
    cy.visit('/os/finder')
    cy.get('[data-win-id="finder"]').should('be.visible')
    cy.get('[data-win-id="finder"]').contains('Doctypes').click()
    cy.get('[data-win-id="finder"]').should('be.visible') // still the one singleton window
    cy.location('pathname').should('eq', '/os/finder') // Location rides params, not the URL
  })
})
