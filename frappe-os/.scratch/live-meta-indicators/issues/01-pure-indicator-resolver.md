# Pure indicatorFor() resolver + tests

Status: ✅ DONE

Triage: ready-for-agent (AFK)

## What to build

A pure, frappe-ui-free module `indicatorFor(doc, meta)` that resolves a record's status pill to
`{ label, color }`, mirroring Frappe's indicator model (ADR-0028). Its own feature folder with a
`types.ts` for the **indicator spec** contract that slice #02 (server) will populate. Tracer
bullet — logic only, no wiring, no store, no Vue (so it unit-tests in isolation; frappe-ui is
unresolvable in the runner — see [[doctype-list-view-pure-utils-no-frappe-ui]]).

Resolution order (first match wins): active workflow state `style` → `DocType.states` `[{title,
color}]` → docstatus (submittable) → enabled/disabled → `guess_colour(value)` keyword heuristic →
`gray`. Port the style→color table and the `guess_colour` keyword buckets from Frappe.

The enabled/disabled tier handles **both polarities**: an `enabled` field (truthy = active) and a
`disabled` field (truthy = inactive). The resolver reads the field name from the spec
(`enabledField`) and applies the polarity by name.

**Output vocabulary is frappe-ui `Badge`'s, not Frappe's.** Badge accepts only
`gray | blue | green | amber | red | violet` (`orange` is a deprecated alias for `amber`).
Frappe's palette is wider (`light-blue`, `black`, and arbitrary `DocType.states` colors like
purple/cyan/yellow), so the resolver ends with a `normalizeColor(frappeColor) → badgeToken`
step and emits **only** a Badge token. The ported style table must target Badge tokens directly:
Success→`green`, Warning→`amber`, Danger→`red`, Primary→`blue`, Info→`blue` (was light-blue),
Inverse→`gray` (was black). Any unknown/unmapped color → `gray`. Emitting plain token strings
keeps the module frappe-ui-free (it adopts Badge's vocabulary as a contract, it does not import it).

## Acceptance criteria

- [x] `indicatorFor(doc, meta)` returns `{ label, color }` following the ADR-0028 order.
- [x] Style→color and keyword→color tables ported; unknown value falls back to `gray`.
- [x] `normalizeColor` maps Frappe colors → Badge's 6 tokens; `light-blue`→`blue`, `black`→`gray`, `orange`→`amber`; resolver output is always a valid Badge token.
- [x] Module is pure — no frappe-ui / Vue / store imports.
- [x] Indicator-spec type defined and exported (the contract for #02).
- [x] Decision-table unit coverage for each tier and the fallthrough.

## Blocked by

None - can start immediately.
