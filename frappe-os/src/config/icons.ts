// Doctype/app → icon lookup. Each value is a `lucide-*` utility class (frappe-ui's
// tailwind preset masks the matching lucide-static SVG; size with `size-*`, tint
// with `text-*`). Display-only curated config (no data); shared by the desktop,
// dock, lists and palette.

// Typed as a string map (not the literal) so dynamic lookups — `ICON[name]` and
// curated keys with no entry — type as `string` and degrade to an empty class at
// runtime rather than erroring at compile time. The values are bound dynamically
// (`:class`), so every name here must be listed in tailwind.config's safelist for
// Tailwind's JIT to emit it.
export const ICON: Record<string, string> = {
  table: 'lucide-table',
  user: 'lucide-user',
  users: 'lucide-users',
  receipt: 'lucide-receipt',
  box: 'lucide-package',
  building: 'lucide-building',
  file: 'lucide-file',
  web: 'lucide-globe',
  shield: 'lucide-shield',
  grid: 'lucide-layout-grid',
  briefcase: 'lucide-briefcase',
  cart: 'lucide-shopping-cart',
  truck: 'lucide-truck',
  wallet: 'lucide-wallet',
  note: 'lucide-sticky-note',
  check: 'lucide-list-checks',
  bell: 'lucide-bell',
  drive: 'lucide-cloud',
  cog: 'lucide-settings',
  plug: 'lucide-plug',
  sliders: 'lucide-sliders-horizontal',
  palette: 'lucide-palette',
  calendar: 'lucide-calendar',
}

// Per-doctype icon for the covered apps (frappe, erpnext, crm). Falls back to the
// generic table glyph for anything else.
const DOCTYPE_ICON: Record<string, string> = {
  'User': ICON.user,
  'Contact': ICON.user,
  'CRM Lead': ICON.user,
  'Customer': ICON.building,
  'CRM Organization': ICON.building,
  'Warehouse': ICON.building,
  'Sales Invoice': ICON.receipt,
  'Quotation': ICON.receipt,
  'CRM Deal': ICON.receipt,
  'Sales Order': ICON.cart,
  'Delivery Note': ICON.truck,
  'Payment Entry': ICON.wallet,
  'Journal Entry': ICON.wallet,
  'Item': ICON.box,
  'Stock Entry': ICON.box,
  'ToDo': ICON.check,
  'CRM Task': ICON.check,
  'File': ICON.file,
  'Web Page': ICON.web,
  'Blog Post': ICON.web,
  'Role': ICON.shield,
  'Note': ICON.note,
  'Comment': ICON.note,
  'Notification Log': ICON.bell,
}

export function dtIcon(doctype: string): string {
  return DOCTYPE_ICON[doctype] || ICON.table
}
