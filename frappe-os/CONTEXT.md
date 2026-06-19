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

## Example dialogue

> **Dev:** Does CRM get to register its Kanban view in some special core path?
> **Architect:** No — CRM is just an App. It makes a *contribution* to the "doctype view"
> *extension point*, exactly the way a customer's custom app would. There's no privileged
> core; the built-ins dogfood the same extension system as everyone else.
> **Dev:** So "module" here means an ES module?
> **Architect:** No — a Module is a grouping of doctypes inside an App, like "Selling". When
> we mean a JS bundle we'll say "bundle" or "component", never "module".
