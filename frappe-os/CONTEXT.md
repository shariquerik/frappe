# Frappe OS

A desktop-shell ("operating system" metaphor) frontend for the Frappe framework. It
currently coexists with Desk and is intended to gradually replace it. Built from scratch
so its architecture can be chosen deliberately for extensibility and customization.

## Language

**Frappe OS**:
The desktop-shell frontend itself — the windows, dock, menu bar, command palette, and the
machinery that renders apps inside it.
_Avoid_: "the shell" (ambiguous with the older `/x` shell POC), "Desk" (that's the thing
being replaced).

**Desk**:
The existing, established Frappe admin frontend that Frappe OS will eventually replace. The
benchmark for the features and extensibility Frappe OS must eventually match and exceed.

**App**:
A unit that contributes things into Frappe OS (its icon, dashboards, doctype views, etc.).
Built-in apps (frappe, crm, erpnext) and third-party/custom apps are the **same kind of
thing** — they contribute through one identical mechanism, with no privileged core. The
built-ins are simply the first apps to ship in the box.
_Avoid_: "plugin", "module" (a module is a grouping *inside* an app — see below).

**Module**:
A named grouping of doctypes *within* a single app (e.g. "Selling", "Stock" inside
ERPNext). A sub-division of an App, not an extension concept.
_Avoid_: using "module" to mean a JS/ES module or a unit of extension.

**Contribution**:
A single thing an App plugs into Frappe OS — one app icon, one dashboard card, one doctype
view, one menu-bar item, etc. Apps extend the OS by making contributions.

**Extension Point**:
A named slot in Frappe OS that accepts contributions of a given type (e.g. "app",
"doctype view", "dashboard card", "command-palette command"). The set of extension-point
types is the OS's extension surface.
_Avoid_: "hook" — that word is reserved in Frappe for `hooks.py`; using it here invites
confusion about whether we mean a Python hook or an OS extension point.

**Surface**:
What a window hosts — a descriptor that is *either* a built-in view (list/form/dashboard/…)
rendered by generic OS machinery *or* a reference to an Applet contribution resolved by the
runtime loader. Window chrome, geometry, focus, and URL projection are agnostic to which
kind a Surface is. Replaces the POC's fixed `view: {mode, doctype, recordName}`.

**Window**:
A movable, focusable container on the desktop that hosts exactly one **Surface** at a time
(and carries its own back/forward nav history). The container; the Surface is its content.

**Instance**:
One of several concurrent **Windows** hosting the same **App**. Minted whenever the user
asks for a *new* window of an app rather than re-using an open one — File ▸ New window, or
"Open in New Window" on a list row (which mints an instance already showing that record).
Instances of one app are independent (each navigates its own Surface) but group together in
the dock. There is no separate "record window" kind: a record opened in a new window is just
an instance whose Surface starts on that record's form.
_Avoid_: "twin", "extra window", "duplicate", "pop-out" — say "instance".

**Canonical instance**:
The *first* **Instance** of an app — the one that owns the bare window id `app:<id>` and is
the deterministic target a deep-link / cold-boot resolves to (later instances carry a
suffixed id and are not individually URL-addressable). Deliberately privileged so deep-links
have one unambiguous window to land on.

**Doctype view**:
A way of presenting one doctype — list, form, report, kanban, calendar, gantt, tree, etc.
Some views are generic (list/form, rendered from data); others are applet-backed
(kanban/calendar). A doctype can offer several views.

**Display config**:
The declarative presentation settings for a doctype — label, color, icon, list columns,
status→color mapping, default filters and sort. What today's hand-curated
`config/doctypes.ts` holds; in the target architecture it is a contribution in the Registry.

**Declarative contribution**:
A contribution expressed purely as data, collected on the server and delivered to the
frontend in the Registry, rendered by generic OS machinery. No custom code, no rebuild.

**Target**:
What a contribution attaches to — the second element of its identity tuple
`(extension-point type, target, name, source app)`. For a doctype view the target is the
doctype; for a dashboard card the target is the workspace; etc.

**Singleton / Collection (extension point)**:
The two merge behaviours an extension-point type can declare. A **Singleton** has one
effective value per target (higher layer overrides). A **Collection** accumulates members
across apps and layers (de-duped by id, ordered, individually hideable).

