# Scope: actions are co-located per OS→App→Doctype→View and carry forward

> **Status:** Accepted (2026-07-01, grilled). Not yet implemented. Extends ADR-0007 (identity/merge)
> and ADR-0014 (override/remove chrome) with a **Scope** axis. Actions are declared in the OS
> manifest (ADR-0030). Builds out the list/bulk actions ADR-0007 left deferred.

An **Action** (a placement of a **Command** into a **Region**) gains a **Scope**: the manifest it is
declared in — **OS / App / Doctype / View**. One unified Command/Action model now spans OS chrome
*and* surface-embedded regions, replacing desk's `listview_settings` grab-bag (its `onload` bulk
actions, `primary_action`, and buttons all become scoped Actions).

## Scope does two automatic jobs

1. **Auto-supplies Eligibility.** Because an Action is co-located, the OS already knows the context
   it belongs to. A Doctype-scoped Action's `when` is "a surface of this doctype is front"; a
   View-scoped Action's is "…and the view is `list`." The author does not hand-write `when` for the
   common case — only for the unusual cross-surface one.
2. **Picks the delivery channel.** **OS/App scope → boot** (always present). **Doctype/View scope →
   live meta** (loads when that doctype/view is opened). This is the exact boot-vs-live-meta split
   ADR-0028 drew: global identity in boot, per-surface presentation in live meta.

## Carry-forward: broader scope flows into narrower

```
OS         (always)          ─┐
 └ App      (active app)      ─┼─ each scope carries forward into the next
    └ Doctype (any view)      ─┤
       └ View  (list / form)  ─┘
```

The menu bar (or any Region) at a given moment is composed **live** from the front-most stack:
`OS ⊕ active App ⊕ front Doctype ⊕ front View`, filtered by Eligibility. Switch focus from a Sales
Invoice list to an applet and the surface-specific contributions swap while the app-level ones carry
forward — the macOS menu-bar model, expressed as scoped Eligibility. Composition is **additive by
default**; a narrower scope drops or replaces an inherited Action through the **override/remove**
that already exists (ADR-0014), not new machinery.

## Three orthogonal axes

An Action is now placed on three independent axes, none of which is the others:

- **Region** — *where it renders* (menu bar, dock, list toolbar, selection/bulk bar, form toolbar).
- **Scope** — *where it is declared* / which context it belongs to (OS/App/Doctype/View).
- **Layer** — *who customizes it* (App < Site < User, ADR-0007).

Region and Scope are independent: a Doctype-scoped Action can target the **global menu bar** as
easily as its own list toolbar. Delivery follows **Scope**, never Region.

## New regions; bulk actions as data

The Region set (closed-but-data-driven, ADR-0004) grows to include **surface-embedded** regions —
list toolbar, selection/bulk bar, form toolbar — alongside chrome. A bulk action ("Set as Open" over
selected rows) is a **Command** with a `run` Handler that calls a server method, placed by a
**Doctype/View-scoped Action** into the selection Region, its `when` auto-derived from scope. The
declarative half (which verb, which region, when eligible) is data in the manifest; the imperative
half (what the verb does) is the Handler `ref`, resolved lazily on invoke (ADR-0007).

## Considered and rejected

- **A separate mechanism for surface actions vs chrome actions.** Two identity systems, two merge
  rules, two override models — the "same thing twice" this design keeps rejecting. One Command/
  Action model with a Scope axis covers both.
- **Region decides the delivery channel.** It cannot: a Doctype-scoped Action can render in the
  global menu bar, so a menu-bar Action is not necessarily boot-global. **Scope** decides delivery.
- **Hand-written `when` everywhere.** Co-location already encodes the context; auto-deriving
  Eligibility from Scope removes the boilerplate and keeps the manifest terse.
- **New `activeDoctype` / `activeView` Context keys for the auto-`when`.** The Context already
  carries the front surface's `doctype` / `view`; the "front doctype" a Doctype scope keys on *is*
  that surface coordinate, so parallel keys would be the same thing twice. Auto-Eligibility reuses
  `doctype` / `view` (implemented in `actions/scope.ts` as `scopeWhen`).
- **Keep bulk actions as `onload` callbacks.** That is desk's grab-bag; it is client-only and
  unreachable by merge. A scoped Action with a `run` Handler is the OS-native form.

## Relationship to prior ADRs

- **Extends ADR-0007.** Scope is a new axis over the existing identity/merge; the resolver's
  specificity/order/priority/layer contest is reused, not replaced.
- **Extends ADR-0014.** Carry-forward override/removal *is* the chrome override/removal, applied
  along the scope ladder.
- **Extends ADR-0004.** Surface-embedded Regions are new members of the closed Region set.
- **Lives in ADR-0030.** Actions are declared in the OS manifest at each scope; **ADR-0021**'s app
  declaration is the App-scope rung.
- **Reuses ADR-0028's channel split.** OS/App on boot, Doctype/View on live meta.
