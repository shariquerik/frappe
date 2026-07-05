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

describe('form Aspects are addressable in the URL (ADR-0018)', () => {
  // A form Surface carries an Aspect coordinate projected as a trailing path segment; Details
  // is the default (bare path). The record need not exist — the form Surface (and its Aspect
  // rail) render regardless; records load live and the body shows its own not-found state.
  // Needs a live bench behind `yarn dev`, like the specs above.
  // ToDo lives in frappe's `desk` workspace, so opening the record canonicalises onto that workbench
  // (ADR-0042): the URL carries the `/desk` segment and the window id is `app:frappe/desk`.
  const FORM = '/os/frappe/desk/ToDo/ASPECT-TEST-1'
  beforeEach(() => cy.clearLocalStorage())

  it('selecting a non-default Aspect updates the URL to the trailing segment', () => {
    cy.visit(FORM)
    cy.get('[data-win-id="app:frappe/desk"]').should('be.visible')
    cy.location('pathname').should('eq', '/os/frappe/desk/ToDo/ASPECT-TEST-1') // Details = bare path
    cy.get('[data-aspect="activities"]').click()
    cy.location('pathname').should('eq', '/os/frappe/desk/ToDo/ASPECT-TEST-1/activities')
    cy.get('[data-win-id="app:frappe/desk"]').contains('Coming soon')
  })

  it('a reload on a non-default Aspect restores that Aspect', () => {
    cy.visit(FORM + '/activities')
    cy.get('[data-win-id="app:frappe/desk"]').should('be.visible').contains('Coming soon')
    cy.reload()
    cy.location('pathname').should('eq', '/os/frappe/desk/ToDo/ASPECT-TEST-1/activities')
    cy.get('[data-win-id="app:frappe/desk"]').contains('Coming soon')
  })

  it('browser back/forward steps between Aspects of the same record', () => {
    cy.visit(FORM) // Details
    cy.get('[data-aspect="email"]').click()
    cy.location('pathname').should('eq', '/os/frappe/desk/ToDo/ASPECT-TEST-1/email')
    cy.go('back')
    cy.location('pathname').should('eq', '/os/frappe/desk/ToDo/ASPECT-TEST-1') // back to Details
    cy.go('forward')
    cy.location('pathname').should('eq', '/os/frappe/desk/ToDo/ASPECT-TEST-1/email')
  })

  it('an unknown trailing segment produces no phantom Aspect (settles on the bare form)', () => {
    cy.visit(FORM + '/not-an-aspect')
    cy.get('[data-win-id="app:frappe/desk"]').should('be.visible')
    cy.location('pathname').should('eq', '/os/frappe/desk/ToDo/ASPECT-TEST-1')
  })
})

describe('a workspace window is addressable in the URL (ADR-0042)', () => {
  // The workspace is part of window IDENTITY, projected as a segment between app and doctype
  // (/erpnext/selling/Customer). The window id carries it (`app:erpnext/selling`), so the deep link
  // round-trips through a reload to the SAME window, and two workspaces of one app are two windows.
  // 'selling' is a real seeded erpnext workspace (frappe.scrub('Selling')). Needs a live bench.
  beforeEach(() => cy.clearLocalStorage())

  it('a workspace-scoped list deep-link opens the (app, workspace) window and survives a reload', () => {
    cy.visit('/os/erpnext/selling/Customer')
    cy.get('[data-active-window]').should('have.attr', 'data-active-window', 'app:erpnext/selling')
    cy.reload()
    cy.location('pathname').should('eq', '/os/erpnext/selling/Customer')
    cy.get('[data-win-id="app:erpnext/selling"]').should('be.visible')
  })

  it('a workspace with no doctype opens that workspace window', () => {
    cy.visit('/os/erpnext/selling')
    cy.location('pathname').should('eq', '/os/erpnext/selling')
    cy.get('[data-active-window]').should('have.attr', 'data-active-window', 'app:erpnext/selling')
  })

  it('two workspaces of one app are two windows, both reachable', () => {
    // Two workbenches side by side is the point of ADR-0042. A fresh `cy.visit` cold-boots ONE
    // window from the URL, so the SECOND is restored from a saved desktop that already holds both;
    // visiting Stock's URL then focuses Stock while Selling stays open alongside (unfocused).
    cy.visit('/os/erpnext/stock', {
      onBeforeLoad(win) {
        win.localStorage.setItem(
          BLOB_KEY,
          JSON.stringify({
            version: 2,
            windows: [
              { id: 'app:erpnext/selling', surface: { kind: 'builtin', view: 'dashboard', appId: 'erpnext' } },
              { id: 'app:erpnext/stock', surface: { kind: 'builtin', view: 'dashboard', appId: 'erpnext' } },
            ],
            geo: {
              'app:erpnext/selling': { z: 1, x: 60, y: 60, w: 640, h: 520 },
              'app:erpnext/stock': { z: 2, x: 720, y: 60, w: 640, h: 520 },
            },
            activeId: 'app:erpnext/stock',
          }),
        )
      },
    })
    cy.get('[data-active-window]').should('have.attr', 'data-active-window', 'app:erpnext/stock')
    cy.get('[data-win-id="app:erpnext/stock"]').should('be.visible') // the focused workbench
    cy.get('[data-win-id="app:erpnext/selling"]').should('exist') // the second is restored alongside
  })

  it('a workspace-less form URL canonicalises onto the doctype workbench (ADR-0042)', () => {
    // /erpnext/Customer/<name>: 'Customer' is not a workspace segment, so it parses as the doctype;
    // opening it derives Customer's canonical workspace (`selling`), so the URL gains that segment and
    // the window is the `(erpnext, selling)` workbench — every entry point lands the doctype there.
    cy.visit('/os/erpnext/Customer/CUST-CY-1')
    cy.location('pathname').should('eq', '/os/erpnext/selling/Customer/CUST-CY-1')
    cy.get('[data-win-id="app:erpnext/selling"]').should('be.visible')
  })

  it('a bare doctype URL (/os/Contact) canonicalises onto the doctype workbench', () => {
    // No app segment at all: 'Contact' is read as the doctype (parseSegments fallback), resolved under
    // its own app (frappe) and its canonical workspace (`contacts`) — so a hand-typed /os/<Doctype>
    // lands on the workbench instead of bouncing back to the bare desktop.
    cy.visit('/os/Contact')
    cy.location('pathname').should('eq', '/os/frappe/contacts/Contact')
    cy.get('[data-win-id="app:frappe/contacts"]').should('be.visible')
  })
})

