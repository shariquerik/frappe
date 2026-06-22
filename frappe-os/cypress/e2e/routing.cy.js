// E2E covers ONLY what the Vitest unit suite cannot: the real browser integration
// around the focus<->URL bridge — the vue-router /os/ base, history seeding, browser
// back/forward, DOM-driven minimize, and localStorage hydration across a reload.
// The pure projection/decision logic (pathForFocus, applyRoute) is unit-tested.
//
// NOTE: these specs need `yarn dev` proxying to a logged-in bench (see
// cypress.config.js) — the app boots from a live whitelisted boot() now, so they
// don't run on a bare/Guest dev server.

const BLOB_KEY = 'frappe-os:desktop'

// Seed a saved desktop (one frappe window) into localStorage before the app boots.
function seedSession(activeId) {
  return {
    onBeforeLoad(win) {
      win.localStorage.setItem(
        BLOB_KEY,
        JSON.stringify({
          version: 1,
          windows: [{ id: 'app:frappe', type: 'app', appId: 'frappe', view: { mode: 'dashboard' } }],
          geo: { 'app:frappe': { z: 1, x: 80, y: 80, w: 760, h: 600 } },
          activeId,
        }),
      )
    },
  }
}

const isBare = () => {
  cy.location('pathname').should('match', /^\/os\/?$/)
  cy.get('[data-active-window]').should('have.attr', 'data-active-window', '')
}

describe('router /os/ base + cold boot', () => {
  beforeEach(() => cy.clearLocalStorage())

  it('bare /os with a saved focused session does NOT redirect to /os/frappe', () => {
    // The regression that started this: hydrated focus must not mirror into the URL.
    cy.visit('/os/', seedSession('app:frappe'))
    isBare()
  })

  it('/os (no trailing slash) resolves under the base and stays bare', () => {
    cy.visit('/os', seedSession(null))
    isBare()
  })

  it('a deep link opens the app and the URL survives a full reload', () => {
    cy.visit('/os/frappe')
    cy.get('[data-active-window]').should('have.attr', 'data-active-window', 'app:frappe')
    cy.reload()
    cy.location('pathname').should('eq', '/os/frappe')
    cy.get('[data-win-id="app:frappe"]').should('be.visible')
  })

  it('an unknown app settles on the bare desktop', () => {
    cy.visit('/os/badapp')
    isBare()
  })

  it('an applet deep-link opens the applet window and survives a reload', () => {
    // /os/<app>/<appletId> resolves an applet contribution (ADR-0009/0012). The
    // window is app:frappe; the rendered heading distinguishes it from the dashboard.
    cy.visit('/os/frappe/my-todos')
    cy.get('[data-win-id="app:frappe"]').should('be.visible').contains('My open ToDos')
    cy.reload()
    cy.location('pathname').should('eq', '/os/frappe/my-todos')
    cy.get('[data-win-id="app:frappe"]').should('be.visible').contains('My open ToDos')
  })
})

describe('history + DOM interaction', () => {
  beforeEach(() => cy.clearLocalStorage())

  it('browser back from an app to the desktop clears focus', () => {
    cy.visit('/os/')
    cy.visit('/os/frappe')
    cy.go('back')
    isBare()
  })

  it('browser forward re-opens the app window', () => {
    cy.visit('/os/')
    cy.visit('/os/frappe')
    cy.get('[data-win-id="app:frappe"]').should('be.visible')
    cy.go('back')
    isBare()
    cy.go('forward')
    cy.location('pathname').should('eq', '/os/frappe')
    cy.get('[data-win-id="app:frappe"]').should('be.visible')
  })

  it('clicking minimize on the only window returns the URL to bare /os', () => {
    cy.visit('/os/frappe')
    cy.get('[data-win-id="app:frappe"] [title="Minimize"]').click()
    isBare()
  })
})

describe('multiple instances of one app are individually addressable', () => {
  // A second window of the same app is a distinct INSTANCE: the first owns the bare
  // `/os/<app>`, extras carry `?instance=n`. The query keeps twins addressable without
  // putting window identity in the content path. Needs a live bench like the specs above.
  beforeEach(() => cy.clearLocalStorage())

  it('?instance=2 opens a distinct twin window and survives a reload', () => {
    cy.visit('/os/frappe?instance=2')
    cy.get('[data-active-window]').should('have.attr', 'data-active-window', 'app:frappe#2')
    cy.location('search').should('eq', '?instance=2')
    cy.reload()
    cy.get('[data-win-id="app:frappe#2"]').should('be.visible')
    cy.location('search').should('eq', '?instance=2')
  })

  it('browser back/forward toggles focus between the canonical window and its twin', () => {
    cy.visit('/os/frappe') // canonical
    cy.get('[data-active-window]').should('have.attr', 'data-active-window', 'app:frappe')
    cy.visit('/os/frappe?instance=2') // twin — a distinct timeline entry (same path, +query)
    cy.get('[data-active-window]').should('have.attr', 'data-active-window', 'app:frappe#2')

    cy.go('back')
    cy.location('search').should('eq', '')
    cy.get('[data-active-window]').should('have.attr', 'data-active-window', 'app:frappe')

    cy.go('forward')
    cy.location('search').should('eq', '?instance=2')
    cy.get('[data-active-window]').should('have.attr', 'data-active-window', 'app:frappe#2')
  })
})
