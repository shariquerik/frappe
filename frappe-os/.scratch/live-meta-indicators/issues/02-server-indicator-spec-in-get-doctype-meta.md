# Server: project the indicator spec in get_doctype_meta

Status: ✅ DONE

Triage: ready-for-agent (AFK)

## What to build

Extend the OS's live meta endpoint `frappe.www.os.get_doctype_meta` (frappe/www/os.py) to project
a normalized **indicator spec** so the client consumes a clean structure instead of parsing raw
workflow docs (ADR-0028). Keep `title_field` (already returned). The endpoint is already
permission-checked and lean — this rides it, no new endpoint.

Spec fields: `statusField` (the workflow state field, else a `Select` named status/stage),
`states` (value → color, from `DocType.states` `[{title, color}]`, scrubbed to lowercase color
tokens), `workflow` (state → color, from `Workflow State.style` for the active workflow),
`isSubmittable`, and `enabledField` (the enabled-state field name — `enabled` or `disabled`, or
null if neither exists; the resolver reads polarity from the name). Shape must match the #01
contract type.

## Acceptance criteria

- [x] `get_doctype_meta` returns the indicator spec (statusField, states, workflow, isSubmittable, enabledField) + title_field.
- [x] `enabledField` is `enabled`/`disabled`/null per the doctype; null when neither field exists.
- [x] `states` derives from `DocType.states`; `workflow` from the active workflow's states + styles.
- [x] Empty/absent sources yield empty maps (no error) — the client falls back to the heuristic.
- [x] Permission check unchanged; no data leaked for unreadable doctypes.
- [x] Shape matches the #01 indicator-spec type.

## Blocked by

None - can start immediately (coordinate the spec shape with #01).