describe('the workbench sidebar lists the workspace doctypes (ADR-0042, slice 03)', () => {
  // A workbench window's sidebar is its workspace's DERIVED doctypes (source module's doctypes,
  // child tables + settings singles excluded), fetched server-side. 'selling' and 'stock' are real
  // seeded erpnext workspaces; 'demoday' is a genuine single-workspace app. Needs a live bench.
  beforeEach(() => cy.clearLocalStorage())

  it('shows the workspace-scoped doctypes, not the whole app', () => {
    cy.visit('/os/erpnext/selling')
    // Selling's module holds Quotation + Sales Order; Stock's Item does NOT belong to it.
    cy.get('[data-win-id="app:erpnext/selling"]').should('be.visible').within(() => {
      cy.contains('Quotation').should('be.visible')
      cy.contains('Sales Order').should('be.visible')
    })
  })

  it('a different workspace of the same app shows a different doctype set', () => {
    cy.visit('/os/erpnext/stock')
    cy.get('[data-win-id="app:erpnext/stock"]').should('be.visible').within(() => {
      cy.contains('Item').should('be.visible') // Stock module doctype
    })
  })

  it('a single-workspace app opens its workbench directly — no hub (the app is the window)', () => {
    cy.visit('/os/demoday')
    // openApp resolves demoday to its one workspace and opens the workbench window.
    cy.get('[data-active-window]').should('have.attr', 'data-active-window', 'app:demoday/demo_day')
    cy.get('[data-win-id="app:demoday/demo_day"]').should('be.visible').contains('Demo Feedback')
  })
})

describe('the hub lists workspaces and opens them side by side (ADR-0042, slice 04)', () => {
  // Opening a multi-workspace app opens the HUB: a plain app window whose sidebar lists the app's
  // workspaces (not doctypes) and whose body is the app-wide overview. Clicking a workspace opens
  // its workbench in a NEW window; a second workspace opens a second window alongside — two
  // workbenches open at once is the whole point of ADR-0042. Selling/Stock are real seeded erpnext
  // workspaces. Needs a live bench.
  beforeEach(() => cy.clearLocalStorage())

  it('opens the hub: the app window lists its workspaces, one flagged Default', () => {
    cy.visit('/os/erpnext')
    cy.get('[data-active-window]').should('have.attr', 'data-active-window', 'app:erpnext')
    cy.get('[data-win-id="app:erpnext"]').should('be.visible').within(() => {
      cy.contains('Selling').should('be.visible') // a workspace row, not a doctype
      cy.contains('Stock').should('be.visible')
      cy.contains('Default').should('be.visible') // the is_default workspace is flagged
    })
  })

  it('clicking two workspaces opens two workbench windows, both visible side by side', () => {
    cy.visit('/os/erpnext')
    // Open Selling from the hub → its own workbench window.
    cy.get('[data-win-id="app:erpnext"]').contains('Selling').click()
    cy.get('[data-win-id="app:erpnext/selling"]').should('be.visible')
    // Open Stock from the hub too → a second window; Selling must stay visible alongside it.
    cy.get('[data-win-id="app:erpnext"]').contains('Stock').click({ force: true })
    cy.get('[data-win-id="app:erpnext/stock"]').should('be.visible')
    cy.get('[data-win-id="app:erpnext/selling"]').should('be.visible')
    // Both survive a reload visible — the unfocused workbench is not wrongly hidden on hydrate.
    // Wait for the 250ms-debounced autosave to persist BOTH windows before reloading, else the
    // reload cold-boots from an unsaved desktop and only the URL window (stock) is recreated.
    cy.window()
      .its('localStorage')
      .invoke('getItem', 'frappe-os:desktop')
      .should('contain', 'app:erpnext/selling')
    cy.reload()
    cy.get('[data-win-id="app:erpnext/stock"]').should('be.visible')
    cy.get('[data-win-id="app:erpnext/selling"]').should('be.visible')
  })
})

