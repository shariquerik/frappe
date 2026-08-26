# The app author's side

Everything CRM writes to be served at `/crmv2` with a customized deal page, one genuinely
new page, and a customization of frappe's `Contact`. **Nine files, three of them one line.**

```
crm/
  hooks.py                                      # +2 lines
  boot.py                                       # NEW, ~8 lines
  package.json                                  # unchanged in shape
  crm/fcrm/doctype/crm_deal/frontend/record.js  # customize own doctype
  crm/fcrm/doctype/crm_deal/frontend/list.js    # customize own list
  crm/fcrm/frontend/pages/deals.js              # a genuinely new page   <-- SEE BELOW
  crm/fcrm/custom/contact/record.js             # customize frappe's Contact
```

Deleted at the same time: `crm/frontend2/vite.config.js`, `crm/frontend2/index.html`,
`crm/frontend2/src/main.ts`, `crm/frontend2/src/router.ts`,
`crm/frontend2/src/customizations/register.ts`, `crm/www/crm2.py`, `crm/www/crm2.html`.

**The app no longer owns a vite config, an index.html, a router, a mount, or a page
template.** That is the charter's "it never hosts", made concrete.

## The gap this scaffold found, now closed

`crm/fcrm/frontend/pages/deals.js` — **a contributed page's location was never decided.**

#42068 settled where *doctype* contributions live (`<module>/doctype/<scrubbed>/frontend/`)
and settled that pages and doctypes share one flat URL namespace (`/crmv2/deals` beside
`/crmv2/crm-deal`), guarded at install. It never said where the page *file* lives, because
a page has no doctype folder to be colocated with.

**Decided: `<module>/frontend/pages/<slug>.js`.** Module-scoped, so it keeps #42068's "the
path is identity" property — app, module and slug all fall out of the path, nothing is
parsed, and the plugin gets source-app attribution for free.

**The `frontend/` segment is load-bearing and cannot be dropped** — `<module>/pages/` was
proposed and is disqualified by census. "Pages" is already the most overloaded word in a
frappe app tree, with three live claimants:

| existing | means |
|---|---|
| `<module>/page/` | desk v1's **Page doctype** — 5 in frappe (`desk/page/desktop/`, `core/page/permission_manager/`, …) |
| `<app>/templates/pages/` | classic **website templates** |
| `<app>/www/` | classic **website pages** |

`<module>/pages/` would sit *directly beside* `<module>/page/`, one character apart,
meaning a different thing. That is precisely the collision #42068 §10 rejected inside the
doctype folder, where `<scrubbed>_list.js` was already taken — the same argument, one level
up. Meanwhile `frontend/` is **free at module level**: a census of every second-level
directory across frappe's 11 modules turns up `doctype`, `page`, `report`, `workspace`,
`web_form`, `number_card`, `dashboard_chart` and a dozen singletons, and no `frontend`.

The payoff is that `frontend/` now means the same thing at all three levels — the repo root
(`frappe/frontend/`), the module (`fcrm/frontend/pages/`), and the doctype
(`crm_deal/frontend/record.js`).

Residual cost, accepted: `deals.js` and a `Deals` doctype slugging to `deals` still compete
for `/crmv2/deals`. The install guard catches it, but the two files sit in different folders
and look nothing alike, so the author gets no local cue before install.
