// The resolver — a pure-data engine (no `eval`, no handler loading): given a Region id and
// the current Context, it returns the winning Action per (region, command) and the Actions
// they shadow. Competition is per (region, command) — the same verb in the same region;
// different commands or regions never compete, so they all render (CONTEXT.md → Action).
//
// The winner of a competition is chosen by, in order (prototype-validated, design doc):
//   1. specificity — the lexicographic (surfaceCount, windowCount) vector (tier dominates count)
//   2. layer — ADR-0007 App < Site < User
//   3. order — explicit priority; HIGHER wins (a deliberate bump). Distinct from the ascending
//      within-region RENDER order, which is a separate axis applied to the winners below.
//   4. a genuine tie — logged as `⚠ true-tie`, resolved to the first competitor (never a
//      silent coin-flip; ADR-0007 "shadowed, never silently dropped").
// Every shadow is attributed and logged (ADR-0014), distinguishing a clean override from a tie.
import { isEligible } from './eligibility'
import { specificity, compareSpecificity } from './specificity'
import type { Action, Context, ShadowEvent } from './types'

const LAYER_RANK = { app: 0, site: 1, user: 2 } as const
const layerRank = (a: Action): number => LAYER_RANK[a.layer ?? 'app']
const orderOf = (a: Action): number => a.order ?? 0

// Compare two competitors down the tiebreak chain. >0 when `a` outranks `b`; 0 is a true tie.
function compareActions(a: Action, b: Action): number {
  return compareSpecificity(specificity(a.when), specificity(b.when))
    || layerRank(a) - layerRank(b)
    || orderOf(a) - orderOf(b)
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

// Pick the winner of one command's competitors, recording every loser as a shadow.
function resolveCompetition(command: string, region: string, competitors: Action[], shadows: ShadowEvent[]): Action {
  let winner = competitors[0]
  for (const challenger of competitors.slice(1)) {
    const cmp = compareActions(challenger, winner)
    const [keep, drop] = cmp > 0 ? [challenger, winner] : [winner, challenger]
    shadows.push({ region, command, winner: keep, loser: drop, reason: cmp === 0 ? 'true-tie' : 'override' })
    winner = keep
  }
  return winner
}

function logShadow(s: ShadowEvent): void {
  const tag = s.reason === 'true-tie' ? '⚠ true-tie' : 'override'
  console.warn(`[actions] ${tag}: ${s.region}/${s.command} — "${s.winner.sourceApp}" shadows "${s.loser.sourceApp}"`)
}

export interface ResolveResult {
  items: Action[]
  shadows: ShadowEvent[]
}

// Resolve a region against the Context: the winning Actions (in ascending within-region render
// order), plus the attributed, logged shadows.
export function resolve(actions: Action[], region: string, context: Context): ResolveResult {
  const eligible = actions.filter((a) => a.region === region && isEligible(a.when, context))
  const shadows: ShadowEvent[] = []
  const items: Action[] = []
  for (const [command, competitors] of groupByCommand(eligible)) {
    items.push(resolveCompetition(command, region, competitors, shadows))
  }
  shadows.forEach(logShadow)
  items.sort((a, b) => orderOf(a) - orderOf(b))
  return { items, shadows }
}
