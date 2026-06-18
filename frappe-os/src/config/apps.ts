// Curated app registry for the installed apps (frappe, erpnext, crm). Display +
// structure only: branding, module→doctype grouping, and dashboard card
// DEFINITIONS. Card values are NOT stored here — they come live from card_value
// (count, or sum of `fieldname`).
//
// On a card: { label, sub, doctype, filters?, fieldname? }. `filters`/`fieldname`
// marked `verify` are curated guesses to reconcile against live meta in Phase 4;
// cards without them are plain counts and always safe.

// App logos use the same source as Desk: each app's `app_logo_url` (hooks.py),
// served by Frappe at a stable absolute path independent of the OS build base.
// `frappe` resolves to the gray "Framework" cube, matching the Desk app grid.
import type { AppDef, Pill } from '@/types'

export const APP: Record<string, AppDef> = {
  frappe: {
    id: 'frappe',
    name: 'Frappe',
    glyph: 'F',
    hex: '#171717',
    logo: '/assets/frappe/images/frappe-framework-logo.svg',
    hasDashboard: true,
    dashTitle: 'Home',
    recentDoctype: 'ToDo',
    cards: [
      { label: 'Users', sub: 'in this site', doctype: 'User' },
      { label: 'Open to-dos', sub: 'assigned tasks', doctype: 'ToDo', filters: { status: 'Open' } },
      { label: 'Files', sub: 'uploaded', doctype: 'File' },
      { label: 'Roles', sub: 'across apps', doctype: 'Role' },
    ],
    modules: [
      { name: 'Core', doctypes: ['User', 'Role', 'ToDo', 'File', 'Notification Log', 'Comment'] },
      { name: 'Website', doctypes: ['Web Page', 'Blog Post'] },
    ],
  },
  crm: {
    id: 'crm',
    name: 'CRM',
    glyph: 'C',
    hex: '#0a9a8d',
    logo: '/assets/crm/images/logo.svg',
    hasDashboard: true,
    dashTitle: 'Overview',
    recentDoctype: 'CRM Lead',
    cards: [
      { label: 'Open leads', sub: 'in the pipeline', doctype: 'CRM Lead', filters: { status: 'Open' } }, // verify status value
      { label: 'Pipeline value', sub: 'across deals', doctype: 'CRM Deal', fieldname: 'annual_revenue' }, // verify fieldname
      { label: 'Deals', sub: 'in progress', doctype: 'CRM Deal' },
      { label: 'Tasks', sub: 'to follow up', doctype: 'CRM Task' },
    ],
    modules: [
      { name: 'Sales', doctypes: ['CRM Lead', 'CRM Deal', 'Contact', 'CRM Organization'] },
      { name: 'Activity', doctypes: ['CRM Task', 'Note'] },
    ],
  },
  erpnext: {
    id: 'erpnext',
    name: 'ERPNext',
    glyph: 'E',
    hex: '#5b54e6',
    logo: '/assets/erpnext/images/erpnext-logo.svg',
    hasDashboard: true,
    dashTitle: 'Overview',
    recentDoctype: 'Sales Invoice',
    cards: [
      { label: 'Receivables', sub: 'outstanding', doctype: 'Sales Invoice', filters: { status: ['in', ['Unpaid', 'Overdue', 'Partly Paid']] }, fieldname: 'outstanding_amount' },
      { label: 'Open orders', sub: 'to fulfil', doctype: 'Sales Order' },
      { label: 'Items', sub: 'in catalog', doctype: 'Item' },
      { label: 'Overdue', sub: 'past due date', doctype: 'Sales Invoice', filters: { status: 'Overdue' } },
    ],
    modules: [
      { name: 'Selling', doctypes: ['Sales Invoice', 'Sales Order', 'Quotation', 'Customer'] },
      { name: 'Stock', doctypes: ['Item', 'Warehouse', 'Stock Entry', 'Delivery Note'] },
      { name: 'Accounts', doctypes: ['Payment Entry', 'Journal Entry'] },
    ],
  },
}

export const APP_ORDER = ['frappe', 'crm', 'erpnext']

// `appForDoctype` moved to store/registry.ts (it is a Registry projection over the app
// collection, not raw config). `initials`/`pill` stay here — pure presentation helpers.

export function initials(value?: string | null): string {
  if (!value) return '?'
  const parts = String(value).replace(/^[A-Z]+-/, '').trim().split(/[\s@._-]+/).filter(Boolean)
  if (!parts.length) return String(value).slice(0, 2).toUpperCase()
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

export function pill(theme?: string): Pill {
  const tone = theme || 'gray'
  return { bg: `var(--surface-${tone}-2)`, fg: `var(--ink-${tone}-7)` }
}
