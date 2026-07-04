// The client-side Registry seam (docs/design/surface-and-registry.md §2): the barrel is the
// import path (`@/registry`, ADR-0013), the logic lives in named files.
//   - store.ts        — the seeded index singleton + the synchronous accessors (useRegistry,
//                        getMeta, appForDoctype, initRegistry, register*, applet resolution).
//   - ingest.ts       — config seed / server overlay → the Contribution[] to fold (asServerRegistry).
//   - index-builder.ts — Contribution[] → the RegistryIndex projections renderers read.
//   - applets.ts      — applet types, the first-party catalog, and the pure loader (loadApplet).
//   - icons.ts        — the curated icon atlas + per-doctype lookup, projected from config/icons.
//   - extension-points.ts — the contribution `type` constants.
//   - classify.ts     — app-kind classification from contributed kinds (ADR-0014 item 4).
//
// The registry is the single importer of curated config *data* — apps/doctypes/cards via
// ./ingest, icons via ./icons — so there is one access path per datum, overlayable by the
// server. Pure config *helpers* (config/apps: initials/pill/greeting) are stateless and may be
// imported directly; the single-importer rule governs data, not functions.
export * from './store'
export * from './ingest'
export * from './index-builder'
export * from './applets'
export * from './icons'
export * from './extension-points'
export * from './classify'
