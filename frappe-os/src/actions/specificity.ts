// Specificity: how tightly an Action's `when` scopes the Context. The lexicographic vector
// `(surfaceCount, windowCount)`, NOT a flat key count — the *tier* dominates the raw count,
// so a one-key surface predicate outranks a two-key window one (CONTEXT.md → Eligibility,
// prototype-validated). This is what disambiguates competitors for the same (region, command).
import { SURFACE_KEYS, WINDOW_KEYS } from './eligibility'
import type { When } from './types'

export type Specificity = [surface: number, window: number]

function countIn(when: When, keys: readonly string[]): number {
  return keys.filter((k) => when[k as keyof When] !== undefined).length
}

export function specificity(when: When | undefined): Specificity {
  if (!when) return [0, 0]
  return [countIn(when, SURFACE_KEYS), countIn(when, WINDOW_KEYS)]
}

// Lexicographic compare: surface tier first, then window tier. >0 when `a` is more specific.
export function compareSpecificity(a: Specificity, b: Specificity): number {
  return a[0] - b[0] || a[1] - b[1]
}
