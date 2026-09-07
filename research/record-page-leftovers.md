# The files left on the pre-split branch, and a home for COMPATIBILITY.md

Research for frappe/frappe#42550. Read on 2026-09-07 against `upstream/desk-v2` at
`f31836aa21` and `origin/desk-v2` at `07eae7b3c7`. Every claim cites a file and line.
Paths with no branch prefix are on `upstream/desk-v2`.

## Summary

The split commit says what it left behind and why. Its message reads: "Carried across
from `feat/saved-view-sidebar` with the Vue dialog components, `loader.ts`,
`commitChannel.ts` and `formDialogLayout.ts` left behind -- `Record.vue` is a
deliberately minimal host with no form layout, tabs or panel" (commit `964bf8fe86`,
paragraph 4). So the nine were a decision, not an accident. The question is which of
those decisions still hold now that the record page is being built for real.

| File | Lines | What it does | What upstream imports or replaces it | Call | Citation |
| --- | --- | --- | --- | --- | --- |
| `dialog.test.ts` | 416 | Executable claims for `page.dialog`: close contract, page binding, attribution, `confirm`/`danger` narrowing, and the `form` layout modes | Nothing. `dialog.ts` moved with a comment-only diff (12+/39-, every hunk a comment) and has no test upstream | **port with its test** (done on this branch, 27/27 pass) | old: `origin/desk-v2:ui/src/experimental/RecordPage/tests/dialog.test.ts:57-416`; new: `frontend/src/recordPage/tests/dialog.test.ts` |
| `formDialogLayout.ts` | 215 | Pure functions turning `page.dialog.form()` options into a `FormLayoutSchema`, plus mandatory checking | Nothing. `types.ts:237-246` still promises `fields`, `tabs`, `doctype` and `fieldnames` on `PageDialogFormOptions`, but no upstream code resolves them | **port with its test** (done; 9 of the 27 tests above are its) | `frontend/src/recordPage/formDialogLayout.ts:29-156`; needs `formLayoutSource/section.ts` (56 lines), also ported |
| `PageDialogs.vue` | 26 | The page's own dialog stack; closes every open dialog on unmount | `createRecordPage.ts:124-128` still exposes `dialogs` and `closeDialogs` "for the host's `<PageDialogs>`", and `dialog.ts:2` still says `<PageDialogs>` mounts the stack. No host mounts it: `Record.vue:116-130` never reads `controller.dialogs` | **port**, when `Record.vue` grows a form layout. Until then `page.dialog.open()` and `.form()` push an entry nobody renders (`dialog.ts:141-170`) and the promise waits for `closeAll` | `origin/desk-v2:...RecordPage/PageDialogs.vue:5-10,25` |
| `PageOpenDialog.vue` | 43 | Host for `page.dialog.open()`: frappe-ui `Dialog` chrome, `close(result)` settles, Esc resolves `null` | Nothing. Imports only `frappe-ui` and `./dialog`, both present upstream | **port**, with `PageDialogs.vue` | `origin/desk-v2:...RecordPage/PageOpenDialog.vue:6-15,33-42` |
| `PageFormDialog.vue` | 228 | Host for `page.dialog.form()`: local doc, submit, custom actions, mandatory check | Nothing. Imports `useFormLayout` from `../FormLayoutSource` (line 59) and `errorMessage` (line 60); neither exists upstream, since `ui/src/experimental/` did not move | **port later**, with the Form Layout host. Its test passes 7/7 once those two imports are stubbed, so the component itself is sound | `origin/desk-v2:...RecordPage/PageFormDialog.vue:54-73` |
| `formDialog.test.ts` | 231 | DOM tests for `PageFormDialog.vue`: throw holds the dialog open, custom actions, dismissal paths | Nothing | **port with `PageFormDialog.vue`**, not before; not committed here | `origin/desk-v2:...RecordPage/tests/formDialog.test.ts:105-231` |
| `usePageScripts.ts` | 36 | Loads a doctype's Page Script tier and re-fetches it on the `page_script_changed` socket event | `pageScripts.ts:40-49` (`loadPageScripts`, `reloadPageScripts`) moved and are called only from tests. Nothing upstream loads the tier for a page. `ui/src/socket.ts` exists upstream and `main.ts:57` installs the socket plugin, so the composable would resolve as written | **port**, when `Record.vue` loads Page Scripts. Blocked on the `Page Script` DocType landing upstream, not on this file | `origin/desk-v2:...RecordPage/usePageScripts.ts:2-4,16-36` |
| `loader.ts` | 86 | Runtime loader for third-party ESM extensions listed in boot, through an import map, with a shared-`vue` tripwire | Replaced by build-time contributions: `contributions/registry.ts:1-4,46-72` indexes a module generated at build, and the bundle enforces one copy of each singleton (`CONTEXT.md:111-114`). `index.html` has no import map on purpose (`CLAUDE.md:167-168`). No server code on either branch emits `frontend_extensions`; the list came from CRM's own `crm/www/crm.py:59-64` | **dropped correctly** (DP2, `PHILOSOPHY.md:105-121`) | `origin/desk-v2:...RecordPage/loader.ts:1-4,15-24,38-50` |
| `COMPATIBILITY.md` | 369 | The `page` compatibility policy: audiences, stable verbs and events, the no-forwarding rule, read-only returns, removals, what is not promised | Nothing. `dialog.ts:125` still tells authors "See COMPATIBILITY.md" and no such file exists on the branch | **port as prose** to `frontend/COMPATIBILITY.md` (proposal below) | `origin/desk-v2:ui/src/experimental/RecordPage/COMPATIBILITY.md` |

