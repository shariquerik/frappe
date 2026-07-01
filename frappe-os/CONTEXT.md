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
An app declares its **OS identity** (logo, title, presentation, default surface) and **opts
into** the OS through one **OS-native** declaration — *not* by being hand-listed in the OS or
by borrowing Desk's apps-screen hook. Participating in the OS is itself a contribution: an app
is an OS app *because it declares one*, so a third-party app gets exactly the same identity and
presentation power the built-ins have (no curated-vs-uncurated asymmetry).
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

**Working state**:
The per-window, per-subject state a user builds up on top of a **Surface** — a list's
filters/sort/columns (its **View Snapshot**), a form's unsaved edits (its **draft**), scroll
position, and an **Applet**'s own internal blob. The third leg alongside the two other
per-window facts: distinct from the **Surface** it layers over (the addressable coordinate —
doctype/record/view/aspect) and from the window's geometry (position/size/z). Keyed per
**(Window × subject)**, where the *subject* is a coarsened surface identity — a form's is
doctype+record with the **Aspect excluded** (so edits survive Aspect switches), a list's is
just its doctype. Hoisted into the OS store so it survives a **Window** being unmounted (the
basis for unmounting cold windows to reclaim memory). Each entry declares a **persistence
policy**: *durable* (also written to `localStorage`, so it survives reload — the list **View
Snapshot** is the one durable case today) or *ephemeral* (memory-only — form drafts, scroll,
applet state). An **ephemeral** entry that is **dirty** (has unsaved edits) arms a reload
confirmation ("unsaved changes will be lost") rather than being silently dropped *or* written
to disk. **Applets**, being custom-coded, participate only through an **OS API** seam
(`useWorkingState`) — which is also where an applet declares its own persistence policy and
dirty signal — never by the OS reaching inside them.
_Avoid_: "session state" (collides with the auth session), "view state" ("view" is the
doctype view — overloaded), "draft" (that is only the form part, not the umbrella).

**Default surface**:
The **Surface** an app's **Window** opens on when the app is launched (dock/logo click, or a
cold-boot deep-link to the bare app). Resolved by one uniform rule: the app's **declared**
custom default if it sets one (today only ever an **Applet** — e.g. Raven → its chat applet);
otherwise the app's **dashboard**; otherwise its **first doctype list**. So an ordinary app
(CRM, ERPNext) declares nothing and rides the fallback, while an app with a bespoke front door
(Raven) declares it — no app is special-cased in the OS, there is one rule with one optional
override. An **Applet** default is **full-window** unless the applet opts into the **nav rail**
(ADR-0026 — its own explicit choice, not a function of native-vs-framed); a dashboard/list default
carries the doctype **nav rail**. Replaces the POC's fixed dashboard→modules→applet inference.
The declared default is **layered** like any contribution (App-default < Site < User), so a
*per-user* default surface is just a User-layer override of the same Singleton — no separate
subsystem (see Customization). The app authors its App-default layer once (alongside its OS
identity); the value is a stable **surface reference** (which applet / which doctype list /
the dashboard), never the internal Surface descriptor — so apps and users depend on a stable
vocabulary, not OS internals.
The surface reference is **app-qualified** and may point into *another* app — an app/site/user
default can land on a different app's applet, list or dashboard (the owning app is explicit,
defaulting to the app being opened). This is what lets Customization redirect an app's landing
across app boundaries. When it does, **window identity stays separate from surface ownership**:
the Window is still the opened app's Instance (dock, icon), while the hosted Surface is owned by
its referenced app (chrome/nav scope to the *surface's* app, not the window's). A cross-app
reference is still **permission-gated** (ADR-0010): honoured only if the viewer may see that
surface, else it falls back to the standard default — a redirect never grants access.
_Avoid_: "home surface", "landing page", "home screen" — say "default surface".

