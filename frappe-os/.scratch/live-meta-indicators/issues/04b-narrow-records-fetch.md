# Narrow the records fetch to columns + name + resolver fields

Status: ✅ DONE

Triage: ready-for-agent (AFK)

## What to build

Narrow `records.ts loadList` from `fields: ['*']` to a lean set now that the curated phantom
columns (`enabled_label`, `status_label`, `stock_qty`) are gone from the render path and cell
enrichment (#04a) is proven correct.

**The field set is NOT just the wire columns.** The list's status pill is per-record
(`indicatorFor`), so the fetch must include the fields the resolver reads — otherwise those tiers
silently go dark (a Draft never shows Draft, a disabled record never greys). The set is:

```
name  +  wire column keys  +  resolver fields (from the indicator spec, #02)
```

where the resolver fields are: `statusField`; `docstatus` when `isSubmittable`; the `enabledField`
(`enabled` or `disabled`) when the spec names one. The client already holds the indicator spec, so it derives
these without a second server call. Mirror the library's `useListData` base set (`["name", ...wire
keys]`) and union the resolver fields onto it.

## Acceptance criteria

- [x] `loadList` requests `name` + wire keys + resolver fields, not `['*']`; the `['*']` comment is removed.
- [x] Resolver fields are derived from the indicator spec (statusField, docstatus if submittable, enabledField if named).
- [x] Regression: Draft/Submitted/Cancelled and enabled/disabled pills still render after narrowing (no dark tiers).
- [x] Coverage for the "spec → extra fetch fields" projection.

## Blocked by

- #04a (enrichment must be verified correct before fields are dropped from the fetch).
