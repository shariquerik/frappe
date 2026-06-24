# Apps declare themselves to the OS, and declare a layered default surface

> **Status:** Implemented 2026-06-24 (issues `.scratch/default-surface/03,04,05,06,07`). `os.py`
> reads the `os_app` hook for opt-in + identity (`OS_APPS` removed, `add_to_apps_screen` no longer
> the source) and projects a separate layered `default-surface` contribution; the client resolver
> `initialSurface()` walks declared → dashboard → [dormant list] → empty-app pane, honours
> permission-gated cross-app references, and keeps window identity separate from surface ownership.
> Rung 3 (first doctype list) stays a documented DORMANT no-op pending the nav-source decision.

An app participates in Frappe OS through one **OS-native** declaration — the `os_app` hook —
rather than by being hand-listed in the OS or by borrowing Desk's `add_to_apps_screen` hook.

```python
# raven/hooks.py
os_app = {
    "logo": "/assets/raven/raven-logo.png",
    "title": "Raven",
    "color": "#...",                          # optional OS-native presentation
    "glyph": "...",                           # optional
    "default_surface": {"applet": "chat"},    # optional; see below
}
```

`os_app` does three jobs at once:

1. **OS identity** — logo, title, and OS-native presentation (color, glyph, …).
2. **OS opt-in** — an app is an OS app *because it ships `os_app`*. This retires the hardcoded
   `OS_APPS = ["frappe", "crm", "erpnext", "raven"]` list in `os.py`.
3. **Default surface** — the app's declared landing (optional; falls back, see below).

`os.py` projects the one hook into **separate layered contributions** — an `app` (identity) and
a `default-surface` — so authoring is one place but the two layer **independently** (App-default
< Site < User). That independence is the point: a *per-user* default surface is just a User-layer
override of the `default-surface` Singleton, touching only the landing and never the logo.

## The default surface

The Surface a window opens on is resolved top-down, first match wins:

1. **Declared custom default** — the `default-surface` reference, after layered merge
   (App/Site/User) and a permission check (ADR-0010).
2. **Dashboard** — the app's dashboard, if any.
3. **First doctype list** — *dormant*: needs the app's exposed-doctype/nav source, which is a
   deferred decision (see Open questions). Slots in additively once decided.
4. **Empty-app pane** — an OS-owned placeholder ("no default screen configured for *App*"), so
   every declared OS app stays openable rather than blank. The terminal that rung 3 replaces.

Today: frappe/crm/erpnext → dashboard (rung 2); raven → its `chat` applet (rung 1).

### The surface reference is a stable, app-qualified vocabulary

The declared value is a stable **reference**, never the internal Surface descriptor, so apps
and users depend on a vocabulary the OS can refactor beneath:

```
{ "applet": "chat" }                       // my own app's applet (app defaults to opened app)
{ "applet": "chat", "app": "raven" }       // another app's applet — explicit
{ "doctype": "Contact", "view": "list" }   // a list (the doctype names its owning app)
{ "dashboard": true, "app": "crm" }        // another app's dashboard
```

It is **app-qualified** and may point into *another* app — the mechanism Customization needs to
redirect an app's landing across boundaries ("when our staff open ERPNext, land on our in-house
dashboard applet"). When it does, **window identity stays separate from surface ownership**: the
Window is still the opened app's Instance (dock, icon), while the hosted Surface is owned by its
referenced app, and chrome/nav scope to the *surface's* app. A cross-app reference is still
permission-gated — honoured only if the viewer may see that surface, else it falls through.

## Why

Two privileged-core asymmetries motivated this. First, `OS_APPS` was a hand-maintained list the
core had to know. Second, OS app branding was lopsided: built-ins got rich presentation from the
curated frontend `config/apps.ts`, while third-party apps like Raven got only the scraps
`add_to_apps_screen` (a *Desk* hook) happened to carry. An OS-native declaration gives a
third-party app the *same* identity and default-surface power the built-ins have — the
no-privileged-core principle (ADR-0001) applied to app identity itself.

Modelling the default surface as a layered contribution (rather than a boolean flag on the
applet) was chosen because per-user defaults are a named requirement, and per-user override *is*
the layered registry (ADR-0005, ADR-0007) — not a new subsystem. App-qualifying the reference
costs almost nothing now and avoids a painful retrofit once Customization wants cross-app
redirects.

## Considered and rejected

- **`default: true` flag on the `os_applets` entry** — simplest, but applet-only and with
  nowhere to carry the per-user layer. Ruled out by the per-user requirement.
- **A field on `add_to_apps_screen`** — co-locates with identity, but overloads a *Desk* hook
  and mixes identity with behaviour. Rejected in favour of an OS-native hook.
- **Projecting Desk's default Workspace for the default** — Desk has no concept of an applet,
  so it cannot express "Raven opens on chat"; it only ever yields a dashboard/list, which the
  fallback already covers.

## Open questions (deliberately deferred — need separate grilling)

- **Dashboard is provisional.** Rung 2 names "dashboard" today, but the OS may later replace
  the dashboard concept with something new. Not decided here.
- **Exposed-doctype / nav source.** What an app exposes as its navigable doctypes (and how they
  are grouped/labelled) — Frappe **Module Defs**, a **Workspace** projection (the OS has *not*
  decided to adopt Workspaces as a feature), or an explicit `os_app` list — is unresolved. It
  governs rung 3 and how an app's *other* lists are reached from a full-window default. Settling
  it is out of scope for this ADR.

## Relationship to prior ADRs

- **Applies ADR-0001/0005/0007/0010.** Identity, layered merge, Singleton/Patch, and permission
  gating are reused wholesale; `os_app` and the default surface add no new merge machinery.
- **Extends ADR-0004.** `default-surface` is a new closed-but-data-driven extension-point type.
- **Builds on ADR-0012.** The default surface is just *which* Surface a Window opens on;
  geometry/focus/URL projection stay Surface-agnostic. Window-vs-surface ownership leans on the
  per-surface `appId` the Surface model already carries.
- **Pairs with ADR-0020.** Raven's declared default (`{"applet": "chat"}`) is a *framed* applet,
  shown full-window.
