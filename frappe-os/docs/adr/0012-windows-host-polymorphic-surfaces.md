# A window hosts a polymorphic Surface, not a fixed view-mode

Today a window's content is `view: { mode: 'list'|'form'|'dashboard', doctype, recordName }`
(`src/types.ts`), and `WindowType`/`ViewMode` are closed unions. This bakes the POC's
three-view worldview into the core and has no way to express "this window hosts applet X
from app Y" — directly contradicting ADR-0002 (applet contributions) and ADR-0004
(open-ended view taxonomy).

Decision: a window hosts a **Surface** — a descriptor of what is inside it — which is one of:
- a **built-in view** (list, form, dashboard, …) rendered by generic OS machinery, or
- an **applet contribution reference** (app + applet id) resolved by the runtime loader.

Both are addressed uniformly; the window chrome, geometry, focus, and URL projection do not
care which kind a Surface is. Adding a new built-in view type or a new applet-backed view
is then additive, not a change to the window/`WindowType`/`ViewMode` unions.

This is recorded because it is **hard to reverse** — every window, the URL projection
(`route-map.ts`), per-window history, and persistence are shaped by how window content is
modeled — and because it is the **first concrete refactor** of the existing POC, sequenced
*before* introducing the `useRegistry()` seam: generalizing the surface model unblocks the
extensibility ADRs, whereas swapping the config source on top of the narrow 3-mode model
would only entrench it.

The closed unions (`WindowType`, `ViewMode`) and the `view` field shape in `src/types.ts`
are POC scaffolding to be replaced by the Surface model.
