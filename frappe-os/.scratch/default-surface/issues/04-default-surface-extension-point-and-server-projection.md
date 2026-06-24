# `default-surface` extension-point type + layered server projection from `os_app`

Status: ✅ DONE (2026-06-24)

Triage: ready-for-agent (AFK)

## What to build

Add the **`default-surface`** contribution to the system — the server/registry half of ADR-0021's
default surface, with no client resolution yet (that is the next slice). `os.py` reads the
optional `default_surface` field of the `os_app` hook and projects it as a **separate** layered
`default-surface` contribution — distinct from the `app` (identity) contribution from slice 03 —
so authoring is one place (`os_app`) but identity and landing layer **independently**
(App-default < Site < User). That independence is the point: a per-user default surface is just a
User-layer override of the `default-surface` Singleton touching only the landing, never the logo.

The declared value is a stable, app-qualified **reference** vocabulary — never the internal
Surface descriptor — so the OS can refactor Surfaces beneath it:

```
{ "applet": "chat" }                       // own app's applet (app defaults to the opened app)
{ "applet": "chat", "app": "raven" }       // another app's applet — explicit
{ "doctype": "Contact", "view": "list" }   // a list (the doctype names its owning app)
{ "dashboard": true, "app": "crm" }        // another app's dashboard
```

Scope for this slice:
- New **`default-surface` extension-point type** in the registry (`src/registry/*`) — a new
  closed-but-data-driven extension-point type (ADR-0004), reusing the existing layered
  Singleton/Patch merge (ADR-0005/0007) with **no new merge machinery**.
- `os.py` emits the `default-surface` contribution for any app whose `os_app` carries
  `default_surface`; the reference is passed through as data and **validated for shape** only
  (parsing/resolution of the reference is the client resolver's job, next slice).
- Raven need not declare its `default_surface` here (that is exercised end-to-end in slice 06);
  this slice is verifiable with a fixture/declared reference flowing server → registry.

## Acceptance criteria

- [x] The registry has a `default-surface` extension-point type that layers App < Site < User via
      the existing Singleton/Patch machinery (no new merge code).
- [x] `os.py` projects `os_app.default_surface` into a `default-surface` contribution that is
      **separate** from the `app` identity contribution and layers independently.
- [x] The reference is carried as the stable vocabulary (`{applet}` / `{doctype,view}` /
      `{dashboard}`, optional `app:`); shape is validated, internal Surface descriptors are not
      leaked into the contribution.
- [x] An app declaring a `default_surface` surfaces that reference through the registry; an app
      without one contributes nothing here.
- [x] Tests cover the projection + the layered merge of a `default-surface` Singleton/Patch.

## Blocked by

- #03 (`os_app` identity hook + opt-in)
