// Eligibility: does an Action's `when` predicate apply in the current Context? Equality-only,
// evaluated as data (no `eval`, ADR-0006). The tier split also drives specificity (./specificity).
import type { Context, When } from './types'

// The *surface* tier (the focused Surface's coordinates) and the *window* tier (the active
// window's frame). Together they are the complete, closed set of Context keys an Action may
// scope on; anything else is unknown (forward-compat warn below).
export const SURFACE_KEYS = ['doctype', 'recordName', 'view', 'appletId'] as const
export const WINDOW_KEYS = ['activeApp', 'windowRole'] as const
const CONTEXT_KEYS: ReadonlySet<string> = new Set([...SURFACE_KEYS, ...WINDOW_KEYS])

// True when every key in `when` equals the matching Context value. An empty/absent predicate
// is global (always eligible). A key whose Context value is `undefined` is a non-match; an
// unknown key degrades to no-match plus a loud warn (an additive Context field a newer app
// scopes on but this client doesn't know — it must hide, not silently always-match).
export function isEligible(when: When | undefined, context: Context): boolean {
  if (!when) return true
  for (const key of Object.keys(when)) {
    if (!CONTEXT_KEYS.has(key)) {
      console.warn(`[actions] unknown when key "${key}" — Action treated as not eligible`)
      return false
    }
    if (context[key as keyof Context] !== when[key as keyof When]) return false
  }
  return true
}