**Aspect**:
A facet of a single record that the **form** Surface can present — Details (the field
form itself), Activities (the record's timeline), Email (its communications), etc. The form
Surface selects one Aspect at a time; the Aspect is a **coordinate on the form Surface**
(alongside doctype + record), not a Surface kind of its own — so it is URL-addressable,
restored on reload and stepped by browser back/forward, while "form" stays one Surface kind
(ADR-0012). Details is the default Aspect and projects to the bare form URL.
_Avoid_: "tab" (that is how an Aspect may *render* in the rail, and collides with the form's
own meta tabs inside Details), "view" (a Doctype view is list/form/report — an Aspect is a
facet *within* the form view), "section" (reserved for doctype-meta field groupings).

**Nav rail / Aspect rail**:
The window **sidebar is surface-driven**, not a fixed per-window chrome. A list/dashboard
Surface shows the **nav rail** (the app's modules → doctypes, with live counts); a form
Surface shows the **Aspect rail** (the record's Aspects). The sidebar's content is chosen by
the Surface the window currently hosts.

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
The **curated identity** a doctype carries — its label, color, and icon (plus the `generic`
authoring marker). Hand-authored today in `config/doctypes.ts`; in the target architecture a
contribution in the Registry, server-projected in server mode (config is then only decoration).
It owns **aesthetics only**. It does **not** own the status field, status colors, list columns, or
the title — those are resolved **live** from doctype meta, not curated (see **Record indicator**
and ADR-0028).
_Avoid_: treating status→color or cell kind as Display config — they were before ADR-0028 and are
now derived. Also _avoid_ conflating a rendered cell's kind (status pill / avatar / primary — a
list-render choice over the live wire columns) with the library **Column**'s `type` (the
Meta-derived *data* type used for alignment).

**Record indicator**:
A record's status resolved **at render time** to a `{label, color}` pill from the site's **own
data** — active workflow state, `DocType.states`, docstatus, or an enabled/disabled field — not
from a curated value→color map. A per-**record** projection (`record → (label, color)`), which is
exactly what distinguishes it from the old per-value status palette it replaces (ADR-0028).
"Indicator" is Frappe's own term for the status dot, so this stays in step with Desk.
_Avoid_: "status theme" / "status→color map" — that is the curated predecessor; a Record
indicator is derived, never authored.

**List View Controls** (consumed from `@framework/ui`):
The shared SortBy / Filter / ColumnSettings / QuickFilter controls (plus the `useListView`
state composable) that frappe-os mounts into a **list** Surface's toolbar. They are
**controlled** (own only their view state, never fetch or persist) and **Meta-driven**: they
derive their field options from the library's `useDoctypeMeta` (Frappe's `getdoctype`), **not**
from the OS **Registry**. A deliberate carve-out — field *schema* (fieldtypes → operators) is
raw Frappe metadata, distinct from the curated **Display config** the Registry owns. frappe-os
keeps **fetching** through its own OS data layer, fed by the controls' wire projections; the
library's optional fetching companion is not used. **Persistence** is the host's to wire
(library tops out at a View Snapshot): frappe-os hoists that snapshot into per-window **Working
state** and declares it *durable*, so a list's filters/sort/columns/quick-filters survive both a
window unmount and a reload.
For the controls' own vocabulary see the library's [`ui/CONTEXT.md`](../ui/CONTEXT.md).

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
Applets come in **two kinds** (see Native applet / Framed applet) — the distinction is *how the
window content is produced*, not a difference in how the contribution is declared, loaded, or
URL-projected (those are uniform).

**Native applet**:
The default, intended kind of **Applet** — a Vue component that renders the OS window's content
directly, binding to the host's shared Vue/frappe-ui/OS-API. Ships no runtime of its own. MyTodos
is the reference example. When unqualified, "applet" means this kind.

**Framed applet**:
An **Applet** whose component is a *thin* host that mounts an `<iframe>` over a separate,
origin-relative SPA on a **foreign stack** (e.g. Raven, a React app served at `/raven`). The
permanent escape hatch for apps the OS can't render natively — not a temporary hack. It honours
the letter of "ships no Vue runtime" (the applet file is a one-line iframe), but a whole second
SPA lives *behind* the frame, so it is the deliberate exception to "no second SPA," confined to
foreign-stack apps. The frame is kept **minimal**: just the iframe + the OS-owned window chrome
around it; no per-app bridging logic creeps into the OS. Same-origin so the framed SPA rides the
shared session cookie. A framed applet is what forces the OS dev server to forward the framed
path to the bench (otherwise the iframe recurses into the OS's own SPA fallback) — that
forwarding must be **generic to all framed applets**, never named per-app.
_Avoid_: "embed", "wrapper app", "micro-frontend" — say "framed applet".

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
A named area of OS chrome that hosts **Actions and Placements** — the menu bar, a window
toolbar, a context menu, the command palette, the dock, the desktop. For an Action it is the
`target` of the identity tuple; for a Placement it is where the pinned reference lives. The OS
owns the set of regions (closed-but-data-driven, like extension-point types — ADR-0004).
_Avoid_: treating Region as Actions-only — the dock and desktop also host Placements.

**Scope**:
The **OS manifest** an **Action** (or **Indicator rule**) is declared in — **OS / App / Doctype /
View**. A Scope does two automatic jobs: it **auto-supplies Eligibility** (a Doctype-scoped Action's
`when` is "a surface of this doctype is front", so authors rarely hand-write it), and it **picks the
delivery channel** (OS/App → boot; Doctype/View → live meta). A broader Scope **carries forward**
into narrower ones — an App Action shows across all its doctypes/views; a Doctype Action shows in all
its views — composed additively and overridable/removable per **Layer** (ADR-0032/0014). The third
axis alongside **Region** (*where it renders*) and **Layer** (*who customizes*): Scope is *where it is
declared / which context it belongs to*.
_Avoid_: conflating Scope with **Layer** (App<Site<User customization) or with **Region** — three
independent axes.

**Placement**:
A user-arrangeable pin of a **surface reference** into a **Region** (today the **desktop** or
the **dock**), carrying a region-appropriate **position** (the desktop a 2-D spot, the dock a 1-D
order). One concept spans both: a Placement in the desktop region is colloquially a *desktop
icon / shortcut*, one in the dock region a *dock pin*. Unlike an **Action**, a Placement is
**unconditional** — it has no `when`/Eligibility and never enters the resolver's specificity
contest; it just sits where the user put it. Placements are a **Collection** resolved across the
**App < Site < User** layers (members de-duped by id, ordered, individually hideable): an
OS/App-default baseline, ∪ **Site** members scoped to the user's **roles** (Role is a *scope on
the Site layer*, not a fourth rung — see Customization), ⊕ the user's personal **override layer**.
That override layer is the copy-on-write half: a user's first move/hide/add materialises per-member
**Patches** over the resolved base, so admin changes to a role's desktop still flow through to
customised users (not a frozen snapshot). The reference is the same app-qualified, permission-gated
**surface reference** used by Default surface — a role-scoped or cross-app pin is honoured only if
the viewer may see that surface.
_Avoid_: "shortcut"/"dock pin" as separate concepts (they are one Placement differing only by
region + position), "snapshot"/"copy" for the user layer (it is an override layer of Patches).

