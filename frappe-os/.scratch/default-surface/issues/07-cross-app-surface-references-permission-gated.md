# App-qualified cross-app surface references, permission-gated, window identity ≠ surface ownership

Status: ✅ DONE (2026-06-24)

Triage: ready-for-agent (AFK)

## What to build

Extend the resolver (#05) to honour an `app:`-qualified `default-surface` reference that points
into **another** app — the mechanism Customization needs to redirect an app's landing across
boundaries ("when our staff open ERPNext, land on our in-house dashboard applet"), per ADR-0021.

Three concerns, all additive on the existing resolver — no new merge machinery:

- **Cross-app reference resolution** — `{applet, app}`, `{dashboard, app}`, and `{doctype, view}`
  (the doctype names its owning app) resolve to a Surface owned by the *referenced* app, not the
  opened app.
- **Window identity ≠ surface ownership** — when the reference is cross-app, the **Window** stays
  the opened app's Instance (dock, icon, `?instance=n` identity per ADR-0016), while the hosted
  **Surface** is owned by its referenced app, and **chrome/nav scope to the surface's app**. This
  leans on the per-surface `appId` the Surface model already carries (ADR-0012).
- **Permission gating** — a cross-app reference is honoured only if the viewer may see that
  surface (ADR-0010); otherwise it **falls through** to the next resolver rung (dashboard →
  empty-app pane). Layered Site/User overrides of the `default-surface` reference (the *resolver*
  side; the editing UI is out of scope) ride the existing App<Site<User merge.

## Acceptance criteria

- [x] An `app:`-qualified reference (`{applet,app}` / `{dashboard,app}` / cross-app
      `{doctype,view}`) resolves to a Surface owned by the referenced app.
- [x] For a cross-app surface, the Window keeps the opened app's identity (dock/icon/`?instance`)
      while chrome and nav scope to the **surface's** app.
- [x] A cross-app reference the viewer lacks permission for falls through to the next resolver rung
      rather than opening or erroring.
- [x] A Site- or User-layer override of the `default-surface` reference is honoured by the
      resolver (write-path UI not in scope).
- [x] Vitest covers cross-app resolution, the permission fall-through, and the
      window-identity-vs-surface-ownership split.

## Blocked by

- #05 (client default-surface resolver)
