// Thin barrel over the colocated, domain-owned type files. Each subsystem keeps its own
// `types.ts` next to the code that defines/consumes those shapes; this re-exports them all
// so `@/types` stays the one stable import path (the ~30 consumers never track which folder
// a symbol lives in). Add a new shared type to the matching domain file, not here:
//   surface/types.ts   — Surface/window/geometry shapes (the store core)
//   config/types.ts    — curated app/doctype display config + the view-layer prop bundle
//   data/types.ts      — the data-layer doc/cache/list-options shapes + the OS API seam
//   registry/types.ts  — Registry contributions + the boot payload
//   placements/types.ts — Placements: resolved desktop/dock pins (ADR-0023)
//   recents/types.ts    — Recents: resolved per-user record-open log (ADR-0024)
//   desktop/types.ts   — the window-manager's OsState
//   routing/types.ts   — the parsed RouteParams
//   actions/types.ts   — the Action/extension model (Command/Action/Region/Handler/Context)
//   indicators/types.ts — the Record-indicator spec + resolved pill (ADR-0028)
export * from './surface/types'
export * from './config/types'
export * from './data/types'
export * from './registry/types'
export * from './placements/types'
export * from './recents/types'
export * from './desktop/types'
export * from './routing/types'
export * from './actions/types'
export * from './indicators/types'
