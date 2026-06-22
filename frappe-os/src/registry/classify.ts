// ADR-0014 item 4 — classify a contributing app from the KINDS it contributes, with nothing
// declared per app. A *feature* app ships at least one user-facing surface (a doctype's
// display-config, a doctype-view, a dashboard-card, or an applet); a *pure-customization* app
// contributes only chrome — commands/actions/patches (and its own neutral 'app' identity, which
// every installed app carries). The distinction is the whole point of the loud-removal warning:
// a pure-customization app removing chrome is its job (quiet); a feature app also stripping chrome
// is the surprising case (loud). Pure data — the Registry already reveals what each app ships.
import type { AppKind } from './types'

// The contribution `type` strings that mean "ships a feature surface" (the closed, data-driven
// extension-point set, ADR-0004). Mirrors the kind constants in ./index.ts; kept as literals here
// so the classifier is a self-contained, registry-free unit. 'command'/'action'/'app' are absent
// by design — they are chrome/identity, not a feature surface.
const FEATURE_KINDS = new Set(['display-config', 'doctype-view', 'dashboard-card', 'applet'])

// Feature if ANY contributed kind is a feature surface; otherwise pure-customization (so an empty
// or chrome-only contribution set is pure-customization).
export function classifyApp(kinds: Iterable<string>): AppKind {
  for (const kind of kinds) if (FEATURE_KINDS.has(kind)) return 'feature'
  return 'pure-customization'
}
