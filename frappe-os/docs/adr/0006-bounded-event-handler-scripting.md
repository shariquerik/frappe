# Scripted behavior is a bounded event-handler model, with a Desk-compat adapter

Customization that needs *behavior* (not just data) — conditional formatting, validation,
field reactions, custom form actions — is expressed as a **script**: a contribution that
registers handler functions against a **closed, documented event surface** (onLoad,
onChange(field), validate, addAction, formatRow, …). Handlers receive only the narrow OS
API (ADR-0003) — the same seam applets use — never the whole `frappe` global, form
internals, or DOM.

This is the same event-handler ergonomics as Desk's Client Script, pointed at a stable,
OS-owned API instead of unbounded framework internals. We trade Desk's break-prone "can do
anything" escape hatch for stability (scripts survive internal refactors), security (a
narrow surface can later be permission-checked or sandboxed), and uniformity (one seam for
scripts and applets, usable across forms, lists, dashboards, palette — not just forms).

The accepted cost: API completeness becomes our ongoing responsibility — if the OS API
doesn't expose it, a customizer cannot do it until we add it. We accept that in exchange for
not shipping unbounded eval.

**We will ship a `frappe.ui.form.on`-compatible adapter** over the OS API, so the thousands
of existing Desk client scripts have a real migration path rather than being stranded. This
is a deliberate promise, not an afterthought.

Server-enforced logic (validation/automation that must be trusted) stays Frappe's job
(server scripts, doc events). Frappe OS owns *client* behavior and surfaces the server's
effects; it does not reinvent server-side scripting.

Trust, for now: only System Managers may author client scripts (Desk's existing bar), and
scripts run natively (no sandbox), consistent with ADR-0003. Untrusted/marketplace-script
sandboxing is a later, opt-in concern — flagged, not solved here.