describe('Settings panes are addressable in the URL (ADR-0027)', () => {
  // The per-user Settings window carries a pane coordinate projected as a trailing path
  // segment; General is the default (bare /settings path). Needs a live bench behind `yarn dev`.
  beforeEach(() => cy.clearLocalStorage())

  it('a pane deep-link opens Settings and the URL survives a reload', () => {
    cy.visit('/os/settings/account')
    cy.get('[data-active-window]').should('have.attr', 'data-active-window', 'settings')
    cy.reload()
    cy.location('pathname').should('eq', '/os/settings/account')
    cy.get('[data-active-window]').should('have.attr', 'data-active-window', 'settings')
  })

  it('the default (General) pane stays on the bare /settings path', () => {
    cy.visit('/os/settings')
    cy.location('pathname').should('eq', '/os/settings')
    cy.get('[data-active-window]').should('have.attr', 'data-active-window', 'settings')
  })

  it('browser back/forward steps between Settings panes', () => {
    cy.visit('/os/settings') // General (bare)
    cy.visit('/os/settings/appearance')
    cy.location('pathname').should('eq', '/os/settings/appearance')
    cy.go('back')
    cy.location('pathname').should('eq', '/os/settings')
    cy.go('forward')
    cy.location('pathname').should('eq', '/os/settings/appearance')
  })

  it('an unknown pane slug settles on the default Settings pane', () => {
    cy.visit('/os/settings/not-a-pane')
    cy.get('[data-active-window]').should('have.attr', 'data-active-window', 'settings')
  })
})

describe('app-settings panes are addressable in the URL', () => {
  // The per-app settings window carries a pane coordinate projected as a trailing path segment;
  // General is the default (bare /<app>/settings path). Needs a live bench behind `yarn dev`.
  beforeEach(() => cy.clearLocalStorage())

  it('a pane deep-link opens app-settings and the URL survives a reload', () => {
    cy.visit('/os/frappe/settings/members')
    cy.get('[data-active-window]').should('have.attr', 'data-active-window', 'app-settings:frappe')
    cy.reload()
    cy.location('pathname').should('eq', '/os/frappe/settings/members')
    cy.get('[data-active-window]').should('have.attr', 'data-active-window', 'app-settings:frappe')
  })

  it('the default (General) pane stays on the bare /<app>/settings path', () => {
    cy.visit('/os/frappe/settings')
    cy.location('pathname').should('eq', '/os/frappe/settings')
    cy.get('[data-active-window]').should('have.attr', 'data-active-window', 'app-settings:frappe')
  })

  it('browser back/forward steps between app-settings panes', () => {
    cy.visit('/os/frappe/settings') // General (bare)
    cy.visit('/os/frappe/settings/integrations')
    cy.location('pathname').should('eq', '/os/frappe/settings/integrations')
    cy.go('back')
    cy.location('pathname').should('eq', '/os/frappe/settings')
    cy.go('forward')
    cy.location('pathname').should('eq', '/os/frappe/settings/integrations')
  })
})

describe('multiple instances of one app are individually addressable', () => {
  // A second window of the same app is a distinct INSTANCE: the first owns the bare
  // `/os/<app>`, extras carry `?instance=n`. The query keeps instances addressable without
  // putting window identity in the content path. Needs a live bench like the specs above.
  beforeEach(() => cy.clearLocalStorage())

  it('?instance=2 opens a distinct instance window and survives a reload', () => {
    cy.visit('/os/frappe?instance=2')
    cy.get('[data-active-window]').should('have.attr', 'data-active-window', 'app:frappe#2')
    cy.location('search').should('eq', '?instance=2')
    cy.reload()
    cy.get('[data-win-id="app:frappe#2"]').should('be.visible')
    cy.location('search').should('eq', '?instance=2')
  })

  it('browser back/forward toggles focus between the canonical window and its instance', () => {
    cy.visit('/os/frappe') // canonical
    cy.get('[data-active-window]').should('have.attr', 'data-active-window', 'app:frappe')
    cy.visit('/os/frappe?instance=2') // instance — a distinct timeline entry (same path, +query)
    cy.get('[data-active-window]').should('have.attr', 'data-active-window', 'app:frappe#2')

    cy.go('back')
    cy.location('search').should('eq', '')
    cy.get('[data-active-window]').should('have.attr', 'data-active-window', 'app:frappe')

    cy.go('forward')
    cy.location('search').should('eq', '?instance=2')
    cy.get('[data-active-window]').should('have.attr', 'data-active-window', 'app:frappe#2')
  })
})
