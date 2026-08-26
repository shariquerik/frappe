# PROTOTYPE — `frappe/frontend/`

**Throwaway.** Nothing here runs. This is a file-layout scaffold for
[#42072](https://github.com/frappe/frappe/issues/42072), built to be *read* and argued
with. It takes a position on every seam so the position can be attacked; where a live
ticket owns a seam, the file says so instead of guessing.

Read it in this order:

1. `_consumer/` — **start here.** What the CRM author writes against this scaffold.
   The map's Notes say to judge the design by reading the app author's side, so it is
   first, not last.
2. `src/main.ts` — the mount sequence.
3. `src/router/index.ts` — how one router serves N prefixes.
4. `src/contributions/` — the seam the whole charter rests on.
5. `src/shell/` — what the shell owns.

## Where it sits on disk

```
apps/frappe/
  ui/                     # @framework/ui — raw source, no build (today)
  frontend/               # NEW: this. Source + the framework-owned node_modules tree.
  frappe/public/frontend/ # build output only, served at /assets/frappe/frontend/
```

`frontend/` is at the **repo root beside `ui/`**, not under `frappe/frappe/`. Two reasons:
`ui/` already established that JS packages live at the root, and `#42069` names
`frappe/frontend/` as both the yarn root and the `yarn dev` cwd — a `node_modules` tree
under the Python package would be indexed by every Python tool in the bench.

Build output is the one thing that *must* live under `frappe/public/`, because
`/assets/frappe/` is a symlink to it and `#42069` fixed the asset root at
`/assets/frappe/frontend/`.

## The five questions this scaffold answers

| # | Question | Answered in |
|---|---|---|
| 1 | The document and mount | `index.html`, `src/main.ts`, `src/boot.ts` |
| 2 | The router, and where a prefix becomes a route base | `src/router/index.ts` |
| 3 | The shell/contribution seam | `src/contributions/`, `plugin/contributions.js` |
| 4 | The shell's own surface | `src/shell/` |
| 5 | Relationship to `frappe/ui` | see below |

## Q5 — the relationship to `frappe/ui`, stated up front

**They stay two packages. `frontend/` consumes `@framework/ui` exactly as CRM does today.**

The scaffold takes this position rather than merging them because the two have different
audiences: `ui/` is a library apps import, `frontend/` is an application apps plug into.
Merging would make every app that wants a component depend on the shell.

But note what one bundle changes: `@framework/ui` is raw source with no build step, and
under `#42069` it is compiled *by the framework's vite*, in the same module graph as the
shell — so the "no build step" property stops being a property of the package and becomes
a property of the bundle. That is the same fact `#42071` is chewing on from the
import-map side.

## Deliberately not decided here

- **The shared-dep import map** (`ui/vite/extensionHost.js`). Charter item 1 says one
  bundle retires it; **#42071** is deciding whether that is true. `plugin/` therefore does
  not include it and does not delete it.
- **The sidebar and cross-prefix navigation** — **#42102**. `src/shell/AppShell.vue` marks
  the hole, it does not fill it.
- **Refusing an unauthorized user** — **#42112**. `src/boot.ts` marks where the refusal
  lands.
