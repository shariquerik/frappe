// ADR-0014 item 4 — the loud, classifier-gated warning that rides ON TOP of the resolver's
// uniform removal log. resolve() already attributes and logs every shadow (including removals,
// slice 3 — "never silent"); this adds a SECOND, louder warning only for the surprising case: a
// *feature* app stripping shared chrome. A *pure-customization* app removing chrome is its whole
// job, so it passes quietly here (its removal is still in the uniform log).
//
// Why this seam: the warning needs the full per-app contribution picture (to classify the removing
// app), which the pure resolver deliberately does not hold. It is emitted where a removal is
// *detected to have won* — a removal that loses to a higher layer never reaches `reason:'removal'`
// and so never warns, exactly right (a removal with no effect is not surprising). The classifier
// is injected as a predicate so this stays a pure unit and the resolver stays registry-free.
import type { AppKind } from '@/types'
import type { ShadowEvent } from './types'

// Warn loudly, attributed (which app, which region/command), for each winning removal whose
// removing app is a feature app. Pure-customization removals are skipped (quiet).
export function warnFeatureAppRemovals(shadows: ShadowEvent[], appKind: (appId: string) => AppKind): void {
  for (const shadow of shadows) {
    if (shadow.reason !== 'removal') continue
    const remover = shadow.winner.sourceApp
    if (appKind(remover) !== 'feature') continue
    console.warn(
      `[actions] ⚠ feature app "${remover}" removed chrome ${shadow.region}/${shadow.command}` +
        ` — a feature app stripping shared chrome is unexpected; review it (ADR-0014 item 4)`,
    )
  }
}
