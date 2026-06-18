# Applet runtime-loading: native ESM + import maps + shared externals + official build preset

Applet contributions (ADR-0002) load and render natively (ADR-0003). Mechanically:

- The host publishes **Vue, frappe-ui, and the OS API as shared singletons** via an import
  map. There is exactly one Vue runtime and one frappe-ui, owned by the host.
- An app builds its applet as a **native ES module that externalizes** those shared deps
  (it does not bundle its own Vue/frappe-ui), using an **official Vite build preset** we
  ship. Output is dropped into the app's own served public assets.
- The OS loads it **on demand via dynamic `import()`** — no rebuild of Frappe OS when an app
  changes.
- The applet's entry is a defined contract — it *receives* the OS API (e.g. a default-
  exported setup function), never grabbing globals.

Because the host owns the shared-dep versions, **those versions are part of the
compatibility contract** (ADR-0008): bumping Vue/frappe-ui is an OS-API-level event.

Rejected: **Module Federation** (tooling weight not yet needed; import maps can graduate to
it later), **UMD/globals on `window`** (version-fragile, ages badly), **Web Components /
shadow DOM** for app-style surfaces (fights shared styling and clean OS-API passing, breaks
the native feel).

Accepted cost & deliberate asymmetry: this **forces applet authors onto our build
toolchain** — an applet can't be hand-written vanilla JS dropped in a folder. We accept
that for whole *surfaces*, while keeping *scripts* (ADR-0006) build-free for casual
behavior tweaks. Heavy build for new screens; zero build for small logic.

> **Terminology:** "applet" is the app-contributed coded surface this ADR loads; it predates
> the rename from "component" (now reserved for the Vue mechanism). See `CONTEXT.md`. The
> filename keeps its `component-loading` slug for stable links. Decision unchanged.
