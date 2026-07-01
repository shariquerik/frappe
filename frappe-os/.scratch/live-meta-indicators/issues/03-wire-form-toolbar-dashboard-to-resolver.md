# Wire form / toolbar / dashboard status pills to the live resolver

Status: ✅ DONE

Triage: ready-for-agent (AFK)

## What to build

Switch the non-list status-pill consumers from `getMeta().statusField` + `getMeta().statusThemes`
to the live indicator resolver (#01) fed by the live indicator spec (#02) via
`os.fieldMetaFor(doctype)`. Titles switch from `getMeta().titleField` to the live meta's
`title_field`. Consumers: `OSForm.vue` (status pill + form title), `AppToolbar.vue` (breadcrumb
status + record title), `AppDashboard.vue` (Recents status + title), `Dock.vue` (window title).

These are all reactive computeds with fallbacks (ADR-0028), so tolerating async live meta is safe;
where a component doesn't already load field meta, add the `os.loadFieldMeta(dt)` watcher pattern
`OSList`/`OSForm` already use.

## Acceptance criteria

- [x] Form/toolbar/dashboard status pills render via `indicatorFor(doc, liveMeta)`, not statusThemes.
- [x] Record/form/window titles read the live `title_field`, not `getMeta().titleField`.
- [x] Each consumer loads live meta where needed; empty state renders no pill (no demo fallback).
- [x] No consumer reads `getMeta().statusField` / `.statusThemes` / `.titleField` anymore.

## Blocked by

- #01 (resolver) and #02 (server spec).
