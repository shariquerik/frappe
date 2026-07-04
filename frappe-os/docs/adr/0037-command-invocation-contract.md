# Invocation: a Command's handler receives the context that made it eligible

> **Status:** Accepted (2026-07-04, grilled). Implemented — Invocation contract in
> `actions/contributions.ts`; the keyboard-shortcut half (a Command `shortcut` field, the one
> `shortcuts.ts` dispatcher, menu chips) in slice 09. Extends ADR-0008 (Handler kinds) and ADR-0032
> (Scope/Eligibility). Fixes the render-vs-click context gap in `actions/contributions.ts`.

A `run` Handler today is `(os: OsStore) => void`: it receives the whole store and must re-derive
"what am I acting on" from live focus state. The `Context` snapshot that decided the item was
*eligible* is discarded before the click lands. Two defects follow: every handler re-implements
focus-digging, and focus can change between render and click, so a handler may act on a different
context than the one the user saw.

## The contract

```ts
interface Invocation {
  context: Context      // the flat snapshot that won eligibility — frozen at click
  selection: string[]   // the selected values (rows/messages/…), resolved at click
  args?: JsonValue      // static payload from the Handler declaration — pure data
  os: OsStore           // escape hatch for OS chrome verbs; app handlers should rarely touch it
}
type RunHandler = (invocation: Invocation) => void
```

- **Snapshot at click.** The menu (or any Region renderer) builds the `Invocation` when the item
  is activated, from the same `contextForOS` projection that gated it. The handler acts on what
  the user saw.
- **Eligibility sees presence; Invocation carries values.** `Context` stays flat markers
  (equality + presence, per ADR-0038); the actual selected ids travel only in
  `Invocation.selection`. The resolver never loads or reads values — the split
  `regions.ts` already states ("gates on presence, never on value") becomes the system rule.
- **`args` joins the Handler.** `{ kind: 'run'; ref: string; args?: JsonValue }` — additive per
  ADR-0008. One handler can now serve many placements ("Position on Screen" → one
  `dock.set-position` ref with `args: { side }`), instead of one ref per menu item.

## Keyboard shortcuts are a Command field

A shortcut is another projection of the same verb, so it lives on the `Command`
(`shortcut?: string`, e.g. `"mod+n"`), not on an Action: a verb keeps its key everywhere it is
placed. The OS owns dispatch and conflict resolution (first-seen-wins, like Command identity in
ADR-0007; shadowed bindings warn loudly). Menus render the binding as presentation. A shortcut
fires the identical `invoke` path with the identical `Invocation` — no second dispatch system.

## Considered and rejected

- **Keep `(os) => void` and let handlers re-derive.** The status quo: duplicated focus-digging in
  every handler plus a render/click race. Rejected — the eligibility snapshot already exists; not
  passing it is the bug.
- **Pass only `Context`, no `os`.** Purer, but OS chrome verbs (minimize, split, logout) operate
  on the store by nature; forcing them through a second registration seam is machinery without a
  win. The escape hatch stays, documented as chrome-verb territory.
- **Selection values inside `Context`.** Would put values in the resolver's hands and grow the
  eligibility surface unboundedly. Presence/kind for gating, values for acting.
- **Shortcut on the Action.** Placement-level shortcuts would let the same verb carry different
  keys per region/context — the muscle-memory anti-pattern. Command-level, one key per verb.

## Relationship to prior ADRs

- **Extends ADR-0008.** `args` on the `run` kind and `shortcut` on `Command` are additive fields;
  the Handler kind set stays closed (grown separately by ADR-0041).
- **Reuses ADR-0032's Context.** The `Invocation.context` is the same `contextForOS` snapshot the
  Scope machinery gates on — one projection, two consumers.
- **Feeds ADR-0038.** The focus tier publishes the fields this contract snapshots.
