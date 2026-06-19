# Components are organized as feature folders behind a barrel

`src/components/` began as a flat bag of `.vue` files, with each component's pure logic
inlined in its `<script>` and its types either inlined or pushed into the shared
`src/types.ts`. As components grow a projection layer (the list column/cell mappers, the
form's live-schema→FormLayout builder), that logic is untested where it sits and its types
swell the global `types.ts`. The flat layout gives no home for "everything that belongs to
one UI concern."

Decision: a cohesive UI concern lives in a **feature folder** under `components/`, and the
outside world reaches it only through a **barrel** (`index.ts`):

```
components/<Feature>/
  index.ts          # the ONLY public surface — importers use `@/components/<Feature>`
  <Feature>.vue     # the component(s) that belong only to this feature
  <logic>.ts        # pure helpers/projections (mirrors route-map.ts: tested, Vue-free)
  types.ts          # feature-local types — a single file
  tests/            # colocated *.spec.js — a folder (a feature may have several)
```

Rules that make this stick:
- **The barrel is the seam.** Importers use `@/components/<Feature>`, never a path into the
  folder; the folder's internals stay free to move.
- **`types.ts` is one file; `tests/` is a folder.** Types for one feature are small and
  cohesive; tests multiply.
- **Shared leaf components stay flat** in `components/` (e.g. `StatusPill.vue`, used by both
  the list and the form). Pulling a shared leaf into one feature's folder would couple the
  other feature to that folder — the opposite of what this buys.
- **Pure logic and types come out of the `.vue` and out of global `src/types.ts`** into the
  folder, so each feature's projection is unit-tested next to itself and the global type
  module stays domain-level, not component-level.

This required widening the test glob: `vitest.config.js` now collects `src/**/*.spec.js`
alongside the flat `tests/**/*.spec.js`. Without that, a colocated spec is silently never
run — present but dead — so the glob is load-bearing for the convention, not incidental.

`components/ListView/` was the reference implementation (shipped with the ListView adoption).
The rollout is now complete (2026-06-19, `docs/plans/component-feature-folders.md`): every
top-level concern is a folder — `Settings/` (dialog + wallpaper picker), `CommandPalette/`,
`Dock/`, `MenuBar/`, `Window/` (`OSWindow` + `Crumb`/`DocProps` types), and `Form/` (the
form half of `DocView`, with the pure live-schema→FormLayout `buildFormLayout` extracted).
`DocView.vue` deliberately **stays flat** as the list/form switch that composes `ListView/`
+ `Form/`; `StatusPill.vue` and `OSDropdown.vue` stay flat as shared leaves.

One concern moved OUT of `components/` entirely: **applets live under a sibling `src/applets/`**
(e.g. `applets/MyTodos/`). An applet reaches the OS only through the injected `OS_KEY` seam
(ADR-0002/0009), not the store — so it is not a `components/` UI concern. The folder shape is
the same (barrel + logic + `types.ts` + `tests/`), with one twist: the barrel's **`default`
export is the SFC**, because the applet loader (`store/registry.ts loadApplet`) resolves
`load()` to a module whose `default` is the component.

This is recorded because it sets a **uniform shape every future component follows** and a
**load-bearing test-glob dependency**, both cheap to honor going forward but disruptive to
reverse once a dozen folders and their barrel imports exist.
