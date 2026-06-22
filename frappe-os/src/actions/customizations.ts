// The Customizations view's pure structural projection (ADR-0015; CONTEXT.md → "Customizations
// view"). NOT a resolve() replay: resolve() runs per-Region against the live Context and stores
// no shadow ledger, so a contextual customization (erpnext re-titling "New window" only when
// activeApp = erpnext) never surfaces under a non-matching Context. Instead this reads the full
// declared Action set and DESCRIBES each customization structurally — the contest and its
// conditions, not one window's live winner — so it lists EVERY customizing contender, not a
// Context-filtered "winner" set. Read-only this slice; each row carries
// sourceApp/region/command/layer/removed so a per-row Restore is additive later (ADR-0015 §1).
import type { Action, Layer, When } from './types'
import type { AppKind } from '@/types'

// Why an Action is a customizing contender, reusing the resolver's vocabulary (not its live
// output): 'removal' when it suppresses the slot (`removed`), else 'override'.
export type CustomizationReason = 'override' | 'removal'

// One described customization. Carries every field a later Restore affordance needs
// (sourceApp/region/command/layer/removed — ADR-0015 §1) plus the human-facing projection (the
// `reason` and the `when` scope it applies under).
export interface CustomizationRow {
  sourceApp: string
  region: string
  command: string
  layer: Layer
  removed: boolean
  reason: CustomizationReason
  whenScope: string
}

// Customizations grouped by the overriding app (ADR-0015 §5 — the primary axis is the human
// question "what has THIS app done to my OS?"). Region and reason stay secondary (row columns /
// sort), not the top level.
export interface CustomizationGroup {
  appId: string
  rows: CustomizationRow[]
}

const layerOf = (a: Action): Layer => a.layer ?? 'app'

// A contender customizes when it removes the slot (`removed`), re-presents the Command
// (`commandPatch`), or places a same-identity Action above the App-default layer (ADR-0015 §4).
// A plain App-layer Action with no patch/removal is just the OS default placement — not a
// customization, so it is filtered out.
function isCustomization(a: Action): boolean {
  return !!a.removed || !!a.commandPatch || layerOf(a) !== 'app'
}

// Render an Action's Eligibility as a human scope (ADR-0015 §4): an empty/absent `when` is global
// ("always"); otherwise each key as "key = value", AND-ed (CONTEXT.md → Eligibility), e.g.
// "when activeApp = erpnext".
export function describeWhen(when?: When): string {
  const keys = when ? (Object.keys(when) as (keyof When)[]) : []
  if (!keys.length) return 'always'
  return 'when ' + keys.map((k) => `${k} = ${when![k]}`).join(', ')
}

function toRow(a: Action): CustomizationRow {
  return {
    sourceApp: a.sourceApp,
    region: a.region,
    command: a.command,
    layer: layerOf(a),
    removed: !!a.removed,
    reason: a.removed ? 'removal' : 'override',
    whenScope: describeWhen(a.when),
  }
}

// Secondary sort within a group: by region, then command (ADR-0015 §5 — region/reason are
// columns, not the top level), so one app's changes read in a stable order.
function byRegionThenCommand(x: CustomizationRow, y: CustomizationRow): number {
  return x.region.localeCompare(y.region) || x.command.localeCompare(y.command)
}

// Project the declared Action set into customizations grouped by app (ADR-0015 §4/§5). Pure: no
// resolve(), no Context, no registry — the view layers appKind on top (ADR-0014 item 4). Groups
// are app-sorted; rows within a group are region/command-sorted.
export function customizationGroups(actions: Action[]): CustomizationGroup[] {
  const byApp = new Map<string, CustomizationRow[]>()
  for (const action of actions) {
    if (!isCustomization(action)) continue
    const rows = byApp.get(action.sourceApp) ?? []
    rows.push(toRow(action))
    byApp.set(action.sourceApp, rows)
  }
  return [...byApp.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([appId, rows]) => ({ appId, rows: rows.sort(byRegionThenCommand) }))
}

// The feature-app removal marker (ADR-0015 §5) — the human-facing twin of removals.ts's console
// warning, from the SAME predicate: a removal by a *feature* app is the surprising case ("review
// this"); a pure-customization app removing chrome is its job (quiet). `kind` is injected so this
// stays a pure unit, mirroring warnFeatureAppRemovals.
export function isUnexpectedRemoval(row: CustomizationRow, kind: AppKind): boolean {
  return row.reason === 'removal' && kind === 'feature'
}
