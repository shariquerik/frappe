# The form Surface shows an Aspect rail instead of the app nav rail

Triage: ready-for-agent (AFK)

## What to build

Make the window **sidebar surface-driven** (ADR-0018): the sidebar's content is chosen by
the Surface the window currently hosts, not fixed per-window. A list/dashboard Surface keeps
the existing app **nav rail** (modules → doctypes); a **form** Surface instead shows an
**Aspect rail** — the record's Aspects (Details / Activities / Email). Selecting an Aspect
swaps the window's main pane to it.

This is the structural spine and the riskiest change, because it narrows ADR-0012's claim
that "window chrome … do[es] not care which kind a Surface is" — the sidebar now does. Keep
geometry, focus, and URL-projection mechanics surface-agnostic; only *which sidebar renders*
follows the Surface.

Scope for this slice (tracer-bullet, see ADR-0018 consequences):
- **Details** is fully wired — it is the existing form field grid (`OSForm` / `FormLayout`).
- **Activities** and **Email** are labelled **placeholder panes** ("Coming soon"); no
  timeline or Communication data is fetched yet.
- Each Aspect has a **stable string id** (`details` / `activities` / `email`) — the id a
  later `form-aspect` extension point and the URL (issue 02) will key on. Do not make the
  Aspects positional/anonymous.
- The Aspect set is **core-for-now** — a hardcoded built-in array, not an extension point.
  The `form-aspect` Collection extension point is deferred (see ADR-0018).
- Aspect selection is **local window state in this slice** — Details is the default; no URL
  projection yet (that is issue 02, which lifts the selection into the form Surface).

The existing per-window "hide sidebar" toggle (`sidebarHidden`) applies uniformly to whichever
sidebar the window shows.

## Acceptance criteria

- [x] A window hosting a list or dashboard Surface still shows the app nav rail, unchanged.
- [x] A window hosting a form Surface shows the Aspect rail (Details / Activities / Email)
      instead of the nav rail.
- [x] Opening a record inline in a window flips that window's sidebar from the nav rail to
      the Aspect rail in place.
- [x] Selecting an Aspect swaps the main pane: Details → the live form field grid;
      Activities / Email → labelled placeholder panes.
- [x] Each Aspect carries a stable string id (`details` / `activities` / `email`); Details is
      the default selection.
- [x] The Aspect set is a single hardcoded built-in array (no registry/extension-point
      plumbing introduced).
- [x] Vitest covers the sidebar-by-surface dispatch decision; no regression in the existing
      store / route-map specs.

## Blocked by

- None — can start immediately.
