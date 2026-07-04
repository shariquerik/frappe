# The `os/` manifest: apps and doctypes declare OS contributions in a co-located folder

> **Status:** Accepted (2026-07-01, grilled). Not yet implemented. Amends ADR-0021 (identity/opt-in
> move from the `os_app` **hook** to the `os/` **folder**). Enables ADR-0031 (indicator rules) and
> ADR-0032 (scoped actions), which live inside the manifest.

An app declares everything it contributes to the OS in a **co-located `os/` folder — the OS
manifest — discovered by convention**, not through scattered `os_*` hooks in `hooks.py`. Each
doctype carries its own `os/` manifest the same way. This retires the `os_app`, `os_actions`,
`os_commands`, and `os_applets` hooks and gives every scope one home.

> **Amendment (2026-07-04).** App-level Commands now load from `os/commands.json`, the App-tier
> twin of the doctype-scoped commands already read off a doctype's manifest. This retires the
> `os_commands` hook — the last `os_*` hook this ADR had left standing — so every scope is now
> manifest-delivered with no hook survivor.

## The shape

```
erpnext/os/                         ← the APP manifest
  app.json                            identity + default_surface   (was: os_app hook)
  actions.json                        app-level actions            (was: os_actions flat list)
  commands.json                       app-level commands           (was: os_commands hook)
  applets/                            applet declarations          (was: os_applets)
  …                                   room for more app-level OS config

erpnext/selling/doctype/sales_invoice/os/   ← the DOCTYPE manifest
  doctype.json                        { indicator, actions }       carries to all views
  list.json                           { columns, filters, sort, actions }
  form.json                           { actions, … }
```

**One file per view/scope, config-types as keys inside.** Everything about "the list" lives in
`list.json`; adding a view is adding one file and nothing else moves. Rejected the alternative —
one file per config-type (`indicator.json`, `columns.json`, …) — because it smears a single view
across many files and repeats view-scoping as keys inside every one.

## Discovery is by convention; shipping the folder is the opt-in

The server discovers each installed app's `os/` folder and reads it. **An app is an OS app because
it ships an `os/` manifest** — the same opt-in-by-declaration principle ADR-0021 established, moved
from the hook to the folder. There is no registration call and no central list.

## It is data (JSON), not code

The manifest is **pure data**. Identity, default surface, indicator rules, filters, columns, and
actions all serialize as JSON; even an action's behavior is a **reference** (`run` handler `ref`,
ADR-0007/Handler), never inline code. This keeps one format across every scope and lets the server
read the manifest without executing it. Behavior that genuinely needs code goes to the **Script**
seam (ADR-0006), never into the manifest.

`hooks.py` is Frappe's app-wide grab-bag; the `os/` folder is the app's OS home. The move is the
same one this whole design makes one rung down (a doctype's config belongs next to the doctype, not
in a flat hook keyed by doctype).

## Considered and rejected

- **Keep the `os_*` hooks.** A flat, region-keyed `os_actions` list and a top-level `os_app` dict
  scatter one app's OS surface across `hooks.py` and force hand-written scoping (`when: {activeApp}`).
  The folder co-locates it and auto-derives scope (ADR-0032). Retired.
- **A single `os_app.json` file instead of a folder.** Doesn't hold the "more app config is coming"
  the folder anticipates (applets, actions, future OS config), and would grow into its own grab-bag.
- **One file per config-type across the folder.** Cleaner-sounding, but a view is then smeared
  across `actions.json`/`columns.json`/`filters.json` and view-scoping repeats as keys everywhere.
- **A Python module (`os.py`) per app.** Only earns its keep for *computed* declarations, of which
  there are none today; it is code (against the data ethos) and its name collides with the
  framework's own `frappe/www/os.py`. Kept the door open: a computed escape can be added later.

## Relationship to prior ADRs

- **Amends ADR-0021.** The `os_app` **hook** becomes `os/app.json`; discovery changes from "read the
  hook" to "read the folder." Identity, opt-in, and default surface are otherwise unchanged.
- **Extends ADR-0004.** The manifest is where an app's closed-but-data-driven contributions are
  authored; adding a manifest file type is additive.
- **Reuses ADR-0005/0007.** Manifest contributions still merge by the layered registry and the
  identity/merge rules; the folder is a *source*, not a new merge mechanism.
- **Pairs with ADR-0006.** The manifest is the *data* half; the Script seam is the *behavior* half.
