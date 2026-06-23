# The window sidebar is surface-driven; the form Surface carries an Aspect coordinate

A window's sidebar is no longer fixed per-window chrome: its **content is chosen by the
Surface the window currently hosts**. A list/dashboard Surface shows the app **nav rail**
(modules → doctypes, the existing `AppSidebar`); a **form** Surface shows an **Aspect rail**
that selects one **Aspect** of the record — Details (the field form), Activities (timeline),
Email (communications), … — and swaps the main pane to it. The form Surface stays a single
Surface kind; the selected Aspect is a **coordinate on it** (alongside doctype + record),
projected to the URL as a **trailing path segment** (`/os/crm/lead/LEAD-001/activity`), with
Details as the default Aspect on the bare path (`/os/crm/lead/LEAD-001`). So the Aspect is
URL-addressable, restored on reload, and stepped by browser back/forward — the same content-
address discipline ADR-0016 established.

## Why

The form is no longer just a field grid; it grows record-scoped facets (timeline, comms) that
don't belong in the app's doctype nav rail. Coupling the *sidebar* to the Surface lets the
form bring its own rail without inventing a new window kind (which ADR-0017 deliberately
dissolved). Modelling the Aspect as a coordinate on the existing form Surface — rather than
several new Surfaces — keeps the Surface taxonomy small (ADR-0012) while still making each
facet a first-class, addressable location.

## Relationship to prior ADRs

- **Narrows ADR-0012.** ADR-0012 says "the window chrome, geometry, focus, and URL projection
  do not care which kind a Surface is." That remains true for geometry, focus, and the
  *mechanics* of URL projection — but the **sidebar** is now explicitly surface-dependent.
  This is a deliberate, scoped carve-out of one chrome element, not a reversal of the
  polymorphic-Surface model: a window still hosts one Surface and is addressed uniformly; only
  *which sidebar renders* now follows the Surface.
- **Updates ADR-0017.** ADR-0017 fixed left-click as "same window (inline navigation)." Because
  an inline open now swaps the sidebar in place (nav rail → Aspect rail), the row open-target
  becomes a **per-user preference** (User-layer Customization): inline by default, flippable to
  open-in-new-window. The right-click context menu is unchanged — it always offers **both**
  Open and Open in New Window as the explicit per-row escape hatch.

## Considered options

- **Window-kind-driven sidebar** (revive a distinct "form window" kind that only ever hosts
  forms) — rejected: reintroduces the record-window kind ADR-0017 removed and the shared-path /
  history problems that came with it.
- **Each Aspect as its own Surface** — rejected: multiplies Surface kinds and per-record
  routing for no gain; a coordinate on the form Surface is additive and addressable already.
- **Aspect as pure UI state (not in the URL)** — rejected: breaks the "URL addresses content,
  reload restores it" discipline ADR-0016 is built on.

## Consequences

- The **Aspect set is core-for-now**: Details/Activities/Email are built-in OS behaviour with
  stable string ids (`details`/`activities`/`email`) — the ids the URL segment uses and a future
  contribution would be keyed by. A **`form-aspect` Collection extension point** (apps
  contributing aspects — CRM "Calls", ERPNext "Ledger") is **deferred**; the slice where an app
  wants its own aspect is what forces building it, and it is additive (ADR-0008), at which point
  the built-in trio becomes the OS's own contributions and the hardcoded array is retired.
- First slice ships **Details wired** (the existing `OSForm`) with **Activities and Email as
  labelled placeholder panes** — the structural change (surface-driven sidebar + Aspect
  coordinate + URL) proven end-to-end before the timeline/Communication data is wired.
- `route-map.ts` must parse the trailing segment after the record name **only when it matches a
  known Aspect id**, so a record name is never misread as `record/aspect`.
