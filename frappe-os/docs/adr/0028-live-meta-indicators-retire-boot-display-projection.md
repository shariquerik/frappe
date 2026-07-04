# Live-meta indicators; retire the boot display projection

> **Status:** Implemented (2026-07). The live indicator model ships in `src/indicators/`
> (`indicator.ts` — `indicatorFor`/`normalizeColor`), consumed by `list-columns.ts`
> (`hasIndicator`/`indicatorColumn`). Lands the "Display-config enrichment"
> layer that ADR-0025 deferred — but as a **live, backend-derived indicator model**, not the
> curated presentation ADR-0025 imagined. Supersedes the curated status/column config that
> `.scratch/deferred-hardcoded/#07` set out to remove.

Status pills, record titles, and list columns stop coming from a **hand-curated, boot-projected
Display config** and instead come from **live doctype meta** the OS already fetches. The boot
Registry keeps only **identity** (existence, label, icon, color, ownership); **presentation
semantics** (title field, status field, status colors) move to live meta. Status colors adopt
**Frappe's own indicator model** rather than a per-doctype color map. This records the boundary
so it is not re-litigated slice by slice.

## Scope: this is about the status *model*, not de-hardcoding config

This ADR is easy to over-read as "delete `config/doctypes.ts`." It is not. `config/doctypes.ts`
carries two kinds of per-doctype data: **look** (`color`, `icon`) and **status semantics**
(`titleField`, `statusField`, `statusThemes`, `listColumns`). This ADR removes **only the status
semantics** — because Frappe already derives status → color from the doctype's own data
(`DocType.states`, workflow, docstatus), so there is no map to hand-maintain; the client reads it
live. The **look** (`color`/`icon`) stays for now; retiring *its* hardcoding is a separate track
(deferred-hardcoded issues 08/09/10), on a different justification — those are OS-native aesthetics
Desk doesn't express well, not site-owned data. And `config/apps.ts` is out of scope entirely.

"The boot Registry keeps identity" below means the **Registry seam** (`registry/index.ts`), which
in server mode is already Desk-projected — not an endorsement of the hardcoded config file, which
is only its offline seed plus that shrinking aesthetic overlay.

## Status colors are Frappe's indicator model, not a curated map

`config/doctypes.ts` carried a per-doctype `statusThemes` (value → color) plus a shared
`GENERIC_STATUS_THEMES` fallback. That map is hand-maintained, English-keyword-fragile, and
blind to any doctype it was not curated for. Frappe already solves status → color with
**backend data**, and it ships in the meta we fetch. We adopt its resolution order (mirrors
`frappe/public/js/frappe/model/indicator.js`), resolving a **Record indicator** — a record's
status projected to `(label, color)` **per record** (see CONTEXT.md):

1. **Workflow state `style`** → color. A `Workflow State.style` (`Success/Warning/Danger/
   Primary/Info/Inverse`) maps to `green/orange/red/blue/light-blue/black`. Active workflow wins.
2. **`DocType.states`** `[{title, color}]` — per-doctype status colors, **editable in the DocType
   itself**. The data-driven replacement for `statusThemes`.
3. **docstatus** (Draft `0` / Submitted `1` / Cancelled `2`) for submittable doctypes.
4. **publication / visibility** for doctypes with a conventional Check field: `published` /
   `is_published` (Published vs Not Published), `public` / `is_public` (Public vs Private), or
   `is_private` (Private, **inverse polarity**). Desk hand-writes these per doctype in each
   `listview_settings.get_indicator` (Note.`public`, Web Page.`published`, File.`is_private`) —
   client-JS-only, unreachable by API, unmaintainable for third-party doctypes. This tier
   **generalizes that pattern into one data-driven tier**: the spec names the field, and the
   resolver reads the label + color + polarity from the field name (same shape as tier 5).
5. **enabled / disabled** for doctypes with an enabled-state field. Two Frappe conventions with
   **opposite polarity**: an `enabled` field (truthy = active) or a `disabled` field (truthy =
   inactive). The spec names the field; the resolver knows the polarity from the field name.
