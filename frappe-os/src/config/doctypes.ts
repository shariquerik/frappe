// Curated per-doctype IDENTITY (look) for the covered apps (frappe, erpnext, crm): color +
// icon only. Presentation semantics — title field, status field/colors, list columns — are no
// longer curated (ADR-0028): they come live from get_doctype_meta (the Record indicator spec +
// title_field). Field schemas, rows, and counts are live too. `generic` marks the placeholder
// metas that carry no bespoke look, kept only for the app-kind classification.

import { dtIcon } from './icons'
import type { DoctypeMeta } from '@/types'

const doctypes: Record<string, DoctypeMeta> = {}

function define(name: string, color: string): void {
  doctypes[name] = { label: name, color, icon: dtIcon(name) }
}

function defineGeneric(name: string, color: string): void {
  doctypes[name] = { label: name, color, icon: dtIcon(name), generic: true }
}

// Bespoke look (a hand-picked color); everything else is derived live.
define('CRM Lead', 'teal')
define('CRM Deal', 'green')
define('Sales Invoice', 'violet')
define('Item', 'orange')
define('ToDo', 'amber')
define('User', 'blue')

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
