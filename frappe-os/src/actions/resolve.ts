// The resolver — a pure-data engine (no `eval`, no handler loading): given a Region id and
// the current Context, it returns the winning Action per (region, command) and the Actions
// they shadow. Competition is per (region, command) — the same verb in the same region;
// different commands or regions never compete, so they all render (CONTEXT.md → Action).
//
// The winner of a competition is chosen by, in order (prototype-validated, design doc):
//   1. specificity — the lexicographic (surfaceCount, windowCount) vector (tier dominates count)
//   2. layer — ADR-0007 App < Site < User
//   3. priority — explicit competition priority; HIGHER wins (a deliberate bump). A SEPARATE
//      axis from `order` (the ascending within-region RENDER position applied to the winners
//      below), so a high-priority override no longer drags the item to the menu's bottom.
//   4. a genuine tie — logged as `⚠ true-tie`, resolved to the first competitor (never a
//      silent coin-flip; ADR-0007 "shadowed, never silently dropped").
// Every shadow is attributed to the FINAL winner and logged (ADR-0014), distinguishing a clean
// override from a tie from a removal. A winning Action that carries `removed` is a SUPPRESSION
// (ADR-0014): it competes and can win like any other, but renders nothing — the slot is stripped,
// logged as reason:'removal' attributed to the removing app, and reversible by the App<Site<User
// layer order (a higher-layer non-removal Action re-renders the item). A winning override inherits
// the slot's RENDER placement (group + order) from the default it shadows when it declares none, so
// re-presenting a default (a commandPatch re-title) never silently relocates the item across groups.
import { isEligible } from './eligibility'
import { effectiveWhen } from './scope'
import { specificity, compareSpecificity } from './specificity'
import type { Action, Context, ShadowEvent } from './types'

const LAYER_RANK = { app: 0, site: 1, user: 2 } as const
const layerRank = (a: Action): number => LAYER_RANK[a.layer ?? 'app']
const priorityOf = (a: Action): number => a.priority ?? 0
const orderOf = (a: Action): number => a.order ?? 0

// Compare two competitors down the tiebreak chain. >0 when `a` outranks `b`; 0 is a true tie.
// Specificity reads the EFFECTIVE `when` (Scope-derived ⊕ hand-written), so a narrower Scope wins
// carry-forward for free — View's two-key surface predicate outranks Doctype's one-key one, which
// outranks App's window predicate, which outranks OS's global (ADR-0032). No new tiebreak axis.
function compareActions(a: Action, b: Action): number {
  return compareSpecificity(specificity(effectiveWhen(a)), specificity(effectiveWhen(b)))
    || layerRank(a) - layerRank(b)
    || priorityOf(a) - priorityOf(b)
}

// Group eligible Actions by command, preserving first-seen order so a true tie is broken
// deterministically (the earlier competitor wins) rather than by a coin-flip.
function groupByCommand(actions: Action[]): Map<string, Action[]> {
  const groups = new Map<string, Action[]>()
  for (const action of actions) {
    const competitors = groups.get(action.command) ?? []
    competitors.push(action)
    groups.set(action.command, competitors)
  }
  return groups
}

// The winner is the max down the tiebreak chain; the FIRST competitor wins a true tie — the
// fold advances only on a strict `> 0`, never on equality, so the result is deterministic.
function pickWinner(competitors: Action[]): Action {
  let winner = competitors[0]
  for (const challenger of competitors.slice(1)) {
    if (compareActions(challenger, winner) > 0) winner = challenger
  }
  return winner
}

// Why the FINAL winner shadowed each loser: a `removal` when the winner suppresses the slot
// (ADR-0014 — it renders nothing), else a clean `override` when it strictly outranks the loser,
// else an indistinguishable `true-tie`. A removal that itself loses to a higher layer is just an
// ordinary `override` loser — the reason tracks the WINNER's effect, not the loser's intent.
function shadowReason(winner: Action, loser: Action): ShadowEvent['reason'] {
  if (winner.removed) return 'removal'
  return compareActions(winner, loser) === 0 ? 'true-tie' : 'override'
}

// Record every non-winning competitor as a shadow of the FINAL winner (not whichever Action was
// winning mid-fold). Attributing to the final winner keeps a 3+-way competition's log honest — an
// intermediate loser is never credited to an Action that itself went on to lose.
function recordShadows(command: string, region: string, competitors: Action[], winner: Action, shadows: ShadowEvent[]): void {
  for (const loser of competitors) {
    if (loser === winner) continue
    shadows.push({ region, command, winner, loser, reason: shadowReason(winner, loser) })
  }
}

// A winning override inherits the slot's RENDER placement (group + order) from a default it
// shadows when it declares none — re-presenting a default must not silently relocate the item.
// An override that DOES set group/order keeps its own (a deliberate relocation, ADR-0014). Never
// mutates the winning Action (no shared-state leak across contexts/windows).
//
// The slot is inherited from the STRONGEST shadowed default that actually declares one — the loser
// the winner most directly overrides — not the first placement-bearing competitor in registration
// order. A weak global competitor carrying its own placement must not hijack the slot from the
// higher-tier default the winner is re-presenting, and a re-title chain (App < Site < User, all
// placement-less above the default) must reach past the runner-up to the default that holds it.
function inheritPlacement(winner: Action, competitors: Action[]): Action {
  if (winner.group !== undefined && winner.order !== undefined) return winner
  const placed = competitors.filter((c) => c !== winner && (c.group !== undefined || c.order !== undefined))
  if (!placed.length) return winner
  const base = placed.reduce((best, c) => (compareActions(c, best) > 0 ? c : best))
  return { ...winner, group: winner.group ?? base.group, order: winner.order ?? base.order }
}

function logShadow(s: ShadowEvent): void {
  const tag = s.reason === 'true-tie' ? '⚠ true-tie' : s.reason
  console.warn(`[actions] ${tag}: ${s.region}/${s.command} — "${s.winner.sourceApp}" shadows "${s.loser.sourceApp}"`)
}

export interface ResolveResult {
  items: Action[]
  shadows: ShadowEvent[]
}

// Resolve a region against the Context: the winning Actions (in ascending within-region render
// order), plus the attributed, logged shadows.
export function resolve(actions: Action[], region: string, context: Context): ResolveResult {
  const eligible = actions.filter((a) => a.region === region && isEligible(effectiveWhen(a), context))
  const shadows: ShadowEvent[] = []
  const items: Action[] = []
  for (const [command, competitors] of groupByCommand(eligible)) {
    const winner = pickWinner(competitors)
    recordShadows(command, region, competitors, winner, shadows)
    // A winning removal is a SUPPRESSION (ADR-0014): it renders nothing, so it never reaches the
    // items the Region draws — the strip is recorded above (reason:'removal'), never silent.
    if (!winner.removed) items.push(inheritPlacement(winner, competitors))
  }
  shadows.forEach(logShadow)
  items.sort((a, b) => orderOf(a) - orderOf(b))
  return { items, shadows }
}
