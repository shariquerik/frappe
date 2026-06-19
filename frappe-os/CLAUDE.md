# Frappe OS — agent guide

Standalone Vue 3 macOS-style desktop shell for Frappe, served at `/os` and wired to the
live backend (lists/forms/counts from the REST/whitelisted API; curated icons/colors/card
defs in `src/config/*`). Read **`docs/summary.md`** first — it's the full orientation (mental
model, store, routing, file map, gotchas). This file is just the commands and the rules.

## Commands
```
yarn dev           # dev server → http://localhost:5273/  (base /os/)
yarn typecheck     # vue-tsc over tsconfig.json (app/DOM) + tsconfig.node.json (configs)
yarn build         # production build
yarn preview       # serve the build

yarn test          # Vitest (unit): store state machine + route-map projection (jsdom)
yarn test:watch    # Vitest in watch mode
yarn dev & yarn e2e  # Cypress headless — needs the dev server running on :5273
yarn cypress       # Cypress interactive runner
```

## Tests
- **Vitest** (`tests/*.spec.js`) — pure logic + the record caches: focus transitions +
  `hydrate` (`store.spec.js`), `pathForFocus`/`applyRoute` decision tables
  (`route-map.spec.js`), and `records.ts` with `api.ts` mocked (`records.spec.js`).
- **Cypress** (`cypress/e2e/routing.cy.js`) — only what unit tests can't reach: the
  vue-router `/os/` base, cold-boot URL seeding, reload persistence, browser back/forward,
  DOM-driven minimize. Assert via `data-active-window` (desktop root) / `data-win-id`
  (window root). History-timeline specs are timing-sensitive — assert a window is visible
  before driving back/forward. **Needs a logged-in bench** behind `yarn dev` (live boot).
- Always run `yarn test` after touching `desktop/*` or `routing/route-map.ts`; run Cypress after
  changing the URL↔focus bridge in `main.ts`.

## TypeScript
- The `src/` tree is now fully TypeScript (`.ts` / `<script lang="ts">`). Only the test
  specs (`tests/*.spec.js`, `cypress/*.cy.js`) and `vite.config.js` remain `.js`.
- `allowJs:true` + `checkJs:false` is kept so those `.js` test/config files coexist
  un-type-checked; new code should be `.ts`.
- `frappe-ui` and `@framework/ui` ship untyped source, so they're shimmed to `any` in
  `types/*.d.ts` (mapped via `paths`) to stop vue-tsc crawling them. Add a symbol to the
  frappe-ui shim when a migrated component imports one not yet listed.
- **Type homes**: each subsystem folder owns a `types.ts`; `src/types.ts` is a thin
  `export *` barrel re-exporting them all, so `@/types` is the one stable import path.
- **`defineProps`/`defineEmits` gotcha**: import the macro's type from its CONCRETE module
  (`@/config/types`, `@/surface/types`, …), never the `@/types` barrel. `@vue/compiler-sfc`'s
  macro type resolver can't walk the barrel's `export *` — it trips on `data/types.ts`'s
  `OsStore = ReturnType<typeof useOS>` ("Unresolvable type reference / unsupported built-in
  utility type"). `vue-tsc` and `yarn build` DON'T catch it; only the dev `vite:vue`
  transform does. Non-macro type imports may use the barrel freely.

## Rules
- Keep the URL projection pure and in `routing/route-map.ts`; `main.ts` is wiring only.
- Changing the window-id scheme or URL projection touches several places at once — see the
  "Conventions & gotchas" list in `docs/summary.md`.
- Inherits the bench-wide code guidelines (small functions, prefer reuse, frappe-ui tokens
  for styling) from the parent `CLAUDE.md` files.
