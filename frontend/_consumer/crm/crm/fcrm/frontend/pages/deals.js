// crm/crm/fcrm/frontend/pages/deals.js
//
// Location DECIDED on #42072: <module>/frontend/pages/<slug>.js. The `frontend/`
// segment is load-bearing -- <module>/page/ is already desk v1's Page doctype and
// templates/pages/ is already website templates. See _consumer/README.md.
//
// A genuinely new page, served at /crmv2/deals -- flat, beside /crmv2/crm-deal,
// with the collision caught at install (#42068 §5). The filename is the slug;
// the app and module fall out of the path, so it keeps "the path is identity".
//
// The route path is PREFIX-RELATIVE. The author writes 'deals', never '/crmv2/deals'
// and never '/crm/deals' -- see src/router/index.ts. That is what makes the
// out-of-scope /crmv2 -> /crm cutover a one-line hooks.py change with no app-side
// route edits at all.

export default {
  title: 'Deals',
  component: () => import('./DealsPage.vue'),
}
