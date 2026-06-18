# Two contribution channels: declarative data + runtime-loaded applets

Contributions reach the running Frappe OS frontend through two channels, both first-class
from day one:

1. **Declarative contributions** — an App declares them in Python/JSON on the server; the
   server collects them into a registry delivered to the frontend as data at load time.
   Generic OS machinery renders them. Covers the majority: app icons, dashboards, doctype
   list/form views, menu-bar items, command-palette commands. No frontend rebuild when an
   app changes.
2. **Applet contributions** — for surfaces that data can't express (a bespoke Kanban,
   calendar, or touch screen). The App ships pre-built JS that Frappe OS loads at runtime,
   on demand. A declarative contribution *names* an applet; v1 only resolves names baked
   into the OS, and the runtime loader is added later — but the contribution shape is
   identical, so switching a view from built-in to app-loaded changes no contracts.

We explicitly **reject build-time bundling** (compiling each app's applets into the
Frappe OS bundle): it would require rebuilding Frappe OS whenever any app changes, which is
incompatible with the core goal "install a custom app and it just appears."

Consequence: runtime-loading third-party JavaScript makes Frappe OS responsible for a stable
applet-facing API, version-skew handling between an app and the OS, and the trust/security
of executing third-party code in the admin UI. Those are accepted obligations, addressed in
later ADRs.

> **Terminology:** this ADR predates the rename of the second channel's domain concept from
> "component" to **applet** (an applet is *implemented as* a Vue component, but "component"
> now names only the Vue mechanism). See `CONTEXT.md`. The decision is unchanged.
