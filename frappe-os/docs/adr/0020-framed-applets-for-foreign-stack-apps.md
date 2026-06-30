# Framed applets wrap foreign-stack apps in an iframe

> **Status:** Implemented 2026-06-24 (issues `.scratch/default-surface/01,02,06`). The `kind`
> flag lives on the applet declaration (`os_applets` hook → registry `AppletPayload`/`appletKind`);
> the dev proxy in `vite.config.js` is a generic catch-all. Raven's `chat` applet is the worked
> example. **Superseded in part by ADR-0026:** the nav rail is no longer derived from `kind` — it is
> an applet's explicit `nav` capability. `kind` keeps its render-mechanism meaning below; ignore the
> "framed ⇒ no rail" inference, which ADR-0026 replaces.

An **Applet** (ADR-0009) comes in two kinds, distinguished by *how the window content is
produced*:

- **Native applet** — a Vue component that renders the window content directly, binding to
  the host's shared Vue/frappe-ui/OS-API (e.g. MyTodos). The intended, default kind.
- **Framed applet** — a *thin* Vue host whose entire body mounts an `<iframe>` over a
  separate, origin-relative SPA on a **foreign stack** (e.g. Raven, a React app served at
  `/raven`). Raven's applet is literally `h("iframe", { src: "/raven" })`.

A framed applet is the **permanent escape hatch for apps the OS cannot render natively**, not
a temporary hack. It honours the *letter* of ADR-0009's "ships no Vue runtime of its own" —
the applet file is one line — while a whole second SPA lives *behind* the frame. That is the
deliberate, bounded exception to "no second SPA," confined to foreign-stack apps. The frame is
kept **minimal**: just the iframe inside the OS-owned window chrome, with no per-app bridging
logic. Same-origin, so the framed SPA rides the shared session cookie with nothing to wire.

A framed applet is typically **full-window**: the framed SPA owns its own chrome (Raven has its own
sidebar — a second OS sidebar beside it would clash), so it declares no nav rail. Note this is now
the applet's own `nav` choice (ADR-0026), not an automatic consequence of being framed — a framed
applet *may* opt into the OS rail if it wants one.

## Why

Frappe OS exists so apps stop shipping their own separate Vue SPAs. But Raven is React, and
porting its UI to Vue is not realistic. Rather than special-case "React apps" in the core, we
name the general shape — *frame a foreign SPA* — and treat it as one of the two applet kinds.
Every other app (Helpdesk, any legacy or non-Vue frontend) reaches for the same hatch. Naming
it (vs. leaving Raven as an undocumented oddity) is what lets the dev-proxy rule, the
full-window behaviour, and the "no per-app knowledge in the core" constraint all hang off one
concept.

## Consequences

- **The dev proxy must be generic, never per-app.** A framed applet's iframe loads an
  origin-relative path (`/raven`). In production the OS and the framed SPA share the bench
  origin, so it just works. In dev the OS is served by Vite (a different origin), and that
  path would hit Vite's SPA fallback — serving the OS shell back into the iframe, which opens
  the framed applet again → infinite recursion. The fix is a **catch-all** dev proxy: the OS
  dev server owns only `/os/*` and Vite's own internals; **everything else forwards to the
  bench**. The earlier bespoke `^/raven` proxy rule (an app name hardcoded in the OS build
  config) is retired — it was a privileged-core leak. No framed app is ever named in
  `vite.config.js`.
- **Identity is the OS path, not the framed path.** The framed SPA's server route (`/raven`,
  via Raven's `website_route_rules`) is unrelated to the applet id. The applet is addressed in
  the OS at `/os/<appId>/<appletId>` (e.g. `/os/raven/chat`) — a different prefix, so no
  collision with the framed SPA the iframe loads inside it.

## Relationship to prior ADRs

- **Refines ADR-0009.** The two applet kinds share one declaration, loader, and URL
  projection — "framed vs native" is only how the content is produced, not a second
  contribution mechanism. Both still load as native ESM via `os_applets`.
- **Consistent with the no-privileged-core stance (ADR-0001, ADR-0004).** Framing is a
  generic capability; the core holds no knowledge of which app is framed.
