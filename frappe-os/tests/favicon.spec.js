// Favicon mirroring (desktop/favicon.ts): the pure focused-window → href resolver and
// the idempotent DOM apply. The reactive faviconHref computed is just these two glued to
// the store, so the specs pin the seams, not the singleton.
import { beforeEach, describe, expect, it } from 'vitest'
import { faviconFor, applyFavicon, OS_FAVICON } from '../src/desktop/favicon'

const LOGOS = { crm: '/assets/crm/images/logo.svg' }
const logoOf = (appId) => LOGOS[appId]

describe('faviconFor', () => {
  it('bare desktop (no focused window) falls back to the OS icon', () => {
    expect(faviconFor(undefined, logoOf)).toBe(OS_FAVICON)
  })

  it('an app window carries its app logo into the tab', () => {
    const win = { id: 'app:crm', surface: { kind: 'builtin', appId: 'crm', view: 'dashboard' } }
    expect(faviconFor(win, logoOf)).toBe(LOGOS.crm)
  })

  it('an app window navigated onto another app keeps the SURFACE app identity', () => {
    const win = { id: 'app:frappe', surface: { kind: 'builtin', appId: 'crm', view: 'list', doctype: 'CRM Lead' } }
    expect(faviconFor(win, logoOf)).toBe(LOGOS.crm)
  })

  it('system windows (Settings/Finder) and unbranded apps keep the OS icon', () => {
    expect(faviconFor({ id: 'settings', surface: { kind: 'builtin', view: 'settings' } }, logoOf)).toBe(OS_FAVICON)
    expect(faviconFor({ id: 'finder', surface: { kind: 'builtin', view: 'finder' } }, logoOf)).toBe(OS_FAVICON)
    expect(faviconFor({ id: 'app:hr', surface: { kind: 'builtin', appId: 'hr' } }, logoOf)).toBe(OS_FAVICON)
  })
})

describe('applyFavicon', () => {
  beforeEach(() => { document.head.querySelectorAll('link[rel="icon"]').forEach((l) => l.remove()) })

  it('creates the icon link when the host page shipped none', () => {
    applyFavicon('/a.png')
    expect(document.querySelector('link[rel="icon"]').getAttribute('href')).toBe('/a.png')
  })

  it('retargets the existing link instead of stacking duplicates', () => {
    applyFavicon('/a.png')
    applyFavicon('/b.svg')
    const links = document.querySelectorAll('link[rel="icon"]')
    expect(links.length).toBe(1)
    expect(links[0].getAttribute('href')).toBe('/b.svg')
  })
})
