# Indicator rules: the per-doctype override ADR-0028 deferred, as filter-conditioned data

> **Status:** Accepted (2026-07-01, grilled). Not yet implemented. Extends ADR-0028 — it lands the
> per-doctype **override seam** that ADR-0028 left as "irregular `get_indicator` logic stays
> unported." Lives in the doctype's OS manifest (ADR-0030).

A doctype's **Record indicator** (ADR-0028) resolves from an ordered list of **Indicator rules**
declared in its OS manifest. Each rule is `{ condition, label, color }`, where the **condition is a
Frappe filter over the record's fields** — the exact grammar Frappe's own `get_indicator` already
emits. First match wins. This is the OS-native equivalent of desk's per-doctype
`listview_settings.get_indicator`: data-driven, server-reachable, layerable — not client-only JS.

## Why rules, and why Frappe's filter grammar

A survey of every `get_indicator` in Frappe + ERPNext (74 functions) found that **~90–95% are
already declarative**: each branch returns its condition as a filter string
(`return [__("To Bill"), "orange", "per_billed,<,100|docstatus,=,1"]`). The `if/else` ladder is
just evaluating conditions the author already wrote as data. So an indicator rule is that ladder
turned into data, and it **reuses Frappe's filter language** rather than inventing one — covering
equality, truthy/is-set, `in`, and the numeric comparisons (`<,<=,>,>=,!=`) that ERPNext's
percentage/amount indicators live on.

The remaining ~5–10% genuinely **compute** (a live `"{0}%"` label, a client-side upload counter,
a config-derived precision). Those are behavior, not data, and go to the **Script** seam (ADR-0006).
The line is crisp: **reading stored fields is data; computing a value is script.** A rule may carry
a **label template** that interpolates a stored field (`"{percent_complete}%"`) — still reading a
field, just formatting it — so computed *labels* stay data and script is reserved for truly
un-storable state.

## Resolution order

The client resolver picks the first match, top to bottom:

1. **Active workflow state** — built-in, always wins.
2. **Draft / Cancelled** (submittable docs) — built-in, always wins.
3. **Indicator rules**, highest scope/layer first: User override → Site override → App rules
   (the doctype manifest) → **OS default rules**. First match within this list wins.
4. No match → no pill.

Workflow and Draft/Cancelled sit **above** app rules deliberately, not by legacy: a cancelled
document is cancelled regardless of a `published` flag, and painting it "Published" would lie about
its state. Everything else is a rule.

## OS default rules; one format for base and override

The publication/enabled/`DocType.states`/Submitted tiers ADR-0028 hardcoded by field *name*
become **OS default rules** — the same `{ condition, label, color }` shape, supplied by the OS at
the lowest precedence. (The keyword-guess tier is the one exception — see below.) App rules override them; a site or user overrides with **more rules in the
same format** (layered per ADR-0007/0005). This is the deliberate "same format in both places"
decision: the shipped rule and the customization are one grammar, so a customizer never learns a
second one. JS (the Script seam) is reserved for the compute cases — a different format because it
is a genuinely different operation (behavior, not data), not the same thing done twice.

## Rule override identity: a rule is addressed by its condition

