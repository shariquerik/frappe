# Handler kind `server`: call a whitelisted method, declared after-effect

> **Status:** Accepted (2026-07-04, grilled). Not yet implemented. Grows ADR-0008's closed
> Handler kind set by one member. Informed by how crm and raven solved handler delivery today —
> both dangerously.

Most app verbs need no client code: they are "call a whitelisted method, then open/refresh/
toast". The first-party apps prove both the need and the danger of leaving it unsolved: crm
`eval`s Form Script `onClick` strings shipped from the server; raven's Message Actions execute
Server Scripts. Meanwhile an app-contributed `run` Command folds through the whole pipeline and
throws on invoke, because the ESM loader that would deliver its handler module is still
deferred — a first-party-only path masquerading as general.

## The kind

```ts
| { kind: 'server'; method: string; args?: JsonValue; then?: AfterEffect }
```

- **`method`** — a whitelisted Frappe method, called with `args` plus the Invocation context
  coordinates (doctype, recordName, selection values — ADR-0037). Permissions are the server's
  (ADR-0010): the OS adds no authorization of its own.
- **Pure data end to end.** No `eval`, no shipped script text, no client module. This is the
  form crm's Form Scripts and raven's Server Script actions converge to.
- It covers the dominant verb classes surveyed: erpnext's Create menu (`make_delivery_note` →
  open the mapped doc), Status transitions, raven's Create Document actions, bulk server calls.

## After-effects: a closed, declared set

What happens when the method returns is part of the *declaration*, not code:

```ts
type AfterEffect =
  | { kind: 'open-doc' }          // response names a doctype/name → open it as a form surface
  | { kind: 'refresh' }           // invalidate the front surface's records (list or form)
  | { kind: 'notify' }            // toast the response message
  | { kind: 'none' }              // fire-and-forget (default)
```

A closed kind set, additive like Handler itself (ADR-0008). Declaration-side `then` fits the
methods that already exist — erpnext's mappers return docs, not OS-aware envelopes — so apps
adopt the kind without server changes.

## The ESM handler module shrinks, not disappears

Verbs that truly need client behavior (composer formatting, local UI manipulation) still await
the applet-style ESM handler loader. This ADR removes the bulk of its cargo: the loader becomes
the exception path for genuinely client-side verbs, not the prerequisite for any app verb at
all.

## Considered and rejected

- **Response-driven after-effects** (server returns an OS envelope `{ open, message, … }`).
  Server-knows-best is attractive, but it demands OS-aware server methods — every existing
  erpnext mapper would need wrapping before its verb could appear. Declaration-side `then`
  meets the installed base where it is; an envelope kind can be added additively if a real
  method needs to decide dynamically.
- **Ship handler code from the server** (crm's `eval` pattern). Arbitrary code execution from
  data channels — the exact thing the reference-resolved Handler design (ADR-0008) exists to
  prevent.
- **Wait for the ESM loader.** Blocks every app verb on the heaviest mechanism while most verbs
  need none of it.

## Relationship to prior ADRs

- **Grows ADR-0008.** One new closed kind; `run` and `navigate` untouched; additive policy holds.
- **Reuses ADR-0010.** Server permissions are the authorization; failures surface loudly.
- **Consumes ADR-0037.** The method receives Invocation coordinates — context and selection
  values — not re-derived state.
- **Enables ADR-0039's real content.** erpnext's Create/Status menus become data the day the
  kind lands.
