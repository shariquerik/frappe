// The client-side Registry seam (docs/design/surface-and-registry.md §2): the barrel is the
// import path (`@/registry`, ADR-0013), the logic lives in named files.
//   - store.ts        — the seeded index singleton + the synchronous accessors (useRegistry,
//                        getMeta, appForDoctype, initRegistry, register*, applet resolution).
//   - ingest.ts       — config seed / server overlay → the Contribution[] to fold (asServerRegistry).
//   - index-builder.ts — Contribution[] → the RegistryIndex projections renderers read.
//   - applets.ts      — applet types, the first-party catalog, and the pure loader (loadApplet).
//   - extension-points.ts — the contribution `type` constants.
//   - classify.ts     — app-kind classification from contributed kinds (ADR-0014 item 4).
export * from './store'
export * from './ingest'
export * from './index-builder'
export * from './applets'
export * from './extension-points'
export * from './classify'