6. **`guess_colour(value)` keyword heuristic** — the last resort (Frappe's own
   `GENERIC_STATUS_THEMES` equivalent), so an uncurated Select still gets a sensible color.

The shape shift is the point: the indicator is a **record → `(label, color)`** projection, not a
value → color dict. It subsumes both `statusField` and `statusThemes`, generalizes to **every**
doctype (including third-party, which the curated map never could), and stays in step with Desk.

## Presentation semantics live on the OS's live meta endpoint, not the Registry

The status spec is neither raw schema nor curated presentation — it is **backend-defined
semantics** (states/workflow/docstatus are the site's data). Its home is the OS's own live meta
endpoint, `frappe.os_core.meta.get_doctype_meta` (already permission-checked, already lean, already
consumed as `os.fieldMetaFor(doctype)`). We extend that payload with a normalized **indicator
spec** — `statusField`, a `states` map, a workflow style map, `isSubmittable`, and `enabledField`
(the enabled-state field name, `enabled` or `disabled`, or null — the resolver reads polarity from
the name) — and keep `title_field`. The client consumes a normalized structure instead of parsing raw workflow
docs, and `os.fieldMetaFor` becomes the single OS-native source of live presentation semantics.

**This adds zero new round-trips.** Every surface that needs the spec already fetches
`get_doctype_meta`: the list calls it for `can_create` (the New button, `OSList.vue:43`), and the
form/toolbar/dashboard call it for field schema. The spec rides a fetch that already happens —
it just adds fields to the payload.

This is the direct answer to ADR-0025's deferred **enrichment layer**: enrichment is applied over
Meta-derived columns from **live meta**, not from a static Registry projection. It refines
ADR-0025's carve-out — schema still comes from frappe-ui's `getdoctype`; the *indicator* semantics
come from the OS's own meta endpoint, so presentation is not smeared across two raw-meta parsers.

## The boot Registry keeps identity; presentation moves to live meta

`DoctypeMeta` (the boot-projected singleton behind synchronous `getMeta()`) sheds `titleField`,
`statusField`, `statusThemes`, and `listColumns`. It keeps `label`, `icon`, `color`, `generic`,
and ownership. This is safe because the only **synchronous** `getMeta()` consumers — routing
(`knownDoctype`), persistence rehydrate (`validSurface`), and the doctype-resolver short-circuit —
read **existence only** (`!!getMeta(dt)`), never the display fields. Every consumer that reads
title/status (`OSForm`, `AppToolbar`, `AppDashboard`, `Dock`, the list) is a **reactive computed**
with a fallback, so it tolerates live meta that fills in after a fetch.

Server-side, `_display_payload` drops `_list_columns` and `_status_field` (both projected into a
`listColumns`/`statusField` that nothing rendered) and its `titleField`. The boot Registry stops
carrying per-doctype presentation entirely.

## List columns were already live; this only re-enriches the cells

Since ADR-0025, `OSList` renders **Meta-derived** columns (`useListView` → `view.columns.wire`),
and the curated `listColumns` arrays have been **dead** — nothing reads `getMeta().listColumns`.
The list's `cellKind` classifier went dormant too: wire columns carry the raw fieldtype as `type`
(never the OS kinds `status`/`avatar`/`primary`), so every cell renders as plain text today. This
ADR re-connects the classifier to the **live** column shape — a `Select` status column (from the
indicator spec) renders a themed `StatusPill` via the resolver; the title column renders `primary`;
Link/user columns render `avatar`. And because the curated phantom columns (`enabled_label`,
`status_label`, `stock_qty`) are gone from the render path, the records store narrows its
`fields: ['*']` fetch to the wire column keys + `name` (the pattern `useListData` already uses).

## The client resolver is a pure, frappe-ui-free module

`indicatorFor(doc, meta)` lives in its own feature folder as a pure projection (no Vue, no
frappe-ui, no store) — mirroring `route-map.ts` and `list-columns.ts` — so it is unit-testable in
isolation (frappe-ui is unresolvable in the unit runner). The style→color and keyword→color tables
and the resolution order are tested against a decision table.

Its output vocabulary is **frappe-ui `Badge`'s six tokens** (`gray/blue/green/amber/red/violet`),
not Frappe's wider palette. Frappe emits `light-blue`, `black`, and arbitrary `DocType.states`
colors `Badge` can't render, so the resolver's final step is a `normalizeColor` mapping
(`light-blue`→`blue`, `black`→`gray`, `orange`→`amber`, unknown→`gray`). This is deliberately
lossy — `Badge` is the ceiling — and lives in the resolver so `StatusPill` stays dumb and the
mapping is unit-tested. Emitting plain token strings keeps the module frappe-ui-free.

## Considered and rejected

- **Keep `statusThemes`, just derive its keys from live options.** Still a curated color map, still
  blind to workflow/docstatus/states, still per-doctype maintenance. Rejected — half a step.
- **A client-side word→color heuristic as the primary source.** That is only tier 5 of Frappe's
  model; it ignores the authoritative `DocType.states`/workflow data and diverges from Desk colors.
  Kept strictly as the fallback.
- **Reimplement each app's `listview_settings.get_indicator()`.** Client-JS-only, unreachable by
  API, unmaintainable for third-party doctypes. Rejected outright. The publication/visibility tier
  is **not** this: it does not port per-doctype JS, it generalizes the one **regular** shape that
  recurs across those functions (a conventional Check field → a two-state pill) into a single
  data-driven tier, keyed by field name. The irregular, doctype-specific `get_indicator` logic
  stays unported.
- **Retire the boot Registry entirely and drive everything from live meta.** The synchronous
  seams (routing/persistence/ownership) genuinely need an existence + identity answer without
  awaiting a fetch. The Registry stays for identity; only presentation moves.
- **Project the indicator spec into the boot Registry instead of live meta.** Reintroduces the
  static projection this ADR removes and cannot reflect workflow/state edits without a reload.
- **Ride the frappe-ui `getdoctype` fetch (where the list gets its columns) instead of the OS
  endpoint.** `getdoctype` is a *library* endpoint — extending it couples OS presentation
  semantics to frappe-ui's meta shape. And **forms never call `getdoctype`** (they use
  `get_doctype_meta`), so the spec would need a second fetch there. The OS endpoint is the one
  every surface already hits; the "two endpoints" are two fetches that each exist for their own
  reason, not a round-trip this ADR adds.