**Finder**:
The OS's **cross-app navigator** — a single `system`-style singleton **Window** (like System
Settings: respawned-from-URL, not persisted) whose sidebar holds **Locations**. The one place to
launch any app and to **drag a destination out** onto the desktop or dock (creating a
**Placement**). Despite the macOS-borrowed name it is **not a file browser** — Frappe OS has no
files; it navigates apps and destinations. Opened from the dock's launcher button (which no longer
opens the command palette — the two are now distinct, Finder = launch/browse, ⌘K palette = command
search). Subsumes the "app launcher" idea: the launcher is simply the **Applications** Location.
_Avoid_: "file manager"/"file browser" (no files), "Launchpad"/"App Launcher" as a separate
surface (it is the Applications Location of the Finder), "Spotlight" (that is the command palette).

**Location**:
A named entry in the **Finder** sidebar — one navigable source of destinations. The shipped set:
**Applications** (every app the viewer may see, plus a Settings entry — the launcher and primary
drag-source), **Doctypes** (a cross-app catalog of doctypes, a *flattened projection of the same
registry module→doctype data the per-app nav rail uses* — a different projection, not a second
store), **Recents** (a per-user, time-ordered log of recently opened **surface references** —
*OS-tracked*, server-side and roaming), and **Favorites** (a read-only *mirror/manager* of the
viewer's existing desktop+dock **Placements** — **not** a third placement region; the only
placement regions remain desktop and dock). Dragging any item out of a Location creates a
Placement; the dragged thing is always expressed as a **surface reference**.
_Avoid_: calling Favorites a placement region (it mirrors Placements, it does not host them),
treating the Doctypes Location as a separate doctype store (it reprojects the registry).

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

**Settings**:
The per-user settings **Window** — a singleton `system`-role window (respawned-from-URL, never
persisted, like the **Finder**). Holds the logged-in user's **Account** section (identity +
credentials) alongside the personal-preference sections (Appearance, Wallpaper, Dock, window
behaviour). Everything in it is **per-user** scope. Previously called "System Settings" — a
misnomer, since nothing in it is site-wide; the rename frees the "System" label for the future
site-wide surface.
_Avoid_: "System Settings" for this window (reserved — see System Defaults); "Preferences" alone
(it also holds Account, which is identity, not a preference).

**Account**:
The logged-in user's **identity + credentials** — full name, avatar, password — surfaced as a
section of the **Settings** window and backed by their `User` record. Per-user and server-backed
from day one (unlike the preference sections, which are local today and per-user-server-backed
later). Distinct from **User preference**, which is the customization *layer*, not this surface.
_Avoid_: "Profile"; "User Settings"/"User Preferences" (those overload the User-preference layer).

**System Defaults** (future, reserved):
The genuinely site-wide, admin-scoped configuration surface — the *real* "System" settings (the OS
lens over Frappe's site-level config). Does not exist yet; the name is **reserved** so today's
per-user window is called **Settings**, never "System Settings". A separate surface from Settings
when it arrives — site-wide scope, not per-user.
_Avoid_: naming the per-user **Settings** window "System" anything — that label belongs here.

## Example dialogue

> **Dev:** Does CRM get to register its Kanban view in some special core path?
> **Architect:** No — CRM is just an App. It makes a *contribution* to the "doctype view"
> *extension point*, exactly the way a customer's custom app would. There's no privileged
> core; the built-ins dogfood the same extension system as everyone else.
> **Dev:** So "module" here means an ES module?
> **Architect:** No — a Module is a grouping of doctypes inside an App, like "Selling". When
> we mean a JS bundle we'll say "bundle" or "component", never "module".
