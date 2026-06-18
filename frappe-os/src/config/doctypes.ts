// Curated per-doctype DISPLAY config for the covered apps (frappe, erpnext, crm).
// Display only — no records, no field schemas, no counts. Field schemas come live
// from get_doctype_meta; rows + counts come live from the records store.
//
// NOTE: listColumns `key`s are the curated display choice; verify them against live
// field names when wiring live lists (Phase 4).

import { dtIcon } from './icons'
import type { DoctypeMeta } from '@/types'

const doctypes: Record<string, DoctypeMeta> = {}

function define(name: string, color: string, config: Partial<DoctypeMeta> = {}): void {
  doctypes[name] = { label: name, color, icon: dtIcon(name), titleField: 'name', ...config }
}

// Shared status palette + a minimal column set for doctypes without a bespoke layout.
const GENERIC_STATUS_THEMES: Record<string, string> = {
  Active: 'green',
  Enabled: 'green',
  Open: 'blue',
  Draft: 'gray',
  Published: 'green',
  Submitted: 'green',
  Pending: 'amber',
}

function defineGeneric(name: string, color: string, config: Partial<DoctypeMeta> = {}): void {
  define(name, color, {
    generic: true,
    statusField: 'status',
    statusThemes: GENERIC_STATUS_THEMES,
    listColumns: [
      { key: 'name', label: name, primary: true, width: 'minmax(160px,1.5fr)' },
      { key: 'status', label: 'Status', type: 'status', width: '120px' },
      { key: 'modified', label: 'Modified', width: '120px' },
    ],
    ...config,
  })
}

define('CRM Lead', 'teal', {
  titleField: 'lead_name',
  statusField: 'status',
  statusThemes: { Open: 'blue', Replied: 'amber', Opportunity: 'green', Quotation: 'violet', Junk: 'red', Converted: 'green' },
  listColumns: [
    { key: 'lead_name', label: 'Lead', primary: true, width: 'minmax(150px,1.3fr)' },
    { key: 'organization_name', label: 'Organization' },
    { key: 'status', label: 'Status', type: 'status', width: '150px' },
    { key: 'email_id', label: 'Email' },
    { key: 'territory', label: 'Territory', width: '120px' },
    { key: 'lead_owner', label: 'Owner', type: 'avatar', width: '160px' },
  ],
})

define('CRM Deal', 'green', {
  titleField: 'organization',
  statusField: 'stage',
  statusThemes: { Qualification: 'blue', 'Demo/Making': 'amber', Proposal: 'violet', Negotiation: 'amber', Won: 'green', Lost: 'red' },
  listColumns: [
    { key: 'organization', label: 'Deal', primary: true, width: 'minmax(160px,1.3fr)' },
    { key: 'stage', label: 'Stage', type: 'status', width: '150px' },
    { key: 'amount', label: 'Amount', type: 'currency', width: '130px' },
    { key: 'close_date', label: 'Close date', width: '120px' },
    { key: 'deal_owner', label: 'Owner', type: 'avatar', width: '160px' },
  ],
})

define('Sales Invoice', 'violet', {
  titleField: 'customer',
  statusField: 'status',
  statusThemes: { Paid: 'green', Unpaid: 'amber', Overdue: 'red', Draft: 'gray', 'Partly Paid': 'blue', Return: 'gray' },
  listColumns: [
    { key: 'name', label: 'Invoice', primary: true, width: '170px' },
    { key: 'customer', label: 'Customer', width: 'minmax(140px,1.2fr)' },
    { key: 'status', label: 'Status', type: 'status', width: '130px' },
    { key: 'posting_date', label: 'Date', width: '120px' },
    { key: 'grand_total', label: 'Total', type: 'currency', width: '130px' },
  ],
})

define('Item', 'orange', {
  titleField: 'item_name',
  statusField: 'status_label',
  statusThemes: { 'In Stock': 'green', 'Low Stock': 'amber', 'Out of Stock': 'red' },
  listColumns: [
    { key: 'item_code', label: 'Item code', primary: true, width: '150px' },
    { key: 'item_name', label: 'Name', width: 'minmax(140px,1.3fr)' },
    { key: 'item_group', label: 'Group', width: '140px' },
    { key: 'status_label', label: 'Stock', type: 'status', width: '130px' },
    { key: 'stock_qty', label: 'Qty', type: 'int', width: '90px' },
  ],
})

define('ToDo', 'amber', {
  titleField: 'description',
  statusField: 'status',
  statusThemes: { Open: 'blue', Closed: 'green', Cancelled: 'gray', High: 'red', Medium: 'amber', Low: 'gray' },
  listColumns: [
    { key: 'description', label: 'Task', primary: true, width: 'minmax(180px,1.6fr)' },
    { key: 'priority', label: 'Priority', type: 'status', width: '120px' },
    { key: 'status', label: 'Status', type: 'status', width: '120px' },
    { key: 'date', label: 'Due', width: '120px' },
    { key: 'allocated_to', label: 'Assigned to', type: 'avatar', width: '160px' },
  ],
})

define('User', 'blue', {
  titleField: 'full_name',
  statusField: 'enabled_label',
  statusThemes: { Active: 'green', Disabled: 'gray' },
  listColumns: [
    { key: 'full_name', label: 'User', type: 'avatar', primary: true, width: 'minmax(160px,1.4fr)' },
    { key: 'email', label: 'Email' },
    { key: 'role_profile', label: 'Role profile', width: '160px' },
    { key: 'enabled_label', label: 'Status', type: 'status', width: '120px' },
  ],
})

// CRM
defineGeneric('Contact', 'teal')
defineGeneric('CRM Organization', 'teal')
defineGeneric('CRM Task', 'teal')
defineGeneric('Note', 'teal')

// ERPNext
defineGeneric('Sales Order', 'violet')
defineGeneric('Quotation', 'violet')
defineGeneric('Customer', 'violet')
defineGeneric('Warehouse', 'orange')
defineGeneric('Stock Entry', 'orange')
defineGeneric('Delivery Note', 'orange')
defineGeneric('Payment Entry', 'green')
defineGeneric('Journal Entry', 'green')

// Frappe
defineGeneric('Role', 'gray')
defineGeneric('File', 'gray')
defineGeneric('Notification Log', 'gray')
defineGeneric('Comment', 'gray')
defineGeneric('Web Page', 'gray')
defineGeneric('Blog Post', 'gray')

export { doctypes }
// `getMeta` moved to store/registry.ts (it is a Registry projection, not raw config).
