// HOW ONE ROUTER SERVES N PREFIXES.
//
// This is the scaffold's sharpest claim, and the one most worth attacking.
//
// The claim: **the router's base is boot.app_route, set at runtime, and every route
// path in the system is prefix-relative.** There is exactly one prefix live in a
// given page load -- the one the request came in at -- so the router never sees two.
//
// #42065 removed __FRONTEND_ROUTE__ with the words "one router at base `/`, prefix
// asked for at runtime". This scaffold reads that second clause as load-bearing and
// the first as shorthand: `base: '/'` plus prefix-carrying route paths is a DIFFERENT
// design, and a worse one. The two are laid out below so the choice is explicit.
//
// ---------------------------------------------------------------------------
// OPTION A (taken here): base = boot.app_route, paths prefix-relative
//
//   createWebHistory('/crmv2')       routes: '/:doctype/:id'   page: 'deals'
//
//   + An app author never writes their own prefix anywhere in JS. The prefix lives
//     in hooks.py and nowhere else, which is what "Python-only truth" (#42065)
//     actually costs if you take it seriously.
//   + The out-of-scope /crmv2 -> /crm cutover becomes a one-line hooks.py edit. Under
//     option B it is a find-and-replace across every contributed route.
//   + router.push('/crm-deal/X') needs no prefix knowledge, so contributed code is
//     portable between prefixes for free.
//   - Cross-prefix links cannot be router.push at all -- '/deskv2/user' would be
//     rewritten to '/crmv2/deskv2/user'. They must be real navigations.
//
// OPTION B (rejected): base = '/', paths carry the prefix
//
//   createWebHistory('/')            routes: '/crmv2/:doctype/:id'
//
//   + Cross-prefix navigation is an ordinary router.push.
//   - The prefix is now in the route table, so it is in JS, so it is no longer
//     Python-only truth. Every contributed page must interpolate it.
//   - It implies the router CAN serve two prefixes at once, which is false: boot is
//     prefix-scoped (#42070 §4), so arriving at /deskv2 with /crmv2's boot gives you
//     a page with the wrong app's contributed boot keys and no way to notice.
//
// The rejection turns on that last point. Option B's advantage is cross-prefix
// router.push, and cross-prefix router.push is precisely the thing #42070 already
// established cannot work client-side without a boot re-fetch. So B pays a real cost
// to enable something that is already known not to be free.
//
// **This is the seam #42102 owns.** If #42102 decides the boot re-fetch is cheap and
// crossing should be client-side, option A is wrong and this file is the evidence.
// ---------------------------------------------------------------------------

import { createRouter, createWebHistory } from 'vue-router'
import type { Boot } from '@/boot'
import { generatedRoutes } from './generated'
import { contributedRoutes } from './contributed'
import { resolveSlug } from '@/contributions/registry'

export function createShellRouter(boot: Boot) {
  const router = createRouter({
    // The prefix, asked for at runtime. The one line this whole file argues about.
    history: createWebHistory(boot.app_route),
    routes: [
      // Order matters and is not arbitrary: contributed pages are matched BEFORE
      // generated doctype routes, because '/deals' must beat '/:doctype'. They share
      // one flat namespace (#42068 §5) and vue-router has no install-time guard, so
      // this ordering is what the Python-side collision check protects.
      ...contributedRoutes(boot.app),
      ...generatedRoutes(),
      { path: '/:pathMatch(.*)*', component: () => import('@/shell/NotFound.vue') },
    ],
  })

  // Slug -> real doctype name, resolved through the registry #42068 §2 fixed as
  // permission-independent. CRM's frontend2 does this today with a server call
  // (resolveRouteDoctype); here the map is in the bundle, so it is synchronous.
  router.beforeResolve((to) => {
    const segment = to.params.doctype
    if (typeof segment !== 'string' || !segment) return true
    const doctype = resolveSlug(segment)
    if (!doctype || doctype === segment) return true
    return { ...to, params: { ...to.params, doctype }, replace: true }
  })

  return router
}