**Patch**:
A partial, shallow-merge customization of a Singleton contribution ("add column X, hide
column Y") rather than a full replacement — so it survives app upgrades. The OS analogue of
Frappe's Property Setter.

**Applet**:
A contribution that supplies a real, app-contributed, custom-coded full-window screen (pre-
built JS) the OS loads at runtime, for surfaces that data alone can't express. A declarative
contribution names the applet; the runtime loader resolves it. Built with the official Build
preset and loaded as native ESM sharing the host's Vue/frappe-ui/OS API.
_Avoid_: "component" for this concept. An applet is *implemented as* a Vue component (its
module's default export IS the SFC), but "component" is reserved for the Vue mechanism (the
`Component` type, `.vue` files, `<component :is>`) — never the domain concept.
An applet is **not a standalone Vue app**: it ships *no Vue runtime of its own* and stands up
no second SPA. It binds to the OS's single shared Vue/frappe-ui/OS-API (via the Build preset's
externals + the host import map). This is the whole point — Frappe OS exists so apps stop
shipping their own separate Vue apps (as CRM's `frontend` SPA does today). The contributing app
is just an **identity (`appId`) and an asset home (`/assets/<app>/…`)**; its own frontend stack
is irrelevant to the applet it ships.

**Build preset**:
The official Vite build configuration an app uses to compile an Applet so it externalizes
the host's shared deps (Vue, frappe-ui, OS API) and loads as native ESM. Required for
applets; Scripts need no build.

**Command**:
The *verb* — a named, identity-bearing capability the OS can invoke, independent of where
it is surfaced. One Command exists once and is invocable from any region (command palette,
menu, toolbar, keyboard shortcut). What a Command *does* is its Handler; *where* it appears
is one or more Actions. Apps extend the OS by contributing Commands.
_Avoid_: "command" loosely for any clickable thing — that is an Action. A Command is the
placement-agnostic verb behind it.

**Action**:
A *placement* of a Command into a surface **region** (menu bar, toolbar, context menu,
command palette, dock), carrying the conditions under which it appears there and its
ordering within that region. One Command may have many Actions (the same verb surfaced in
several places); an Action with no Command is meaningless. "Extending" the OS is
contributing a Command and/or an Action; "overriding" is a same-identity Command or Action
shadowing another (see Patch / Singleton-Collection). An overriding Action that re-presents the
Command it places (e.g. a different label in its context) carries a **`commandPatch`** — an
ADR-0007 Patch of the placed Command's presentation, applied only when that Action wins its
`(region, command)` competition, so the global Command Singleton is never mutated.
_Avoid_: "button", "menu item" (those are how an Action *renders* in a given region, not the
concept); "command" (that is the verb the Action places).

**Region**:
A named area of OS chrome that hosts Actions — the menu bar, a window toolbar, a context
menu, the command palette, the dock. The `target` of an Action's identity tuple. The OS
owns the set of regions (closed-but-data-driven, like extension-point types — ADR-0004).

**Handler**:
What a Command does when invoked — one of a **closed set of kinds**. Currently: **navigate**
(open a Surface — pure data, subsumes what an app-contributed "command" could do before: go
somewhere) and **run** (execute behavior through the OS API, the imperative kind the menu-bar
stubs and the palette's generated `run()` hint at). The kind set is closed and additive
(ADR-0008); a Handler never carries raw code in its identity, only a reference the runtime
**resolves by id**, the same way an Applet is resolved — never an imperative `register()`
call. A `run` Handler is **fire-and-forget**: resolved lazily on first invoke, executed,
done. It holds no long-lived state and owns no activation/teardown lifecycle (that is a
separate, deferred concern). Eligibility is judged from Context *data* alone, so showing or
ordering an Action never loads its Handler.

**Context**:
The OS's current focus situation, against which an Action's Eligibility is judged. A flat,
fixed-shape snapshot derived from the single focused window — the active app, the window's
role (app / record / settings), and the focused Surface's coordinates (doctype, record,
view, applet). There is **no nested responder chain**: focus is one window deep, so Context
is a depth-3 fact (global → active window → surface), not a tree. Selection is *not* part of
Context yet (the window model tracks no selected rows); adding it later is additive.

**Eligibility (`when`)**:
The condition under which an Action appears in its Region — a structured predicate matched
against the Context (e.g. "active app is CRM and the focused record is a Lead"). Distinct
from *permission* (ADR-0010, server-side, "may this user see it at all") — Eligibility is
*contextual* ("does it apply right **here**, right now"). More-specific predicates win when
several Actions compete *for the same region+command* (the depth-3 specificity tiebreak that
replaces a responder chain — see Action / Region). Specificity is the **lexicographic vector
`(surface-key-count, window-key-count)`**, so the tier dominates the raw count — a one-key
*surface* predicate outranks a two-key *window* one. Equal specificity falls through to layer
(App<Site<User) → explicit `priority` (higher wins, a separate axis from the ascending render
`order`) → a logged true tie. Evaluated as data, never `eval`
(consistent with ADR-0006); an unknown `when` key degrades to no-match plus a loud warning
(forward-compatible with additive Context fields).
_Avoid_: "visibility" unqualified (ambiguous with permission filtering); say "eligibility"
for the contextual axis, "permission" for the security axis.

**Script**:
A contribution carrying *behavior* — handler functions registered against the OS's closed
**event surface** (onLoad, onChange, validate, addAction, formatRow, …), receiving only the
OS API. The modern equivalent of Desk's Client Script, but bounded to the OS API. A
`frappe.ui.form.on`-compatible adapter is provided for migrating existing Desk scripts.
_Avoid_: "Client Script" (that's the Desk DocType/feature; a Script here is the OS concept).

**Event surface**:
The closed, documented set of named events a Script can attach handlers to. Distinct from
the OS API (what a handler may *call*); the event surface is what it may *react to*.

**OS API**:
The single, narrow, published object through which any applet (built-in or
third-party/runtime-loaded) interacts with Frappe OS — fetching data, opening windows,
showing notifications, reading the session. Applets never touch the store, router, or
internal modules directly; the OS API is the only seam.
_Avoid_: "bridge", "SDK", "context" — one name for the one seam.

**Registry**:
The effective, already-merged set of all contributions, assembled on the server and
delivered to the frontend as data at load time. The frontend's single source of truth for
what exists and how it looks — replacing today's hand-curated `src/config/*.ts`. The
frontend sees only the resolved result, never the layers.
_Avoid_: "boot" (boot is the delivery moment/payload; the Registry is the contribution data
within it).

**Projection**:
The mapping of an existing Frappe/Desk metadata DocType (Workspace, Property Setter, Client
Script, Number Card, …) into Registry contributions via an adapter, so existing sites' data
drives the OS with no parallel storage. The OS is a new lens over the same metadata.

**Customization**:
Not a separate subsystem — it is contributions made at the Site or User layer that override
an App-default contribution (e.g. adding a column to a shipped doctype's Display config).
The three layers are **App-default** (files in the app), **Site customization** (DB records,
admin-editable, no deploy), and **User preference** (DB records scoped to one user), in
increasing precedence.

**Customizations view**:
The one human-facing surface that lists the overrides and removals apps impose on a site —
the OS analogue of Frappe's Property Setter / Customize Form listing (ADR-0014 item 3,
ADR-0015). A **structural catalog**: it reads the declared Action set and describes each
customizing contender (its source app, layer, `override`/`removal` reason, and the `when`
scope it applies under), grouped by app. It is *not* a replay of the resolver's live output —
shadows are Context-relative and unstored, so the view describes the *contest and its
conditions*, never a single live winner. Read-only in its first slice (the per-row restore
button is the deferred write-path half of ADR-0014's reversibility guarantee).
_Avoid_: calling it a "shadow log" or "audit log" — there is no stored ledger; it is a
projection over the contribution set, not a record of past resolutions.

## Example dialogue

> **Dev:** Does CRM get to register its Kanban view in some special core path?
> **Architect:** No — CRM is just an App. It makes a *contribution* to the "doctype view"
> *extension point*, exactly the way a customer's custom app would. There's no privileged
> core; the built-ins dogfood the same extension system as everyone else.
> **Dev:** So "module" here means an ES module?
> **Architect:** No — a Module is a grouping of doctypes inside an App, like "Selling". When
> we mean a JS bundle we'll say "bundle" or "component", never "module".
