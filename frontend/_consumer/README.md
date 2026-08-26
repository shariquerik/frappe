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

## The one thing this scaffold had to invent

`crm/fcrm/frontend/pages/deals.js` — **a contributed page's location was never decided.**

#42068 settled where *doctype* contributions live (`<module>/doctype/<scrubbed>/frontend/`)
and settled that pages and doctypes share one flat URL namespace (`/crmv2/deals` beside
`/crmv2/crm-deal`), guarded at install. It never said where the page *file* lives, because
a page has no doctype folder to be colocated with.

The scaffold guesses `<module>/frontend/pages/<slug>.js` — module-scoped, so it keeps
#42068's "the path is the identity" property (app and module fall out of the path, the
slug is the filename) and needs no new registration. **This is a guess and it is flagged
as one**, because it has at least one real problem: `deals.js` and a `Deals` doctype
slugging to `deals` are a collision the install guard catches, but the two files look
nothing alike, so the author has no local cue that they compete.