ADR-0007 gives a contribution identity `(type, target, name, source)`, but that `name` slot was
designed for Actions, not `{condition, label, color}` rules. This ADR pins what plays the `name`
role for a rule: **its condition.** A Site/User patch names the rule it targets by repeating that
rule's condition — the same way a Placement names its target by the surface reference it points at
(ADR-0023's `ref_key`), not by a separate id. There is no extra `id`/`name` field on a rule; the
meaningful payload *is* the identity, keeping ADR-0031's promise of one small grammar with no
ceremony. The condition is canonicalized (whitespace trimmed per `field,op,value` clause) so
spacing variants collapse to one key; the empty condition `""` is the fallthrough-floor key.
First-match resolution already makes a condition unique within an effective list — a second rule
with the same condition never fires — so the condition is a sound key.

**Merge semantics (a rule is a Collection member, not a Singleton — ADR-0007).** Defaults are the
base ladder; **App, Site, User are three equal patch layers** folded lowest-to-highest by
`merge_rule_layer`. For each incoming rule, keyed by canonical condition:
- **Replace in place** — a rule whose condition matches a ladder rule swaps its label/color at the
  *same slot*, so a recolor never changes which rule wins first-match (the divergence from
  Placements, whose list order is not evaluation precedence).
- **Remove** — a `hidden` patch drops the matching ladder rule (a tombstone; the source layer is
  untouched, so an app upgrade still flows through).
- **Add** — a rule with a new *non-empty* condition is *prepended* ahead of the ladder, so a
  higher layer's new rule wins (User → Site → App → defaults, earlier-wins). A rule with an
  *empty* condition matches every record, so it is instead *appended* as a bottom fallthrough
  floor: it fires only when no real rule above it matched, never as a top catch-all that would
  shadow the whole ladder (the opposite of an author's intent for a label-only fallback).

An override is a **full re-supply** of the rule (`{condition, label, color}`), not a field-level
partial patch — the rule is three fields, so "same format in both places" beats patch-merge
ceremony. This is the deliberate reading of ADR-0007 for a small collection member: the whole
member is replaced, addressed by its condition.

## Keyword-guess stays built-in behavior, not a rule

The one ADR-0028 tier that does **not** become a rule is the keyword-guess fallback
(`frappe.utils.guess_style`): it colors an *open* set of status strings by case-sensitive
substring (`has_words` — `"Pending Review"` → amber). That is **computing** a color from a
string, not reading a stored field — the behavior side of this ADR's own line. It is also
*generic* to every doctype, so it is neither per-doctype data (a rule) nor a per-doctype Script
override (ADR-0006): it is framework behavior. It therefore stays a **built-in resolver floor**,
evaluated below the rule list. This keeps the rule grammar to the operators the real population
lives on (equality, is-set, `in`, numeric) and avoids a `like` operator whose case-sensitivity
would fork between the client resolver (`has_words`, case-sensitive) and a server-side SQL `like`
(case-insensitive).

## Server-projected, riding live meta

The server reads the doctype manifest, merges the layers, and projects the effective rule list into
`get_doctype_meta` (keeping ADR-0028's "server owns the meaning; client resolver stays pure"). It
**auto-fetches** the fields the rules reference (e.g. `per_billed`), retiring desk's manual
`add_fields` chore for indicators. No new round-trip: the spec rides a fetch every surface already
makes.

## Considered and rejected

- **Port `get_indicator` as client JS (per-doctype `.js`).** ADR-0028 rejected this and it stands:
  client-only, unreachable by the server/API, invisible to third-party merge. It is also the
  *behavior* half of the line — reserved for the ~5% via the Script seam, not the base.
- **Invent a bespoke condition language.** Frappe already ships one (the filter grammar authors
  write today). Reuse beats a second dialect.
- **A minimal language (truthy/equals only).** Too small — it misses ERPNext's numeric percentage
  and amount indicators, which are the bulk of the real population.
- **Everything in JS (desk's grab-bag).** Forces code for "published → green"; loses server
  reach, third-party merge, and layering. Rejected — the thing ADR-0028 set out to leave behind.

## Relationship to prior ADRs

- **Extends ADR-0028.** Adds the override seam it deferred, without moving its boundary: the server
  still owns the meaning, the client resolver stays pure and frappe-ui-free.
- **Lives in ADR-0030.** Rules are declared in the doctype manifest (`os/doctype.json → indicator`).
- **Reuses ADR-0007/0005.** Rule layering (app → site → user) is the existing merge, not new
  machinery.
- **Pairs with ADR-0006.** The compute-only ~5% is the Script seam; the rest is data.
