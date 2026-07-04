# Context gains a focus tier: focusKind + generalized selection, as data

> **Status:** Accepted (2026-07-04, grilled). Not yet implemented. Extends the `Context`
> snapshot (ADR-0032) with a third tier below window and surface. Generalizes
> `desktop/selection.ts`; supersedes the single-purpose `selection: 'rows'` marker.

Menu verbs from the real apps act on things *inside* a window: raven's Format menu needs "the
composer holds keyboard focus", its Message menu needs "a message is selected", crm's Record
verbs need the focused lead/deal, the bulk bar needs selected rows. `Context` stops at the
surface tier today; the only sub-window signal is a window-focused boolean.

## Not a responder chain

The Mac answer — a chain of live responder objects a command walks until one claims it — is
code-not-data: widget registries, imperative dispatch, capability queries against live objects.
It is exactly what the Action model was built to avoid. Instead, the focus tier is **two flat
fields, published as data**:

- **`focusKind?: string`** — *where keyboard focus is*. Singular and volatile. Gates
  composer-style menus (`when: { focusKind: 'composer' }`).
- **`selection?: string`** — *what kind of thing is selected* (presence/kind marker: `'rows'`,
  `'message'`, …). Persists while focus moves elsewhere — selecting a message and then clicking
  the composer leaves BOTH facts true, which is why these are two fields, not one slot.

Selected *values* never enter `Context`. `desktop/selection.ts` generalizes from
`Record<winId, string[]>` to `Record<winId, { kind: string, values: string[] }>` — same
winId-keyed pattern as `geo`, same publish seam the list already uses, now open to any surface
or applet. Values reach a handler only through `Invocation.selection` (ADR-0037).

## Lifecycle rules

- **Selection** clears on surface swap and window close — the rule `swapSurface` already
  enforces for rows carries over unchanged.
- **focusKind persists until replaced** — it changes only when another widget publishes, the
  surface swaps, or the window closes. Never cleared on raw DOM blur: opening a menu steals
  focus, so clear-on-blur would empty the Format menu at the exact moment the user reaches for
  it. Persist-until-replaced avoids the classic menu-focus bug by construction.

## Vocabulary: closed core, app-namespaced escape

The kind vocabulary (for both fields) is a closed OS-owned set like Regions (ADR-0004), seeded
from the surveyed apps: `rows`, `record`, `composer`, `message`, `card`. An app that needs a
kind the OS lacks does **not** wait for the OS: it mints `<appId>.<kind>`
(`raven.voice-note`) and uses it immediately in its own contributions. Namespacing prevents
collision; an Action gating on *another* app's namespaced kind draws a loud validation warning —
that is coupling to a private vocabulary its owner may change. A kind that proves general is
promoted into the unprefixed core.

## Eligibility gains one presence form

Equality-only `when` cannot say "a selection exists". `When` values gain a single presence
marker (`'*'` = "this Context key is defined") — still pure data, still no expressions. This
replaces the `requires` special case Regions carry for the bulk bar with the general form.

## Considered and rejected

- **Full responder chain.** See above — maximum fidelity, wrong paradigm for a data-resolved
  action system.
- **Open Context keys per app** (`composerFocused`, `messageSelected`, …). The mush failure
  mode: an unbounded, app-invented eligibility namespace. Two closed fields with a governed
  vocabulary express the same facts.
- **One focus facet `{ kind, selection }`.** A single slot makes the composer evict the message
  selection; on a Mac both menus stay live. Focus and selection are orthogonal facts.
- **Clear focusKind on blur.** Truthful and unusable — the menu bar itself blurs the widget.
- **Capability queries (can-undo, is-dirty).** Live-object questions, not data. No surveyed
  menu needs them; a verb that truly does waits for the real app that proves it.

## Relationship to prior ADRs

- **Extends ADR-0032.** A third Context tier: window / surface / focus. Scope's auto-`when`
  machinery is untouched.
- **Feeds ADR-0037.** The focus tier publishes what Invocation snapshots.
- **Mirrors ADR-0004.** The kind vocabulary is a closed set with the same governance shape as
  Regions — plus the namespaced escape so an app never blocks on the OS.
