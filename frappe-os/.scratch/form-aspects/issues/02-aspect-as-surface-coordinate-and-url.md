# The selected Aspect is a Surface coordinate, addressable in the URL

Triage: ready-for-agent (AFK)

## What to build

Promote the selected Aspect from local window state (issue 01) into the **form Surface**
itself, so it is URL-addressable, restored on reload, and stepped by browser back/forward —
the same content-address discipline ADR-0016 established. "form" stays a **single Surface
kind**; the Aspect is a **coordinate on it** (alongside doctype + record), not a new Surface
kind (ADR-0012 / ADR-0018).

URL shape (ADR-0018 — "a path names content"):
- The Aspect projects to a **trailing path segment**: `/os/crm/lead/LEAD-001/activity`.
- **Details is the default** and projects to the **bare** form path
  (`/os/crm/lead/LEAD-001`), so existing form URLs stay byte-for-byte unchanged.
- It composes with the reserved `?instance=n` query (ADR-0016):
  `/os/crm/lead/LEAD-001/activity?instance=2`.

Keep the projection pure and in `route-map.ts`. The parser must read the trailing segment as
an Aspect **only when it matches a known Aspect id** — otherwise treat it as part of the
record / no aspect — so a record name is never misread as `record/aspect`.

## Acceptance criteria

- [x] The form Surface descriptor carries an `aspect` coordinate (doctype + record + aspect);
      Aspect selection is no longer local component state.
- [x] Selecting a non-default Aspect updates the URL to the trailing-segment form
      (`.../<record>/<aspect>`); Details produces the bare record path with no suffix.
- [x] A browser reload on a non-default Aspect restores that Aspect (cold-boot URL seeding).
- [x] Browser Back / Forward steps between Aspects of the same record as real history entries.
- [x] The Aspect segment composes with `?instance=n` for non-canonical instances.
- [x] `route-map.ts` parses the trailing segment only against the known Aspect id set; an
      unknown trailing segment does not produce a phantom Aspect.
- [x] Vitest covers the `route-map` projection/parse decision table for the Aspect segment;
      Cypress covers URL update + reload-restore + back/forward for Aspects.

## Blocked by

- Issue 01 (the Aspect rail and the `details` / `activities` / `email` ids must exist first).
