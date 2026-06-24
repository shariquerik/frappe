# Raven opens on its `chat` applet, full-window, by default

Status: ✅ DONE (2026-06-24)

Triage: ready-for-agent (AFK)

## What to build

The end-to-end capstone tying **framed full-window** (#02) and the **declared default surface**
(#05) together. Raven declares its landing in `apps/raven/raven/hooks.py`:

```python
os_app = {
    # ...identity from slice 03...
    "default_surface": {"applet": "chat"},
}
```

Opening Raven from the OS lands a window directly on Raven's `chat` applet (rung 1 of the
resolver), rendered **full-window with no nav rail** because `chat` is a framed applet. This is the
worked example from ADR-0021 ("raven → its `chat` applet, rung 1") paired with ADR-0020's
full-window framed behaviour — it exercises both mechanisms through one user-visible path.

No new mechanism is introduced here; this slice is the declaration + the verification that the two
prior slices compose. (The `raven` applet was renamed to **`chat`** per memory
`frappe-os-default-surface` — use `chat` as the applet id.)

## Acceptance criteria

- [x] `raven/hooks.py` `os_app` declares `default_surface: {"applet": "chat"}`.
- [x] Opening Raven in the OS lands directly on the `chat` applet (no intermediate
      dashboard/empty pane). — live `get_registry` projects raven `default-surface` =
      `{"applet":"chat"}`, which the slice-05 resolver consumes at rung 1
      (`resolveOwnAppRef` → `appletSurface('raven','chat')`).
- [x] The `chat` window renders full-window with no OS nav rail (Raven's own chrome only). —
      `chat` applet projects `kind: "framed"` (live registry), so `appletKind('chat')==='framed'`
      → `sidebarKind` returns `'none'` → `OSWindow` mounts no `AppSidebar`.
- [x] Works in both the bench-served build and `yarn dev` (the generic dev proxy from #01 keeps
      the framed SPA loading). — applet `assetUrl=/assets/raven/os-applets/chat.js` and iframe
      `src=/raven` are origin-relative; #01's catch-all forwards `/raven` to the bench in dev.

## Implementation notes

This capstone is "declaration + verification", but composing #02 and #05 end-to-end for a
*server-projected* applet surfaced two gaps the prior slices left, both fixed here (minimal,
on-scope wiring — no new mechanism):

1. **`os.py` applet projection now forwards `kind`.** #02 added the `native|framed` flag on the
   client (`AppletPayload.kind`, absent → native) but `_applet_contributions` never emitted it,
   so a server-declared applet was always native. `project()` now passes
   `"kind": spec.get("kind", "native")`; raven's `os_applets` entry declares `"kind": "framed"`.
2. **`_os_app_decl` unwraps nested-dict `os_app` fields (bug fix).** #03's reader did
   `value[-1]` on every `os_app` value, assuming `append_hook` list-wraps each. But `append_hook`
   *recurses* into nested dicts (`default_surface` → `{"applet": ["chat"]}`), so `value[-1]` on
   that dict raised `KeyError: -1`, crashing `get_registry` for **any** app shipping
   `default_surface`. #04 missed it (tested with a stub, no live app declared one). Replaced with
   a recursive `_unwrap_hook` (list → last element, dict → recurse, else passthrough).

Verified live (`bench --site f2.localhost execute frappe.www.os.get_registry`): all four OS apps
present; raven `default-surface` = `{"applet":"chat"}`; `chat` applet `kind: "framed"` (and
`erp-hello` `kind: "native"`, confirming the absent→native default). `yarn typecheck` + `yarn test`
(229) green. Cypress not run — the dev server uses live boot and the site HTTP port is unreachable
in this environment; the live registry data + code trace stand in for the browser drive.

## Blocked by

- #02 (framed applet full-window)
- #05 (client default-surface resolver)
