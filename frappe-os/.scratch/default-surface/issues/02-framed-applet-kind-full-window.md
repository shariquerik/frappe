# Framed applets are a distinct kind, rendered full-window with no nav rail

Status: ✅ DONE (2026-06-24)

Triage: ready-for-agent (AFK)

## What to build

Name the two applet kinds from ADR-0020 and give the **framed** kind its full-window behaviour.
An Applet (ADR-0009) comes in two kinds, distinguished only by *how the window content is
produced*:

- **Native applet** — a Vue component rendering the window content directly against the host's
  shared Vue/frappe-ui/OS-API (the default kind).
- **Framed applet** — a thin Vue host whose body mounts an `<iframe>` over a separate
  origin-relative SPA on a foreign stack (Raven's applet is literally `h("iframe", {src:"/raven"})`).

A framed applet is **full-window**: it shows **no nav rail**, because the framed SPA owns its own
chrome (a second OS sidebar beside Raven's own would clash). Today the surface plumbing
(`sidebarKind()` / surface dispatch in `src/surface/index.ts`) returns a nav rail for applet
surfaces; a framed applet surface must instead render no nav rail while keeping geometry, focus,
and URL projection surface-agnostic (ADR-0012). Both kinds still load as native ESM via
`os_applets` and share one declaration/loader/URL projection — "framed vs native" is not a second
contribution mechanism, only a content-production flag the core can read.

This slice introduces whatever minimal type/flag is needed to distinguish the kinds and wires the
full-window rendering. It is verifiable on Raven's existing iframe applet.

## Acceptance criteria

- [x] An applet declaration can be identified as native vs framed via a minimal type/flag; the
      core holds no per-app (e.g. "raven") knowledge.
- [x] A window hosting a framed applet surface renders **no nav rail** (full-window); native
      applet and list/dashboard/form surfaces keep their existing sidebars unchanged.
- [x] Geometry, focus, and URL projection stay surface-agnostic — only *which sidebar (or none)*
      renders follows the surface kind.
- [x] The existing per-window "hide sidebar" toggle still behaves sensibly for a full-window
      framed applet.
- [x] Vitest covers the framed → no-nav-rail dispatch decision; no regression in store /
      route-map / surface specs.

## Blocked by

- None — can start immediately.
