# `os_app` hook is how an app declares itself to the OS — retiring `OS_APPS` and Desk branding

Status: ✅ DONE (2026-06-24)

Triage: ready-for-agent (AFK)

## What to build

Introduce the OS-native `os_app` hook as the single way an app participates in Frappe OS, and use
it for **identity + opt-in** (ADR-0021, jobs 1 and 2). Today `os.py` hardcodes
`OS_APPS = ["frappe", "crm", "erpnext", "raven"]` and scrapes branding from Desk's
`add_to_apps_screen` hook (`_app_branding`) — two privileged-core asymmetries this slice removes.

```python
# <app>/hooks.py
os_app = {
    "logo": "/assets/raven/raven-logo.png",
    "title": "Raven",
    "color": "#...",   # optional OS-native presentation
    "glyph": "...",    # optional
}
```

`os.py` reads `os_app` and projects an **`app` (identity)** contribution (logo, title, OS-native
presentation). Opt-in becomes "an app is an OS app *because it ships `os_app`*" — the hardcoded
`OS_APPS` list is retired, and branding is no longer sourced from `add_to_apps_screen`. The
`default_surface` field of `os_app` is read in a later slice; this slice covers identity + opt-in
only.

frappe, crm, erpnext, and raven must each declare `os_app` (identity portion) so the set of OS
apps is unchanged from the user's view — the apps screen still shows the same apps, now
self-declared rather than core-listed. Note: the curated frontend `config/apps.ts` still holds
presentation (glyph/cards) for built-ins; this slice does not move that — it only changes where
**opt-in and server-side identity** come from. Whitelisted params in `os.py` must stay fully type
annotated (see memory `frappe-os-whitelist-type-annotations`).

## Acceptance criteria

- [x] `os.py` derives the OS-app set from apps that ship an `os_app` hook; the `OS_APPS` constant
      is removed.
- [x] Server-side app identity (title/logo + OS-native presentation) is projected from `os_app`
      as an `app` contribution; `_app_branding` / `add_to_apps_screen` is no longer the source.
- [x] frappe, crm, erpnext, and raven each declare `os_app`; the apps screen shows the same apps
      as before.
- [x] An app that does not ship `os_app` does not appear as an OS app.
- [x] Any new/changed whitelisted `os.py` methods keep full type annotations on all params.

## Blocked by

- None — can start immediately.
