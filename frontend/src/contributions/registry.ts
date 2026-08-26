// THE SEAM. Everything the charter rests on passes through this file.
//
// It is deliberately tiny, and its size is the argument: the framework's side of the
// contribution contract is an index over a generated module. All the machinery is in
// plugin/contributions.js, at build time, where it costs nothing at runtime.

import contributions from 'virtual:frappe/contributions'
import { registerRecordPage, registerListPage } from '@framework/ui/experimental'

export const pages = contributions.pages
export const doctypeOfSlug: Record<string, string> = contributions.slugs

export function resolveSlug(slug: string) {
  return doctypeOfSlug[slug]
}

// Registration runs at import, before the router's first resolution (see main.ts).
// The app identity comes from the generated module, NOT from the file path at
// runtime -- that is the whole reason for synthesising rather than globbing
// (#42068 §9, reason 2: "a raw glob loses app identity").
for (const c of contributions.doctypes) {
  if (c.kind === 'record') registerRecordPage(c.doctype, c.handlers, { app: c.app })
  if (c.kind === 'list') registerListPage(c.doctype, c.handlers, { app: c.app })
}
