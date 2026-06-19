// Thin barrel over the colocated, domain-owned type files. Each subsystem keeps its own
// `types.ts` next to the code that defines/consumes those shapes; this re-exports them all
// so `@/types` stays the one stable import path (the ~30 consumers never track which folder
// a symbol lives in). Add a new shared type to the matching domain file, not here:
//   surface/types.ts   — Surface/window/geometry shapes (the store core)
//   config/types.ts    — curated app/doctype display config + the view-layer prop bundle
//   data/types.ts      — the data-layer doc/cache/list-options shapes + the OS API seam
//   registry/types.ts  — Registry contributions + the boot payload
//   desktop/types.ts   — the window-manager's Theme + OsState
//   routing/types.ts   — the parsed RouteParams
export * from './surface/types'
export * from './config/types'
export * from './data/types'
export * from './registry/types'
export * from './desktop/types'
export * from './routing/types'
