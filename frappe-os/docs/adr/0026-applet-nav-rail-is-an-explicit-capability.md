# An applet's nav rail is an explicit capability, decoupled from `kind`

> **Status:** Implemented 2026-06-30. A new `nav` flag rides the applet declaration (`os_applets`
> hook → `os.py` projection → registry `AppletPayload`/`AppletEntry`), read by `appletWantsNav` and
> dispatched in `sidebarKind`. Default is **no rail**: an applet gets the OS nav rail only when it
> declares `nav: true`. Refines ADR-0020 (which previously made the rail a function of `kind`).

## Context

ADR-0020 introduced two applet **kinds** — `native` (a Vue component rendered against the host) and
`framed` (an `<iframe>` over a foreign-stack SPA) — and made the OS **nav rail** a function of that
kind: `framed → no rail`, `native → rail`. That conflated two independent things:

- **`kind`** — *how* the window content is produced (Vue vs iframe). A real, render-level fact.
- **the nav rail** — *whether* this applet wants the OS's app navigation beside it. A UX choice
  that belongs to the applet author.

The coupling produced a wrong default. ERPNext's `erp-hello` is a `native` applet (not an iframe)
that does **not** want the doctype nav rail — but because `native → rail`, it showed one anyway. And
the inverse is equally legitimate: a `framed` applet might genuinely want the OS rail beside its
frame. Tying the rail to `kind` cannot express either case.

## Decision

The nav rail is the applet's **own explicit capability**, orthogonal to `kind`:

- The applet declaration carries a `nav` flag (`os_applets` hook): `nav: true` opts into the rail.
- **The OS never defaults the rail on.** An omitted/`false` flag → full-window, no rail. So
  `erp-hello` (and the first-party `my-todos`/`customizations`) render full-window by default.
- `kind` no longer influences the rail at all. `sidebarKind` for an applet surface is purely
  `appletWantsNav(appletId) ? 'nav' : 'none'`. A `native` applet may want no rail; a `framed` applet
  may want one. The two flags compose freely.

`kind` keeps its ADR-0020 meaning (render mechanism + the generic dev-proxy / full-window framing
story) — this ADR only removes its role in the sidebar decision.

## Why "no rail" is the default

The OS holds no per-app knowledge (ADR-0001/0004). It cannot know whether an arbitrary applet's
screen wants the doctype nav beside it, so the safe, surprise-free default is *don't impose chrome*:
an applet is a custom full-window screen until it says otherwise. Opt-in also matches the observed
cases — most applets (a todos pane, a customizations browser, a chat SPA) are self-contained.

## Open question — how an opted-in applet contributes its own nav item

`AppSidebar` is today **hardcoded** to project the app's `modules → doctypes`, each row opening a
doctype **list** (`os.openList`). It has no concept of a nav row that opens an **applet**. So an
applet that sets `nav: true` currently gets the *doctype* rail with **no entry that reopens the
applet itself** — the rail can navigate away from the applet but not back to it.

Closing this needs a **nav-item contribution model** we have **not yet decided**: how an applet (or
an app) declares the rows in its nav rail, how an applet-row is distinguished from a doctype-row,
and how the active row is computed for an applet surface (which carries no `doctype`/`view`). Until
that lands, `nav: true` is wired but only meaningful for an applet content area that provides its
own in-content navigation. The contribution model is deferred to its own ADR.

## Consequences

- **No regression today.** No shipped applet sets `nav: true`, so every applet becomes full-window —
  fixing the `erp-hello` stray rail with zero behaviour change elsewhere. The per-window
  hide-sidebar toggle stays a graceful no-op when there is no rail.
- **`appletKind` is no longer read by `sidebarKind`.** It remains the read seam for the render kind
  (wire field, dev-proxy framing) but is decoupled from chrome.

## Relationship to prior ADRs

- **Refines ADR-0020.** Framed-vs-native stays exactly as defined there; this ADR removes only the
  "framed ⇒ no rail / native ⇒ rail" inference and replaces it with the explicit `nav` capability.
- **Consistent with ADR-0018** (surface-driven sidebar) — the rail still follows the Surface; for an
  applet surface the Surface's answer is now "whatever the applet declared," not a `kind` heuristic.
- **Consistent with the no-privileged-core stance (ADR-0001, ADR-0004).** The default imposes no
  OS chrome on an app-contributed screen; the applet decides.
