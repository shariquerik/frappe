# Project existing Desk metadata into the Registry; OS-native storage only for OS-only concepts

Frappe OS sources its Registry primarily by **projecting existing Frappe/Desk metadata**
into contributions, rather than defining parallel OS-native storage for things Desk already
models.

Existing DocTypes — Workspace, Number Card, Dashboard Chart, Custom Field, Property Setter,
Client Script, Report, Kanban Board, Print Format, Custom DocPerm, … — are mapped through
**adapters** into the appropriate extension points: Workspaces become OS workspaces,
Property Setters become Display-config patches, Client Scripts become Scripts (via the
ADR-0006 compat adapter), and so on. Consequences:

- Every existing site **lights up in the OS for free** — no manual migration.
- There is **one source of truth shared with Desk**: customize in either, see it in both.
- "Gradually replace Desk" becomes literally true — the OS is a **new lens over the same
  metadata**, not a fork that drifts.

This also unifies earlier decisions: the App-default layer (ADR-0005) is partly "project
app-shipped fixtures/JSON"; the Site layer is partly "project this site's Property Setters /
Client Scripts."

OS-native storage is introduced **only** for concepts Desk has no equivalent for — window/
dock geometry, desktop widgets, shell preferences.

Accepted cost: the OS inherits Desk's data shapes (Workspace structure, Property Setter
quirks) warts and all, and a few Desk concepts won't map cleanly onto the OS metaphor,
producing some adapter friction and leaky edges. We accept that over the parallel-storage
alternative, which would give clean OS-shaped schemas but fracture from Desk and turn
"gradually replace" into a manual per-site migration.
