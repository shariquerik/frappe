# Applets are native, but touch the OS only through one narrow OS API

Runtime-loaded third-party applets are treated as **first-class and native** — the same
kind of thing as built-in applets, no iframe/sandbox isolation — preserving the "native
OS" feel and the uniform-contribution principle (ADR-0001).

The single discipline that makes this safe and maintainable: an applet (built-in *or*
third-party) may touch Frappe OS **only through one published, narrow OS API** object
(fetch data, open/close windows, show notifications, read session, etc.). Applets never
reach into the store, router, or internal modules directly.

This bounds the "stable API surface we must maintain forever" to exactly one well-defined
object, instead of letting OS internals leak into every app's code. It keeps built-in and
third-party applets symmetric (dogfooding), while giving us one place to version, guard,
and document.

We reject iframe/process sandboxing for app-style applets — it breaks the native feel an
"OS" promises. Heavier isolation may return later as an *opt-in* mode for genuinely
untrusted marketplace code, but it is not the default trust model.

> **Terminology:** "applet" is the app-contributed coded surface; it predates the rename
> from "component" (now reserved for the Vue mechanism). See `CONTEXT.md`. Decision unchanged.