## Relationship to prior ADRs

- **ADR-0025 (shared list-view controls).** This is the deferred "Display-config enrichment layer"
  it named — landed as live indicators. Its schema carve-out (`getdoctype` for fieldtypes/operators)
  stands; indicator *semantics* come from the OS meta endpoint, keeping presentation single-sourced.
- **ADR-0011 (project Desk metadata).** Refines it: "colors/status palettes are OS-native,
  client-side" held only because Desk *couldn't express* them — but `DocType.states` and
  `Workflow State.style` **do** express them. The OS reads that data instead of curating a palette.
- **ADR-0010 (reuse Frappe permissions).** The indicator spec rides the already-permission-checked
  `get_doctype_meta`; no new visibility surface.
- **ADR-0007 (additive/layered merge).** The Registry singleton shrinks (fields removed, none
  added), so this is not an additive change and is called out as a deliberate schema reduction.
  Verified safe: the removed fields have exactly **8 in-repo readers** (`OSForm`, `AppToolbar`,
  `AppDashboard`, `Dock`, `OSListView`/`list-columns`), **all reactive computeds**, all migrated by
  slices #03/#04a in the same change set that removes the fields (#05). None is persisted or on a
  wire contract — `persistence.ts` rehydrates by existence only (`!!getMeta(dt)`), and
  `DoctypeMeta` is a client-internal type. So no surviving consumer.
</content>
</invoke>
