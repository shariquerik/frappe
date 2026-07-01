// Scope → Eligibility (ADR-0032). Because an Action is co-located in an OS manifest tier, the OS
// already knows the context it belongs to, so it auto-supplies the `when` the author would
// otherwise hand-write. This is a pure data derivation — no `eval`, no handler loading — feeding
// the same equality-only Eligibility and specificity the resolver already runs (CONTEXT.md → Scope).
import type { Action, Scope, When } from './types'

// The Scope tiers broadest → narrowest; the index is the carry-forward order (OS carries into App
// into Doctype into View). Specificity, not this order, decides an override contest — a narrower
// tier's auto-`when` is simply more specific (see below), so the existing contest already ranks it.
export const SCOPE_TIERS: readonly Scope[] = ['os', 'app', 'doctype', 'view']

// The equality `when` a Scope auto-supplies — the predicate the author would otherwise hand-write:
//   OS      → {}                          global, always eligible
//   App     → { activeApp }               the active app (window tier)
//   Doctype → { doctype }                 the front doctype, any view (surface tier)
//   View    → { doctype, view }           the front doctype AND view (surface tier)
// It reuses the existing Context keys (activeApp / doctype / view) rather than parallel
// `activeDoctype` / `activeView` keys — those would duplicate the surface tier the Context already
// carries ("the same thing twice" ADR-0032 rejects). The front surface's doctype IS the "front
// doctype", so no new coordinate is needed. A coordinate the binding omits is dropped, so a
// half-declared scope degrades to the broader predicate rather than an impossible `undefined` match.
export function scopeWhen(action: Action): When {
  const scope = action.scope
  if (!scope || scope.tier === 'os') return {}
  if (scope.tier === 'app') return scope.app ? { activeApp: scope.app } : {}
  const when: When = {}
  if (scope.doctype) when.doctype = scope.doctype
  if (scope.tier === 'view' && scope.view) when.view = scope.view
  return when
}

// The effective predicate the resolver judges Eligibility and specificity against: the Scope-
// supplied `when` composed with any hand-written `when`. Hand-written keys are the unusual
// cross-surface case — they ADD constraints, and win on a key conflict (an explicit author
// override of an auto-derived coordinate). Because View's auto-`when` is a two-key surface
// predicate and Doctype's a one-key one, the existing (surface, window) specificity vector already
// ranks View > Doctype > App > OS — carry-forward override falls out of the contest, no new axis.
export function effectiveWhen(action: Action): When {
  return { ...scopeWhen(action), ...action.when }
}