A tenth file is outside the ticket's nine because it is on `origin/desk-v2` only, not
on `feat/saved-view-sidebar`:

| File | Lines | What it does | Upstream | Call | Citation |
| --- | --- | --- | --- | --- | --- |
| `commitChannel.ts` + `tests/commitChannel.test.ts` | 89 + 128 | Turns a field control's commit into the event key a handler is registered under; dedupes echoes; `flush` fires a pending edit before save | Nothing. `createRecordPage.ts` upstream has no intake for a field commit. `CONTEXT.md:231-236` still defines "Commit" as the firing point of a `<fieldname>` handler | **port with its test**, when the page renders fields. CRM's host wired it at `useRecordPage.ts:169` | `origin/desk-v2:...RecordPage/commitChannel.ts:26-75` |

## Two things the ticket states that the sources do not

- COMPATIBILITY.md is 369 lines on `origin/desk-v2`, not 133. The 133-line copy is the
  `feat/saved-view-sidebar` one (commit `52d5955f0d`), which is the branch the split was
  carried from. That copy has no Save note; its events are still `refresh` and
  `before_save` (`origin/feat/saved-view-sidebar:...COMPATIBILITY.md:36-40`). The Save
  note at lines 144-146 that the header ticket (#42551) will delete is in the 369-line
  copy. That is the copy to home.
- `dialog.ts` is not byte-identical. The move rewrote comments only.
- `frontend/CLAUDE.md:40-42` says the baseline is 25 files / 428 tests. It is now 27
  files / 444 (`yarn --cwd frontend test:run` on `f31836aa21`).

## What each pre-split file's consumer was

Every dropped file had exactly one consumer, CRM's `frontend2` host, which is parked at
`/Users/shariq/crm-bench/reference/crm-frontend2` (commit `9d064a58d`):

| Pre-split file | CRM consumer |
| --- | --- |
| `loader.ts` | `frontend2/src/main.ts:31-32` |
| `usePageScripts.ts`, `commitChannel.ts` | `frontend2/src/composables/useRecordPage.ts:6,10,110,169` |
| `PageDialogs.vue` | `frontend2/src/pages/Record.vue:47,57` |

Upstream's `Record.vue:1-4` is "a minimal host for the record-page engine, with no form
layout, tabs or panel", so the same wiring has nowhere to attach yet. The calls above
say when it will.

## The dialog.ts test result

Baseline in the worktree, before any change: **27 files passed, 444 tests passed**.

Three runs of the old `dialog.test.ts` against the moved `dialog.ts`, in a worktree off
`upstream/desk-v2`, with only import paths changed
(`../../../components/FormLayout/types` became `@framework/ui/components/FormLayout/types`):

| Run | Change | Result |
| --- | --- | --- |
| A | Verbatim | `Test Files 1 failed (1)`, `Tests no tests`. `Failed to resolve import "../formDialogLayout"` |
| C | The two describes that use `formDialogLayout` removed (`form layout modes`, `mandatory checking`) | `Test Files 1 passed (1)`, `Tests 18 passed (18)` |
| B | `formDialogLayout.ts` and `formLayoutSource/section.ts` ported, imports fixed | `Test Files 1 passed (1)`, `Tests 27 passed (27)` |

Full suite with run B in place: **28 files passed, 471 tests passed**.

So the moved `dialog.ts` passes every one of its 18 own claims. The other 9 claims are
`formDialogLayout.ts`'s and pass once it is present. Run B is what this branch commits.

One more trial, not committed: `formDialog.test.ts` against a copied `PageFormDialog.vue`
with `useFormLayout` stubbed to return an empty layout and `errorMessage.ts` copied over.
Result: `Test Files 1 passed (1)`, `Tests 7 passed (7)`. The component is fine; what
blocks it is `useFormLayout`, which is the Form Layout host's, not the dialog's.

Two notes on the port itself:

- `formDialogLayout.ts` carries the pre-split comment style: five-line rationale blocks
  and an eight-line docstring (`formDialogLayout.ts:33-37,75-82`). `AGENTS.md` allows two
  lines and one summary line per docstring. The PR that lands this needs the sweep.
- `section.ts` went to `frontend/src/recordPage/formLayoutSource/`, beside `fieldAccess.ts`
  and `fieldPatch.ts`, which came from the same pre-split `FormLayoutSource/` folder.

## Where COMPATIBILITY.md lives

**Proposal: `frontend/COMPATIBILITY.md`, as prose, listed in `PHILOSOPHY.md`'s
"Relationship to other docs".**

Why the package root and not beside the engine:

- `PHILOSOPHY.md:35-47` already defines the doc set for this layer by role: `CLAUDE.md`
  is operational, `CONTEXT.md` is vocabulary, PHILOSOPHY is rules, `docs/adr/` (not yet
  written) is decisions. A promise to script authors about what survives an upgrade is
  none of those four. It is a fifth role and belongs in the same list, at the same level.
- Its audience is the Page Script author, who never opens `src/recordPage/`. The other
  three root docs say who they are for on their first lines (`PHILOSOPHY.md:8`,
  `CONTEXT.md:3-8`); this one does too (`COMPATIBILITY.md:1-15`).
- `AGENTS.md:7-10` points readers at the root docs by name. A root file is one more link
  there; a nested one is a path nobody is told about.
- `dialog.ts:125` says "See COMPATIBILITY.md" with no path. That comment should name
  `frontend/COMPATIBILITY.md` when the file lands.

Prose, not tests, because the checkable half is already tests upstream. The doc's
mechanisms each have a suite:

| COMPATIBILITY.md section | Upstream test |
| --- | --- |
| "When something is removed" (`:320-338`): tombstones, the unknown-member warning, the Error Log row, the once-per-session toast | `tests/compatibility.test.ts:56-144` |
| "The same line, outbound" (`:246-275`): every return read-only except `page.doc` and row handles | `tests/readOnly.test.ts:83-242` |
| "The line: `page` never passes your options through" (`:198-220`): a dropped key warns by name | `tests/dialog.test.ts:211-234` (ported here) |
| "How many top-level controls fit" (`:131-143`): demotion order | `tests/headerRenderings.test.ts:137-197` |

What the prose holds that a test cannot is the intent: which parts are meant to outlive
the implementation, why `page.router` is the one hand-through, why there is no version
number. That is what an author reads before writing a script, and it stays prose.

Three edits the move should make, because the text describes the pre-split tree:

1. "Start with the version reality" (`:17-27`) says the API "lives under
   `src/experimental/`, whose own README says nothing in there is production ready".
   The engine is now `frontend/src/recordPage/`, and there is no such README. The
   paragraph needs rewriting against the new location; the intent it states still holds.
2. The three audiences (`:7-15`) include "Extensions", separately built ESM loaded through
   an import map. That tier was dropped with `loader.ts` (see the table). The audience
   list becomes two: file scripts (now "contributions", `CONTEXT.md:118-123`) and Page
   Scripts. `CONTEXT.md:210-214` has the same stale phrase, "after the host's file scripts
   and app extensions", and should change with it.
3. The Save note (`:144-146`) is deleted by the header ticket, #42551, which makes `Save`
   an ordinary built-in item. Land the move first so that deletion is a one-hunk diff on
   the new file.

The header rename that `CONTEXT.md:280-284` records as settled but not implemented
(`page.headerActions` to `page.header`) touches this document in many places
(`:33`, `:84-146`). That is #42551's edit, not this one's.

## What this branch carries

- `research/record-page-leftovers.md` (this file)
- `frontend/src/recordPage/formDialogLayout.ts`, ported, imports fixed, comments untouched
- `frontend/src/recordPage/formLayoutSource/section.ts`, ported, one import fixed
- `frontend/src/recordPage/tests/dialog.test.ts`, ported, one import fixed
