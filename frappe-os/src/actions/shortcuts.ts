// Keyboard shortcuts (ADR-0037): a shortcut is a Command FIELD (`shortcut`), not a placement — one
// verb keeps one key everywhere it is placed. This module is the single OS dispatcher: it reads the
// binding off a KeyboardEvent, resolves it against the merged Command set through the SAME
// eligibility the menus use, and fires the identical `invoke` (no second dispatch system). Conflicts
// fold first-seen-wins with a loud shadow warn (the ADR-0007 pattern, mirroring project.ts's
// commandsById). The pure core (canonicalBinding/eventBinding/shortcutIndex/pickShortcut) is
// DOM-free and store-free so it unit-tests on plain data; dispatchShortcut is the thin wiring.
import { merged } from './project'
import { contextForOS } from './context'
import { invoke } from './contributions'
import { isEligible } from './eligibility'
import { effectiveWhen } from './scope'
import type { Action, Command, Context } from './types'
import type { OsStore } from '@/types'

// A KeyboardEvent's shortcut-relevant fields — the shape eventBinding reads. A real DOM
// KeyboardEvent satisfies it; tests pass a plain object, so no synthetic event is needed.
export interface KeyChord {
  key: string
  metaKey?: boolean
  ctrlKey?: boolean
  shiftKey?: boolean
  altKey?: boolean
}

// The modifiers we recognise, in the ONE canonical order a binding string is rebuilt into (so
// `shift+mod+k` and `mod+shift+k` compare equal). `mod` is the platform command key — ⌘ on mac,
// Ctrl elsewhere — the same meta||ctrl the OS already folded into one. Ctrl-distinct-from-mod
// (e.g. ⌃⌘F) is out of scope; add a `ctrl` token here additively if a binding ever needs it.
const MODIFIER_ORDER = ['mod', 'alt', 'shift'] as const

// Author-string tokens → their canonical modifier. cmd/ctrl both fold to `mod`, option → alt.
const MODIFIER_ALIASES: Record<string, (typeof MODIFIER_ORDER)[number]> = {
  mod: 'mod', cmd: 'mod', ctrl: 'mod', control: 'mod',
  alt: 'alt', option: 'alt',
  shift: 'shift',
}

// The bare modifier keys — a keydown of one of these alone is not a shortcut.
const MODIFIER_KEYS = new Set(['Meta', 'Control', 'Shift', 'Alt'])

// The macOS glyph for each modifier, for the menu chip (formatShortcut). This is a macOS-style
// shell, so ⌘ reads right on every platform even though `mod` runs as Ctrl off-mac.
const MODIFIER_GLYPH: Record<string, string> = { mod: '⌘', alt: '⌥', shift: '⇧' }

// Normalise a key name to its canonical token: lower-cased, so a shifted letter ('K') and its
// modifier flag stay independent (`mod+shift+k`, not `mod+K`).
function normalizeKey(key: string): string {
  return key.toLowerCase()
}

// Canonicalise an author binding string ("Cmd+Shift+K") to the stable form the index and lookups
// key on ("mod+shift+k"): modifiers de-aliased and ordered, the single key last. An unknown token
// is treated as the key. Returns '' for an empty/keyless string.
export function canonicalBinding(binding: string): string {
  const mods = new Set<string>()
  let key = ''
  for (const raw of binding.toLowerCase().split('+')) {
    const token = raw.trim()
    if (!token) continue
    const modifier = MODIFIER_ALIASES[token]
    if (modifier) mods.add(modifier)
    else key = token
  }
  const parts = MODIFIER_ORDER.filter((modifier) => mods.has(modifier)) as string[]
  if (key) parts.push(key)
  return parts.join('+')
}

// The canonical binding a KeyboardEvent represents, or null when the press is only a modifier (no
// verb key yet). meta OR ctrl → `mod`, matching canonicalBinding's fold and the OS's prior wiring.
export function eventBinding(event: KeyChord): string | null {
  if (MODIFIER_KEYS.has(event.key)) return null
  const parts: string[] = []
  if (event.metaKey || event.ctrlKey) parts.push('mod')
  if (event.altKey) parts.push('alt')
  if (event.shiftKey) parts.push('shift')
  parts.push(normalizeKey(event.key))
  return parts.join('+')
}

