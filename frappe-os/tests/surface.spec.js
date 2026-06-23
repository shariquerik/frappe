// Surface-driven sidebar dispatch (ADR-0018): a form Surface drives the Aspect rail; every
// other Surface keeps the app nav rail. Pure decision, unit-tested in isolation.
import { describe, expect, it } from 'vitest'
import {
  sidebarKind, dashboardSurface, listSurface, formSurface, settingsSurface, appletSurface,
  isAspectId, DEFAULT_ASPECT, FORM_ASPECTS,
} from '../src/surface/index'

describe('sidebarKind', () => {
  it('a form Surface drives the Aspect rail', () => {
    expect(sidebarKind(formSurface('CRM Lead', 'L-1'))).toBe('aspect')
  })

  it('list / dashboard / settings / applet Surfaces keep the nav rail', () => {
    expect(sidebarKind(listSurface('CRM Lead'))).toBe('nav')
    expect(sidebarKind(dashboardSurface('crm'))).toBe('nav')
    expect(sidebarKind(settingsSurface('crm'))).toBe('nav')
    expect(sidebarKind(appletSurface('frappe', 'my-todos'))).toBe('nav')
  })

  it('a null/absent Surface falls back to the nav rail', () => {
    expect(sidebarKind(null)).toBe('nav')
    expect(sidebarKind(undefined)).toBe('nav')
  })
})

describe('the Aspect set', () => {
  it('has stable ids with details as the default', () => {
    expect(FORM_ASPECTS.map((a) => a.id)).toEqual(['details', 'activities', 'email'])
    expect(DEFAULT_ASPECT).toBe('details')
  })

  it('isAspectId matches only the known ids', () => {
    expect(isAspectId('details')).toBe(true)
    expect(isAspectId('activities')).toBe(true)
    expect(isAspectId('email')).toBe(true)
    expect(isAspectId('L-1')).toBe(false)
    expect(isAspectId('')).toBe(false)
    expect(isAspectId(null)).toBe(false)
  })
})
