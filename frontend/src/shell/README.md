# Q4 — the shell's own surface

**The dividing line the scaffold proposes: the shell owns everything that must look the
same in every app; an app contributes only *inside* a routed view.**

Not "the shell owns chrome and apps own content" — that line does not survive contact
with `PageHeaderPortal` — but a stricter one: an app's contribution is reachable only
through a route it was matched on. There is no `contributeSidebarItem`, no
`contributeCommand`, no shell-level hook of any kind.

| surface | owner | why |
|---|---|---|
| `AppShell.vue` — rail, sidebar, header slot | **shell** | #42102's. The sidebar is not a function of the prefix (#42068 §4) and v1 derives it from `meta.module`. An app cannot contribute here because the thing being contributed to is not the app's. |
| `NotFound.vue` | **shell** | A 404 at `/crmv2/nonsense` must not depend on CRM having shipped a 404. |
| `Unauthorized.vue` | **shell** | Renders when the boot fetch 403s (#42112). It runs *before* any app code has loaded, so it structurally cannot be contributed. |
| `BootError.vue` | **shell** | The boot fetch itself failed. Same argument. |
| `Loading.vue` | **shell** | Only ever visible during route-level lazy chunks — the initial block is on `main.ts`'s `await`, before Vue exists, so the first paint is a blank document. |
| auth / login | **neither, and this is a finding** | See below. |
| record + list page interiors | **shell renders, app contributes** | The four contributions in `contributions/types.ts`. |

## Login is not in this scaffold, and it should be questioned

Desk v1 serves `/login` as a separate Jinja page (`frappe/www/login.html`), and the bench
proxy's match list — `^/(desk|app|login|api|assets|files|private)` — has `login` in it as
a *sibling* of the SPA, not part of it. So an unauthenticated request to `/crmv2/...`
redirects out of the shell entirely and comes back after.

That is almost certainly right and it means the shell has no auth chrome at all. But
nothing in this map has said so, and #42112 is scoped to *permissions* — an authenticated
user who may not use this prefix — not to *authentication*. The scaffold flags the gap
rather than filling it.

## The consequence worth arguing about

Four of the six shell surfaces above are error states, and every one of them is
shell-owned. That is a real constraint on app authors: an app cannot brand its own 404,
cannot style its own permission refusal, and gets a blank white document if boot is slow.
The trade is deliberate — those are the states where a *consistent* desk matters most —
but it is the first thing a CRM designer will push back on.
