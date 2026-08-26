// The routes EVERY app gets with no declaration at all -- charter item 2's
// "default first" made literal. An app that writes only `app_route = "crmv2"` in
// hooks.py gets all of this.
//
// Shapes are #42068 §3's. Note what is a path segment and what is a query param:
// path is identity, query is context.

export function generatedRoutes() {
  return [
    { path: '/', component: () => import('@/pages/Home.vue') },

    // /crmv2/crm-deal
    { path: '/:doctype', component: () => import('@/pages/List.vue') },

    // /crmv2/crm-deal/view/open-deals -- a SAVED view, not a view type (#42068 §3).
    // v1's type names (report/kanban/calendar) become reserved saved-view ids.
    { path: '/:doctype/view/:viewName', component: () => import('@/pages/List.vue') },

    // /crmv2/crm-deal/CRM-DEAL-01?view=open-deals&layout=Compact&from=crmv2
    // None of those three is a path segment, and that is a decision, not an omission.
    { path: '/:doctype/:name', component: () => import('@/pages/Record.vue') },
  ]
}

// NOT here, deliberately:
//   - no per-doctype route. The doctype is a param, so a bench with 400 doctypes has
//     4 routes, not 1,600. #42066 measured 143 microseconds per werkzeug rule for the
//     server-side equivalent and that measurement is why.
//   - no opt-out. An app cannot hide its doctype from these routes (#42068 §6).
