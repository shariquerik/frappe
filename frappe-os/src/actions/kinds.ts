// The selection/focus KIND vocabulary (ADR-0038) — what a focused widget's selection or keyboard
// focus IS. A closed, OS-owned core set governed like Regions (ADR-0004): the OS seeds the core
// kinds; an app that needs a kind the OS lacks does NOT wait for the OS — it mints a namespaced
// `<appId>.<kind>` (`raven.voice-note`) and uses it at once in its own contributions. A kind that
// proves general is later promoted into the unprefixed core. Both `Context.selection` (the kind of
// the front list's selection) and `Context.focusKind` (the focused widget) draw from this set.
import type { Action } from './types'

// The closed core, seeded from the surveyed apps: the list's multi-row `rows`, crm's focused
// `record` and its `card`, raven's `composer` and `message`. Unprefixed — the shared vocabulary
// any app scopes on freely. Exported as constants so publishers/gaters name a kind, never a literal.
export const ROWS = 'rows'
export const RECORD = 'record'
export const COMPOSER = 'composer'
export const MESSAGE = 'message'
export const CARD = 'card'
export const CORE_KINDS: readonly string[] = [ROWS, RECORD, COMPOSER, MESSAGE, CARD]

const CORE: ReadonlySet<string> = new Set(CORE_KINDS)

// The app prefix of a namespaced kind (`raven.voice-note` → `raven`), or null for a core kind or a
// value with no `<app>.<kind>` shape. A leading dot (`.x`) has no app half, so it namespaces nothing.
export function kindNamespace(kind: string): string | null {
  const dot = kind.indexOf('.')
  return dot > 0 ? kind.slice(0, dot) : null
}

// A well-formed kind: a core kind, or an app-namespaced `<appId>.<kind>` with both halves present.
// A malformed value (empty, leading/trailing dot) is neither — publishers reject it (selection.ts /
// focus-kind.ts) rather than poison the focus tier with a kind no `when` can honestly match.
export function isValidKind(kind: string): boolean {
  if (CORE.has(kind)) return true
  const dot = kind.indexOf('.')
  return dot > 0 && dot < kind.length - 1
}

// Warn when an Action gates on ANOTHER app's namespaced kind — coupling to a private vocabulary its
// owner may change without notice (ADR-0038). Core kinds and the presence marker are shared, so they
// never warn; only a foreign `<otherApp>.<kind>` in the Action's own `when` does. Checked over both
// focus-tier keys the vocabulary governs.
export function warnForeignKind(action: Action): void {
  for (const key of ['selection', 'focusKind'] as const) {
    const kind = action.when?.[key]
    if (!kind) continue
    const owner = kindNamespace(kind)
    if (owner && owner !== action.sourceApp) {
      console.warn(`[actions] ⚠ foreign kind: "${action.sourceApp}" gates on "${kind}" — a private kind owned by "${owner}" (ADR-0038)`)
    }
  }
}
