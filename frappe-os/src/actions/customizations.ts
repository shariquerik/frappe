// The Customizations view's pure structural projection (ADR-0015; CONTEXT.md → "Customizations
// view"). NOT a resolve() replay: resolve() runs per-Region against the live Context and stores
// no shadow ledger, so a contextual customization (erpnext re-titling "New window" only when
// activeApp = erpnext) never surfaces under a non-matching Context. Instead this reads the full
// declared Action set and DESCRIBES each customization structurally — the contest and its
// conditions, not one window's live winner — so it lists EVERY customizing contender, not a
// Context-filtered "winner" set. Read-only this slice; each row carries
// sourceApp/region/command/layer/removed so a per-row Restore is additive later (ADR-0015 §1).
import type { Action, Layer, When } from './types'
import type { AppKind, CustomizationGroup, CustomizationRow } from '@/types'

// Pre-cook shapes: the grouping primitive builds rows/groups WITHOUT the appKind-derived fields
// (a row's `unexpected`, a group's `appKind`), because grouping is registry-free — it can't know
// an app's kind. cookCustomizations() bakes those in once the kind resolver is composed (the seam).
type RowDraft = Omit<CustomizationRow, 'unexpected'>
interface GroupDraft {
  appId: string
  rows: RowDraft[]
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

function toRow(a: Action): RowDraft {
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
function byRegionThenCommand(x: RowDraft, y: RowDraft): number {
  return x.region.localeCompare(y.region) || x.command.localeCompare(y.command)
}

// Project the declared Action set into customizations grouped by app (ADR-0015 §4/§5). Pure: no
// resolve(), no Context, no registry — the appKind/unexpected fields are baked in later by
// cookCustomizations (ADR-0014 item 4). Groups are app-sorted; rows region/command-sorted.
export function customizationGroups(actions: Action[]): GroupDraft[] {
  const byApp = new Map<string, RowDraft[]>()
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

// The feature-app removal marker (ADR-0015 §5) — the human-facing counterpart of removals.ts's console
// warning, from the SAME predicate: a removal by a *feature* app is the surprising case ("review
// this"); a pure-customization app removing chrome is its job (quiet). `kind` is injected so this
// stays a pure unit, mirroring warnFeatureAppRemovals.
export function isUnexpectedRemoval(row: RowDraft, kind: AppKind): boolean {
  return row.reason === 'removal' && kind === 'feature'
}

// Cook the grouped drafts into the seam-published catalog (issue 05): compose the registry's
// appKind resolver in, baking each group's `appKind` and each row's `unexpected` flag. This is
// the whole computation the OS API's registry.customizations() delegates to — the OS computes,
// the applet only renders. `appKind` is injected so this stays a pure, registry-free unit.
export function cookCustomizations(
  actions: Action[],
  appKind: (appId: string) => AppKind,
): CustomizationGroup[] {
  return customizationGroups(actions).map((group) => {
    const kind = appKind(group.appId)
    return {
      appId: group.appId,
      appKind: kind,
      rows: group.rows.map((row) => ({ ...row, unexpected: isUnexpectedRemoval(row, kind) })),
    }
  })
}
