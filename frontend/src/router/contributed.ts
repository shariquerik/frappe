// Contributed pages, from the synthesised virtual module.
//
// The whole file is nine lines because the plugin did the work at build time. There
// is no hook to read, no boot key to walk, no install order to respect -- the
// contributions are already in this bundle.

import { pages } from '@/contributions/registry'

export function contributedRoutes(app: string) {
  // Only the declaring app's pages. A ten-app bench does not put ten apps' pages in
  // one prefix's route table -- the same core-plus-declarer rule as boot (#42070 §4).
  return pages
    .filter((page) => page.app === app)
    .map((page) => ({ path: `/${page.slug}`, component: page.component }))
}

// Open, and #42113's: two apps could contribute to the same seam and the order they
// run in used to be install order. Install order is unreachable from a build-time
// glob. For PAGES it does not bite -- one app, one prefix, and collisions are refused
// at install. For doctype customizations of a FOREIGN doctype it does.
