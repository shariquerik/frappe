// Eligibility: does an Action's `when` predicate apply in the current Context? Equality-only,
// evaluated as data (no `eval`, ADR-0006). The tier split also drives specificity (./specificity).
import type { Context, When } from './types'

// The *surface* tier (the focused Surface's coordinates) plus the focus-tier `selection`/`focusKind`
// markers, ranked together above the *window* tier (the active window's frame) in the specificity
// vector (./specificity). Together they are the complete, closed set of Context keys an Action may
// scope on; anything else is unknown (forward-compat warn below). The focus-tier markers count with
// the surface coordinates — a selection/focus predicate outranks a window one, same as ADR-0032.
export const SURFACE_KEYS = ['doctype', 'recordName', 'view', 'appletId', 'selection', 'focusKind'] as const
export const WINDOW_KEYS = ['activeApp', 'windowRole'] as const
const CONTEXT_KEYS: ReadonlySet<string> = new Set([...SURFACE_KEYS, ...WINDOW_KEYS])

// The one non-equality `when` value (ADR-0038): "this Context key is DEFINED", any value. Still pure
// data, no expressions — it lets a predicate say "a selection exists" without pinning a kind, and
// retires the Region `requires` special case (regions.ts express their gate as `{ key: PRESENT }`).
export const PRESENT = '*'

// True when every key in `when` matches the Context: an exact value match, or — for `PRESENT` — the
// Context key merely being defined. An empty/absent predicate is global (always eligible). A key
// whose Context value is `undefined` is a non-match (including `PRESENT`, which needs a value); an
// unknown key degrades to no-match plus a loud warn (an additive Context field a newer app scopes on
// but this client doesn't know — it must hide, not silently always-match).
export function isEligible(when: When | undefined, context: Context): boolean {
  if (!when) return true
  for (const key of Object.keys(when)) {
    if (!CONTEXT_KEYS.has(key)) {
      console.warn(`[actions] unknown when key "${key}" — Action treated as not eligible`)
      return false
    }
    const actual = context[key as keyof Context]
    const expected = when[key as keyof When]
    if (expected === PRESENT) { if (actual === undefined) return false; continue }
    if (actual !== expected) return false
  }
  return true
}
