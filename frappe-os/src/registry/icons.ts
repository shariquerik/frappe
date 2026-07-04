// Icon data projected through the Registry seam. The curated icon atlas + the per-doctype
// lookup are presentation *data*, so — like apps/doctypes/cards (./ingest) — they are imported
// from config/* ONLY here, inside the registry (index.ts: the single config/* importer). Every
// consumer reads icons from `@/registry`, never from `@/config/icons` directly, so there is one
// access path: seeded from config now, overlayable by server Display contributions later without
// touching a caller. Per-doctype icons already overlay through display config (getMeta().icon);
// `dtIcon` is the pre-meta fallback for a doctype the display config doesn't cover.
export { ICON, dtIcon } from '@/config/icons'