// A binding as macOS glyphs for the menu chip: modifiers as symbols, the key upper-cased — `mod+n`
// → `⌘N`, `mod+shift+k` → `⌘⇧K`.
export function formatShortcut(binding: string): string {
  const tokens = canonicalBinding(binding).split('+')
  const key = tokens.pop() ?? ''
  const modifiers = tokens.map((token) => MODIFIER_GLYPH[token] ?? token).join('')
  return modifiers + key.toUpperCase()
}

// Fold commands into a binding→Command map, FIRST-SEEN WINS (first-party OS verbs lead in the
// merged order, so an app can't silently steal ⌘K). A colliding binding is a shortcut-axis shadow,
// logged loudly like the resolver's Action shadows and project.ts's command collisions — never a
// silent last-wins overwrite (ADR-0007/0014). Commands with no shortcut are skipped.
export function shortcutIndex(commands: Command[]): Map<string, Command> {
  const byBinding = new Map<string, Command>()
  for (const command of commands) {
    if (!command.shortcut) continue
    const binding = canonicalBinding(command.shortcut)
    if (!binding) continue
    const winner = byBinding.get(binding)
    if (winner) {
      console.warn(`[actions] shortcut-collision: ${binding} — "${winner.id}" shadows "${command.id}"`)
      continue
    }
    byBinding.set(binding, command)
  }
  return byBinding
}

// A shortcut Command is eligible if ANY of its placements is eligible for the Context — the SAME
// isEligible(effectiveWhen) the menu resolver runs, just region-agnostic (a key fires wherever the
// verb is live, not per-menu). A command with NO placement has no gate anywhere, so it is a global
// verb — the keyboard-only case (the ⌘K palette, reached by no menu item per ADR-0039). This
// mirrors isEligible(undefined) = global: absence of a predicate means always.
function isShortcutEligible(command: Command, actions: Action[], context: Context): boolean {
  const placements = actions.filter((action) => action.command === command.id)
  if (placements.length === 0) return true
  return placements.some((action) => isEligible(effectiveWhen(action), context))
}

// Resolve a canonical binding to the Command that should fire — the shortcut analogue of a menu's
// projectRegion, as a pure function over injected data. First-seen-wins picks the Command; the
// text-entry guard blocks a non-global shortcut while a text widget holds focus (a composer verb
// opts in with `allowInInput`); eligibility gates it to the live Context. Null = nothing fires.
export function pickShortcut(
  binding: string,
  inTextEntry: boolean,
  commands: Command[],
  actions: Action[],
  context: Context,
): Command | null {
  const command = shortcutIndex(commands).get(binding)
  if (!command) return null
  if (inTextEntry && !command.allowInInput) return null
  if (!isShortcutEligible(command, actions, context)) return null
  return command
}

// Is the focused element a text-entry widget? Then a non-global shortcut must not steal the key.
// Inputs, textareas, native selects, and any contenteditable count; nothing else does.
export function isTextEntry(element: Element | null): boolean {
  if (!element) return false
  const tag = element.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  return (element as HTMLElement).isContentEditable === true
}

// The OS dispatcher: the thin DOM+store wiring App.vue installs on the global keydown. It reads the
// binding off the event, resolves it against the live merged Commands / Context (with the focused
// element's text-entry state), and fires the identical `invoke`. Returns true when a shortcut fired,
// so the caller preventDefaults; false leaves the key for the browser / other handlers (e.g. Escape).
export function dispatchShortcut(event: KeyboardEvent, os: OsStore): boolean {
  const binding = eventBinding(event)
  if (!binding) return false
  const { byId, actions } = merged()
  const command = pickShortcut(
    binding, isTextEntry(document.activeElement), [...byId.values()], actions, contextForOS(os),
  )
  if (!command) return false
  invoke(command, os)
  return true
}
