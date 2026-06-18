# Contribution identity, per-slot merge semantics, and patch-merge

To make the layered server-merge (ADR-0005) well-defined, contributions have stable identity
and each extension-point type declares how it merges.

**Identity.** Every contribution is addressed by the tuple
`(extension-point type, target, name, source app)` — e.g. a list view is
`doctype-view / Sales Invoice / list / erpnext`. A customization references this tuple to
say precisely what it patches.

**Per-slot merge semantics.** Each extension-point type is one of:
- **Singleton** — one effective value per target; higher layer (site > app) overrides, and
  within a layer an explicit priority/order breaks ties. E.g. Display config, the default
  view.
- **Collection** — contributions accumulate across apps and layers, de-duped by `name`/id,
  explicitly ordered; a higher layer may override or *hide* a specific member by id. E.g.
  dashboard cards, menu items, commands, the set of available views.

**Patch-merge, not full replacement.** A customization of a singleton is a *partial patch*
("add column X, hide column Y"), shallow-merged over the app default — never a full
re-supply of the value. This is the deliberate, more expensive choice (it needs a
diff/patch representation), made because it is the difference between customizations that
**survive app upgrades** and Desk's frequent failure mode where a customization froze a
form so newly-shipped fields silently never appear. It mirrors Frappe's Property Setter
(patches one property).

**Collisions within one layer** (two apps, same singleton target) resolve by explicit
priority/order, and the shadowed contribution is **logged, never silently dropped**, so a
customizer can see what shadowed what.
