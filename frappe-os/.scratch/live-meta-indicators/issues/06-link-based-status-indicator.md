# Link-based status indicator (colour a Link-to-status-doctype pill)

Status: 🔲 TODO

Triage: needs-design (HITL)

## What to build

Extend the Record-indicator model so a **status stored as a `Link`** (to a doctype that carries
its own `color`) resolves to a coloured `StatusPill`, not plain text. Today ADR-0028's generic
model only recognises a **`Select`** status field (plus workflow / docstatus / enabled), because
`_status_field` matches a Select named `status`/`stage`. Apps like CRM store status as a Link to
a dedicated status doctype — `CRM Lead.status → CRM Lead Status`, `CRM Deal.status → CRM Deal
Status` — and those status doctypes have a `color` field. So the data-driven colour exists; the
generic model just doesn't read it yet.

Concretely: when the status field is a `Link` whose target doctype has a `color` field, project a
`states`-like map (status value → colour) from that target's rows into the indicator spec, so
`indicatorFor` themes the pill exactly as it does for `DocType.states`. The client cell classifier
then renders the Status column as a pill instead of falling through to plain text.

**This is a deliberate scope expansion beyond ADR-0028**, which recorded "reimplement each app's
`listview_settings.get_indicator()`" as rejected. This is narrower and data-driven (read the linked
doctype's `color`, not app JS), but it still adds a **new resolution tier** and a new server
projection — so it needs a design decision (grill / ADR amendment) before building, per the
"grill before building" rule. Settle: does the Link-status pill slot ABOVE or BELOW the Select
`states` tier? How is the status→colour map fetched (per-doctype status master read) without a new
round-trip? Does it belong on `DocType.states` semantics or a distinct `linkStatus` spec field?

## Acceptance criteria

- [ ] A `Link` status field targeting a doctype with a `color` field resolves to a coloured pill.
- [ ] CRM Lead / CRM Deal show status pills (their Link statuses), matching Desk/CRM colours.
- [ ] The indicator spec still yields empty maps (no error) for Link targets without a `color` field.
- [ ] No new round-trip — the status→colour map rides the existing `get_doctype_meta` fetch.
- [ ] The new tier's precedence vs. the `Select` `states` tier is decided and documented (ADR).
- [ ] Decision-table coverage for the Link-status tier in the resolver + the server projection.

## Blocked by

- Design decision (grill / ADR amendment to ADR-0028) on the tier's precedence and spec shape.
- Builds on #01 (resolver) and #02 (server spec), both done.
