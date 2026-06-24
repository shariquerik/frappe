# Generic catch-all dev proxy replaces the bespoke `^/raven` rule

Status: ✅ DONE (2026-06-24)

Triage: ready-for-agent (AFK)

## What to build

Make the OS Vite dev server forward **everything it does not own** to the bench, instead of
naming individual framed apps in the build config. Per ADR-0020, a framed applet's iframe loads
an origin-relative path (e.g. `/raven`); in dev the OS is served by Vite (a different origin), so
that path hits Vite's SPA fallback and serves the OS shell back into the iframe → infinite
recursion. The fix is a **catch-all**: the OS dev server owns only `/os/*` and Vite's own
internals; every other path forwards to the bench with the existing site-preserving behaviour.

The earlier `^/raven` proxy rule — an app name hardcoded in the OS build config — is retired. It
was a privileged-core leak (ADR-0001/0004): no framed app may ever be named in `vite.config.js`.
This is a clean standalone slice; production is unaffected (OS and framed SPA already share the
bench origin there).

## Acceptance criteria

- [x] `vite.config.js` contains no hardcoded app name (`raven` or otherwise); the proxy is a
      generic catch-all forwarding all non-`/os/*`, non-Vite-internal paths to the bench.
- [x] In `yarn dev`, opening a framed applet loads the real framed SPA in its iframe (no OS-shell
      recursion).
- [x] `/os/*` routes and Vite HMR / internal asset paths still resolve to the OS dev server.
- [x] The site-preserving header/cookie behaviour the previous `^/raven` rule provided is kept.

## Blocked by

- None — can start immediately.
