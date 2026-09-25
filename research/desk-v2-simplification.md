# Desk v2 simplification: where can the same job be done with fewer concepts and less code?

Research for frappe/frappe#43383. This file decides nothing. It gives the facts for a later decision on what to cut.

- Measured at `desk-v2` commit `67b061fb88`.
- Paths are relative to the frappe repo root.
- Line counts include blank and comment lines and leave out `tests/` folders, `*.test.*` files and stories. The counting script is in the appendix.
- "Est." marks a line count that is an estimate, not a measured count.
- The open PR #43382 (the return-visit build for the record page) is not merged. It is used below only as a case study.

## Method

1. I read the engine first: `frontend/src/recordPage/createRecordPage.ts`, `paintGate.ts`, `staging.ts`, `surface.ts`, `commitChannel.ts`, `context.ts`, `registry.ts`, and `frontend/src/pages/Record.vue`.
2. Four read-only agents made concept lists for the other areas: the record page parts, the shell and list page, the parts of `ui/src` that desk v2 imports, and CRM frontend2 with desk v1.
3. Only after that, a fifth agent collected the rulings from the root map #42061, its child maps, and their closed tickets.
4. I checked the claims that the cuts depend on against the code myself.

## 1. Headline numbers

### Size

| Part | Files | Lines |
| --- | --- | --- |
| Record page engine, `frontend/src/recordPage/` | 40 | 6,041 |
| Record page parts, `frontend/src/pages/record/` | 81 | 6,098 |
| `frontend/src/pages/Record.vue` | 1 | 763 |
| **Record page total** | 122 | **12,902** |
| List page (`frontend/src/list/` and `pages/list/`) | 10 | 1,343 |
| Shell (`frontend/src/shell/`) | 19 | 1,751 |
| Router, navigation, contributions, icons | 19 | 1,342 |
| All of `frontend/src/` | 183 | 18,112 |
| Vite plugin, `frontend/plugin/` | 10 | 926 |
| `ui/src` modules desk v2 imports directly | 34 | 3,864 |
| `ui/src` modules desk v2 reaches through imports | 162 | 17,988 |
| Docs: `SCRIPTING.md`, `CONTEXT.md`, `COMPATIBILITY.md`, `PHILOSOPHY.md`, `CLAUDE.md` | 5 | 2,384 |

Of the 12,902 record page lines, 1,356 are blank and 1,311 are comments. That leaves about 10,200 lines of code. The record page has 40 `console.warn` calls and 32 checks for development builds (`import.meta.env.DEV`).

### Growth

The record page grew about three times in four weeks.

| Date | Commit | Record page lines |
| --- | --- | --- |
| 2026-08-28 | `d9994d98fa` (engine merged) | 4,172 |
| 2026-09-07 | `9ee80fb62c` | 3,454 |
| 2026-09-16 | `8875933ec5` (`page.form`) | 8,876 |
| 2026-09-22 | `a583d92a48` | 9,075 |
| 2026-09-24 | `31b8ec61ba` (tab strip, composer) | 12,596 |
| 2026-09-24 | `67b061fb88` (paints once) | 12,902 |

The latest PRs, in lines added and removed outside the tests:

| PR | What it built | Added | Removed |
| --- | --- | --- | --- |
| #43229 | Activity feed | 1,941 | 487 |
| #43247 | Email writer | 1,012 | 119 |
| #43245 | Comment writer | 1,005 | 23 |
| #43309 | Return-visit cache, in `ui/src/cache` | 962 | 31 |
| #43249 | Floating composer | 605 | 170 |
| #43321 | Record page paints once | 568 | 262 |
| #43382 (open) | Return visit for the record page | 571 | 140 |

### Where the lines go

Most lines are features, not timing code. The composer (1,400 lines), the panel (1,864), the feed (858) and the header (537 + 247) make up about 38% of the record page. The timing and race code across desk v2 is about 1,100 lines (est.):

| Area | Timing and race code | Source |
| --- | --- | --- |
| Engine: staging, paint gate, held acts | ~370 | `recordPage/paintGate.ts` (191), `staging.ts` (74), held acts in `createRecordPage.ts`, `composer.ts`, `feed.ts` (~100) |
| `Record.vue` | ~50 | the `generation`, `docinfoRead` and `inFlight` counters, `Record.vue:231-234`, `428-451`, `592-626` |
| Record page parts | ~150 | `liveDocinfo.ts`, `liveClientScripts.ts`, `metaSource.ts`, the draft upload counters, `RecordFeed.vue:102-204` |
| List, shell, router | ~275 | `list/useListSettings.ts` (~70), `CustomizeSidebarDialog.vue` (~45), `list/useListRows.ts` (~35), `router/mainPage.ts` (~30), others |
| `ui/src` | ~455 | the cache write gate and tickets (~210), the feed store queue, the pending rows, the session and meta counters, the socket rooms |

## 2. Concept inventory

A concept is something a reader of the code or a script author must learn. The "Ruling" column says in words what the issue decided.

### 2.1 What a script author learns

| Concept | What it does | Where | Ruling |
| --- | --- | --- | --- |
| `page` | The one object each handler gets. Nothing reaches a script except through it. | `recordPage/createRecordPage.ts:309-360`; `recordPage/types.ts` (613 lines) | The record-page map #42271 fixed the `page` object as an input that no ticket re-opens. |
| Handler, event vocabulary | Handlers are keyed by one of six events (`onRefresh`, `beforeSave`, `afterSave`, `onTabChange`, `onFormTabChange`, `onPost`) or by a fieldname. | `createRecordPage.ts:61-68` | The field grilling #42759 set the save order: flush, `beforeSave`, save, `afterSave`. |
| Table handlers block | `products: { onAdd, onRemove, qty }` becomes flat dotted keys. | `recordPage/flattenHandlers.ts` (73) | #42759 |
| Row handle | `page.rows('products')` returns an address that finds its row again on every access. | `recordPage/rows.ts` (243) | #42759 |
| Commit | A field handler fires when the control settles on a value, not on each key press. | `recordPage/commitChannel.ts` (90) | #42759; the field-controls map #43206 says this is "settled and not re-opened here". |
| Surface | A region of the page that scripts change with the verbs `add`, `hide`, `show`, `update`, `move`, `order`, `has`, `clear`. | `recordPage/surface.ts` (255) | The record-page map #42271 named each surface at its wrap. |
| The 12 staged overlays | `quickActions`, `frame`, `body`, `header`, `tabs`, `panelSections`, `fields`, `form`, `form.tabs`, `activity`, `files`, `composer`. | `createRecordPage.ts:192-253` | The bands grilling #42870 ruled that every place on the page is a list that takes a component item, and `before`/`after` names a neighbour. The page-model map #43265 (ruling 3) kept it. |
| Field overlay | `page.fields.update` changes a field's properties at render time only. | `recordPage/fields.ts` (251) | #42759 ruled that `page.fields` takes fieldnames only; #42872 ruled that it cannot `add`. |
| Part | A script component placed inside the Details form beside a field or section. | `recordPage/form.ts` (80), `formJoin.ts` (110) | The `page.form` ticket #42872 (built by #42876) put sections and parts on `page.form`, and moved the form's strip to `page.form.tabs`. |
| Frame band, body column | Bands above, between and below the header and body; columns beside the form and panel. | `recordPage/frame.ts` (72), `body.ts` (213) | The frame ticket #42870/#42873 and the body ticket #42890/#42891. |
| Header item, zone, container, clamp | One flat list with a `left`/`right` zone, `dropdown`/`section` containers two deep, and a budget of three controls before items move into the `⋯` menu. | `recordPage/headerRenderings.ts` (537), `drawnProps.ts` (86) | Ticket 78 (built by #42551) set the flat-list spelling. The header ownership grilling #42839 added `props`, components in both zones, `clear()`, and pinned Save. |
| Op | One recorded verb. Ops are recorded, not applied. | `surface.ts:17-23` | The page-model map #43265 (ruling 2) says a verb records an op, and the drawn list is the ops replayed over the built-ins. |
| Replay | `onRefresh`: every surface is rebuilt from built-ins and every source runs again, so a condition is a plain `if` with no `else`. | `paintGate.ts:60-114` | #43265 ruling 2 |
| Hold | Every handler other than `onRefresh` draws its ops once, when it finishes. | `paintGate.ts:152-163` | #43265 ruling 6; built by #43266. |
| Act | A one-time move: `tabs.activate`, `form.tabs.activate`, `panelSections.open/close`, `fields.focus`, `activity.scrollTo`, `composer.open`. It waits until the replay or hold commits. | `createRecordPage.ts:262-589`; `composer.ts:68-91`; `feed.ts:133-168` | The panel grilling #42568 (decision 8) ruled that `open` and `close` are held until the replay commits, like `tabs.activate`, and are never remembered as the reader's choice. |
| Slow-script limit | The first paint waits at most 500 ms for scripts. After that it paints without any source still running and names the late one in the console. | `paintGate.ts:8-9`, `123-150` | #43266 set the 500 ms limit and ruled that the early paint leaves out every running source. |
| Source, run order, tier | Each script is a source. Sources run in order: file scripts, extensions, then the stored Client Script tier. | `recordPage/registry.ts` (60), `context.ts` (33), `clientScripts.ts` (179) | The Client Script ticket #42548 added a `Record` view and `run_order` to `Client Script`, with no new DocType. |
| Live script change | A clean page runs its scripts again when a Client Script changes on the server. | `pages/record/liveClientScripts.ts` (36) | #42893 |
| Read-only view | Every object `page` hands back refuses writes and names the verb to use instead. | `recordPage/readOnly.ts` (108); advice text at `createRecordPage.ts:70-92` | `frontend/CONTEXT.md` "Read-only view". I found no ticket for it. |
| Tombstone | A removed `page` member throws and names its replacement for one major. | `recordPage/pageCompatibility.ts` (109). The list of removals is empty (`:19`). | #42555 made `frontend/COMPATIBILITY.md` the promise to script authors. |
| `page.dialog` | `confirm`, `danger`, `open`, `form`. | `recordPage/dialog.ts` (264), `formDialogLayout.ts` (193), `pages/record/dialogs/` (281) | #42550/#42555 ported the dialog layout; #42759 (decision 12) made the doctype mode use `Quick Entry`. |
| Customization error log | A handler that throws writes an Error Log row. | `recordPage/reportError.ts` (85) | #42919 (the customization error endpoint) |

Two more concepts are ruled but not built. The return-visit rulings #43280 add `onOpen(page)` (rule 10, build #43360) and `page.cached(key, fetcher)` (rule 4, build #43361).

### 2.2 What a reader of the code learns

| Concept | What it does | Where | Ruling |
| --- | --- | --- | --- |
| Paint gate | Decides when the page paints: the first replay, holds, and the early paint. | `recordPage/paintGate.ts` (191) | #43265 ruling 1 and #43266 |
| Staging | Each overlay keeps a buffer that replays and holds write into, published in one splice on the last commit. | `recordPage/staging.ts` (74) | #43266. The page-model map #43265 left the move of this code out of `recordPage/` for later. |
| Running source | Two records of "who is running": a module global (`context.ts:5-33`) for op attribution, and a list in the paint gate (`paintGate.ts:52`, `165-173`) for the early paint. | as listed | #43266 (the early paint leaves out running sources) |
| Controller and host | `createRecordPage` takes a host with 30 members and returns a controller with 21. | `createRecordPage.ts:102-189` | none found |
| `actionsVersion` | A counter `Record.vue` bumps by hand so computed values read the surfaces again. | `Record.vue:209`, `252-281`, `586`, `625` | none found |
| Visit guards | `generation`, `docinfoRead`, `inFlight`, `whileOnRecord`, `toggleTurn` drop answers that arrive after the reader moved on. | `Record.vue:231-234`, `383-431`, `444-451`, `592-608`; `recordFeeds.ts:75`, `134-168`; `panel/peopleActions.ts:21-27` | none found |
| Docinfo | The record's side data (people, tags, rights, files). It is written in four ways. | `recordSource.ts:19-23`, `panel/peopleActions.ts:44-47`, `feed/recordFeeds.ts:165-168`, `liveDocinfo.ts:126-139` | The live docinfo ticket #42765 ruled that the page joins the record's socket room and applies each `docinfo_update`. |
| Feed store (`RecordFeeds`) | One class with the composer band height, the upload flag, the activity handle, the `?activity=` pointer, file rows and the prefetch. | `pages/record/feed/recordFeeds.ts` (246) | The return-visit rulings #43280 (rule 5) tie the feed store's life to the cache entry. |
| Disclosure, section memory | A section's open or shut state, kept in the browser per user and doctype. | `pages/record/panel/disclosure.ts` (69), `navigation/sectionMemory.ts` (82) | #42568 (decision 10) rejected User Settings; the sidebar ticket #42467 ruled that the reader's toggle beats what the app shipped. |
| Form tab memory | The last Details tab, per user and doctype, in the browser. | `pages/record/formTabMemory.ts` (42) | #42759 (decision 10) |
| Column store | Body column width and collapse, per user. | `pages/record/body/columnStore.ts` (44) | #42890 |
| Composer store | One open writer across records, with drafts, docks and two browser keys. | `shell/composer.ts` (216), `shell/ComposerWindow.vue` (211) | The comment and email composer tickets, merged as #43245 and #43249. |
| Return-visit cache | An in-memory copy of each document and list query, with a write gate that orders replies. | `ui/src/cache/` (651), `ui/src/api/feed.ts` (61) | The return-visit map #43276 ruled that a return visit paints cached data and then fetches again quietly. The cache-shape ticket #43278 ruled one cache entry per document. |
| Pending rows | A comment or email shows before the server confirms it, drawn muted. | `ui/src/components/ActivityTimeline/pendingRows.ts` (208) | #43229 (activity feed) |

### 2.3 Other areas, in short

The shell, list and router agents found 31 concepts. The ones that matter for cuts:

- **Panel continuity.** It picks the open sidebar from four inputs in order: `?sidebar=`, the history entry, the open panel, and the tab's memory (`shell/AppShell.vue:119-189`, `navigation/current.ts`, `navigation/sidebarMemory.ts`). The sidebar tickets #42464 and #42480 ruled that the reader keeps the panel they are in.
- **Two memories of "where I was" on the list.** `list/pageState.ts:1-19` (the history entry) and `pageState.ts:21-48` (a module map) hold almost the same thing.
- **Clash checks.** Page clashes are checked at build time (`plugin/pageClashes.js`, `plugin/replacements.js:31-49`) and again at run time (`router/contributed.ts:23-52`, `contributions/registry.ts:116-135`).
- **Dead exports.** `resolveDoctype` (`router/index.ts:141-147`) has no callers. `currentNavigation` (`navigation/current.ts:119-128`) and `forgetRows` (`list/pageState.ts:46-48`) are used only by tests.

## 3. Guarantee inventory

A guarantee is a promise the code keeps. The "Code that exists only for it" column counts the lines that would go if the promise went.

| Guarantee | Code that exists only for it | Lines | Ruling |
| --- | --- | --- | --- |
| One paint on a cold load | The paint gate, the staging buffer, the replay's two passes (`paintGate.ts:73-114`) | ~265 | #43265 ruling 1. #43266 measured it: before the change, all 220 cold loads drew 2 paints; after it, 1. |
| One paint per handler, even an async one | `hold` (`paintGate.ts:152-163`), `beginHold` (`staging.ts:28-32`), the commit depth count | ~30 | #43265 ruling 6 |
| A slow script cannot hold the page longer than 500 ms | `paintWithoutLate`, `releaseEarlyActs`, `lateWait`, `asSource` and the running list, `publishStaged` in `staging.ts` and `feed.ts`, `clientScriptWait` | ~75 | #43266 |
| No handler is split across two paints | The running-source list and the `except` filter (`paintGate.ts:52`, `126-129`, `165-173`) | ~20 | #43266 (from a Greptile P1 finding) |
| An act lands on what the reader sees, after the commit | Five held-act stores and their release and warn code (`createRecordPage.ts:262-289`, `362-368`, `397-403`, `439-448`, `499-510`; `composer.ts:44-91`; `feed.ts:133-168`) | ~100 | #42568 decision 8 |
| An act dropped at the early paint says why | `drawnOnly`, `NOT_DRAWN` and the re-checks "it left … before the replay settled" | ~20 | #43266 |
| A script's act is never the reader's memory | The `acts` map in `disclosure.ts:35`, `57-66` | ~10 | #42568 decision 10, #42752 |
| A field handler fires once per settled value | `pending`, `settled` and the echo check (`commitChannel.ts:28-62`) | ~35 | #42759 |
| `beforeSave` sees the last edit, even in a focused input | `flush` and the `running` set (`commitChannel.ts:30-47`, `70-78`) | ~15 | #42759 decision 4 |
| A save never goes to the wrong record | `generation`, `inFlight` and the name check (`Record.vue:592-626`) | ~30 | none found |
| A script cannot write `meta`, `perms`, `roles` or `saved` | `readOnly.ts` and the advice text | ~130 | none found; `CONTEXT.md` states it |
| A removed `page` name tells the author what replaced it | `pageCompatibility.ts`, with an empty list | 109 | #42555 |
| The panel shows other tabs' assign and comment changes | `liveDocinfo.ts` (139), plus `ActivityTimeline/liveUpdates.ts` (224) on the same room | ~360 | #42765 |
| (PR #43382) No skeleton and one paint on a return visit | The cache (`ui/src/cache`, 651), the ticket feed (`api/feed.ts`, 61; `request.ts:39-63`, `87-97`), and the PR's 571 lines | ~1,300 | The return-visit map #43276 and its rulings #43280 (rules 1-3) |
| (PR #43382) Background reads land in one replay | `applyInBackground`, `backgroundReads`, `docinfoLanding`, the kept feed read (`Record.vue` in the PR; `recordFeeds.ts` +25; `timelineStore.ts` +17; `useActivityTimeline.ts` +27) | ~150 (est.) | #43280 rule 7 |
| (PR #43382) A synchronous replay commits in the task that started it | `recordPage/steps.ts` (48) and its callers | ~80 (est.) | none. It exists because `onRefresh` may still be async; #43280 rule 4 rules it synchronous. |
| One copy of data | Nothing today. On `desk-v2`, nothing reads the cache: the record page imports only the constant `RECORD_PARTS` from it (`pages/record/recordSource.ts:2`). The reader comes with PR #43382 (`readCachedRecord`). | n/a | #43276 ruling 2, #43278 |

## 4. Comparison with CRM frontend2 and desk v1

### Sizes

| System | Record page | Script engine | Data layer |
| --- | --- | --- | --- |
| Desk v2 (`desk-v2` `67b061fb88`) | 6,861 (`pages/record/` and `Record.vue`) | 6,041 (`recordPage/`) | in `ui/src`: api ~600, cache 651, feed store 417 |
| CRM frontend2 (`feat/crm-frontend2` `9d064a58d`) | 2,735 (`Record.vue` 102, `components/record/**`) plus 858 in composables | 4,659 (an older copy of this engine in `ui/src/experimental/RecordPage/` on frappe branch `feat/saved-view-sidebar`) | 1,016 for the record; `src/data/` 1,704 |
| Desk v1 (`frappe/public/js/frappe/form/`) | `form.js` 2,716, `layout.js` 897, `save.js` 376, `views/formview.js` 159 | `script_manager.js` 305 | `model/model.js` 945, `sync.js` 273 |

The whole v1 `form/` folder is 29,116 lines, but most of it is field controls and grids. Desk v2 keeps those in `ui/src`.

CRM frontend2 does not build against `desk-v2` today. It imports the engine from `@framework/ui/experimental`, and on `desk-v2` that folder holds only `List/` (`frontend2/vite.config.js:41-43`).

### Form scripts

| | Desk v2 | CRM frontend2 | Desk v1 |
| --- | --- | --- | --- |
| How a script changes the page | It records ops; a replay draws them over built-ins. | The same model (older engine). | It calls imperative methods; `refresh_header` clears the buttons first (`form.js:1863-1867`, called at `:904`). |
| Async handler | Allowed. Each is awaited in order (`createRecordPage.ts:603-638`). | Allowed and awaited ([fw] `createRecordPage.ts:415-446`). | Allowed. A returned promise is awaited before the next handler (`script_manager.js:125-131`). Nothing waits for the whole chain. |
| A handler throws | Logged and reported; the others still run. | The same. | Rethrown; the handlers after it do not run (`script_manager.js:28-35`). |
| A Client Script changes | A clean page runs its scripts again. | The same (Page Scripts). | Needs a page reload. |

### First paint

| | Desk v2 | CRM frontend2 | Desk v1 |
| --- | --- | --- | --- |
| Paints before handlers settle? | No. The page waits for the first replay, up to 500 ms (`paintGate.ts:8-9`). | Yes. Only the tab strip waits for the first replay (`RecordTabs.vue:92-97`). | Yes. Fields render, then `refresh` handlers run (`form.js:633-634`). |
| Paints on a cold load | 1 | 2 or more: the document, then the replay; built-in actions show first and script actions after. | 1, after `getdoc` returns. The old page stays on screen during the fetch. |
| Return visit | Cold path today. PR #43382: 1 paint, no skeleton. | Paints from a 5-minute cache, then fetches again and paints again, with a replay each time (`data/cache/queryCache.ts:66-77`). | Paints from `locals` only if the doc is less than 5 seconds old (`formview.js:88-98`); otherwise a full fetch. |

### Data refresh

| | Desk v2 | CRM frontend2 | Desk v1 |
| --- | --- | --- | --- |
| Copies of the document | `doc` (draft) and `saved` (baseline); PR #43382 adds the cache entry. | Cache entry, resource data, and `doc`/`stored`. | One: `frm.doc` is the `locals` entry (`form.js:423`). |
| Another user edits a field | Nothing today. PR #43382 re-reads on a return visit only. | Nothing; there is no `doc_update` listener. | `doc_update` reloads a clean form, or warns on a dirty one (`model.js:154-182`). |
| Side data (`docinfo`) | Socket deltas, re-reads for bursts, reconnect repair (`liveDocinfo.ts`). | Socket deltas and re-reads (`useDocinfo.ts:58-105`). | Every response goes through `frappe.model.sync` into one store (`sync.js:6-46`). |

### What the others give up

- **Desk v1** is simpler because it records nothing and replays nothing, and every response writes into one shared store. It gives up: script buttons pop in after an async handler, one throwing handler stops the rest, a script change needs a reload, and the old page stays on screen while the new one loads.
- **CRM frontend2** is simpler because it paints each source when it lands and never waits for handlers or merges sources. It gives up: two or more paints per visit, script actions that appear after the built-ins, and no live update of fields changed by others.
- **Desk v2** pays for "one paint" with the paint gate, staging and held acts (about 370 lines), and for "one paint on return" with the cache and the background merge (about 1,300 lines with the PR).

## 5. Candidate cuts

Each cut says what goes, the lines, the concepts, what a user or script author loses, and which ruling it re-opens. They are sorted by lines removed per ruling re-opened. A cut that re-opens no ruling comes first, largest first.

| # | Cut | Lines removed | Concepts removed | What is lost | Ruling re-opened | Lines per ruling |
| --- | --- | --- | --- | --- | --- | --- |
| C1 | Build the synchronous `onRefresh` (#43361) before the return-visit work, and remove the async-only paths. The early paint then becomes "replay without the late Client Script tier, and replay again when it lands". | ~70 on `desk-v2` (est.); ~100 of PR #43382 not needed (`steps.ts` and the paint-gate additions) | running source list, `publishStaged`, the early-paint act rules | An `await` in `onRefresh`. The rulings already took it away. | none. #43280 rule 4 already rules `onRefresh` synchronous. | no ruling |
| C2 | Merge the comment and email writer pipelines. They repeat `restore`, `reopen`, the pending row, the draft upload counter, the draft merge and the author object (`commentPost.ts:84-99` against `emailPost.ts:102-117`; `useCommentDraft.ts:9-43` against `useEmailDraft.ts:11-68`). | ~120 (est.) of 1,019 | one of two writer pipelines | nothing | none | no ruling |
| C3 | Delete `pageCompatibility.ts` until the first `page` member is removed. The list of removals is empty (`pageCompatibility.ts:19`). Keep the rule in `COMPATIBILITY.md`. | 109 | tombstone | nothing today | none, if the rule text stays | no ruling |
| C4 | Replace the five held-act stores with one queue of closures that runs after the last commit and re-checks its target. | ~75 (est.) | "held activation", "held disclosure", "held focus", "held scroll", "held open" become one rule: acts wait for the commit | nothing | none | no ruling |
| C5 | One listener per record room: merge `pages/record/liveDocinfo.ts` and `ui/.../ActivityTimeline/liveUpdates.ts`. Also remove the second reconnect handler: `ui/src/socket.ts:80-84` and `frontend/src/shell/socket.ts:15-18` both rejoin every room on `connect`, so each room is joined twice after a reconnect. | ~55 (est.) | one of two live paths | nothing | none. #42765 ruled on behaviour, not on two listeners. | no ruling |
| C6 | One per-user browser memory helper for `formTabMemory.ts`, `body/columnStore.ts`, `navigation/sectionMemory.ts:19-36` and `shell/composer.ts:88-110`. | ~80 (est.) | four storage helpers become one | nothing | none | no ruling |
| C7 | One visit guard (an `AbortController` or a visit token) in place of `generation`, `docinfoRead`, `inFlight`, `whileOnRecord` and `toggleTurn`. | ~50 (est.) | five guards become one | nothing | none | no ruling |
| C8 | Remove dead and test-only code: `resolveDoctype`, `currentNavigation`, `forgetRows`, the unused `scope` in `arrangement.ts`, the second latest-wins loader in `useFormLayout.ts:127-162`. | ~65 (est.) | none | nothing | none | no ruling |
| C9 | Apply each background read of a return visit when it lands, with an ordinary replay. The commit already skips a publish when the ops did not change (`staging.ts:68-73`). | ~150 of PR #43382 (est.) | "the gather", the kept feed read, `docinfoLanding` | When two sources changed, the reader can see two small updates a moment apart instead of one. | #43280 rule 7: one replay after all background reads. | ~150 |
| C10 | Drop nested header containers: keep `dropdown`, drop `section` and the depth-2 clamp. | ~150 of 537 (est.) | container, clamp, band heading | A script cannot put a titled section inside a menu. | #42839, header ownership | ~150 |
| C11 | Use Vue's `readonly()` for `meta`, `perms`, `roles`, `saved`. | ~110 | read-only view with advice | The error no longer names the verb to use. | The "Read-only view" rule in `CONTEXT.md`. It sits with the `page` object that #42271 fixed. | ~110 |
| C12 | Drop the 500 ms early paint: always wait for the Client Script tier, and paint without it only if the fetch fails. | ~90 (est.) | slow-script limit, early paint, `drawnOnly` | A slow tier fetch holds the skeleton longer. | #43266, the slow-script limit | ~90 |
| C13 | Panel continuity from two inputs only: the address and the history entry. Drop `sidebarMemory.ts` and the share-link rule. | ~100 (est.) | sidebar memory, share link | A new tab at a bare address does not remember the last panel. | #42464 and #42480 | ~50 |
| C14 | Acts only from `onOpen` and holds, never from `onRefresh`. | ~30 (est.) after C4 | acts inside a replay | A script cannot move the reader from `onRefresh`. | #42568 decision 8 and #43280 rule 9 | ~15 |
| C15 | Delete the return-visit cache and the builds planned on it (#43357 to #43362). | 849 on `desk-v2`, 571 in PR #43382, plus the planned builds | cache entry, ticket, write gate, return visit, background replay, `onOpen`, `page.cached` | A return visit shows skeletons again (2 per step instead of 0, as the PR's walk measured). The map exists to stop that. | The return-visit map #43276, the cache-shape ticket #43278, and the rules in #43280 | ~470 |

C15 has a high ratio, but it removes the feature that the whole return-visit map was set up to build. It does not do "the same job", so I do not recommend it. The list and the record page would still have to agree on one copy of the data some other way.

## 6. Observations found on the way

- **The running source can be wrong when handlers overlap.** `withRunningSource` (`recordPage/context.ts:25-33`) sets a module variable and restores the old value when the work settles. If handler A awaits, then handler B starts and awaits, and then A finishes, A restores the value to what it was before A. B then records its next ops as `host`. The early paint filters by source (`paintGate.ts:126-129`), so B's ops can be drawn while B is still running. PR #43382 changes `context.ts`, but it keeps the same restore order. I did not reproduce this on a site. C1 makes it rarer, because replays can then no longer overlap, but async holds still can.
- **The cache has no reader on `desk-v2`.** Every request pays for the ticket and the write gate (`ui/src/api/request.ts:39-63`, `87-97`). Until PR #43382 merges, nothing reads the entries.
- **The return-visit rulings add two concepts.** #43280 adds `onOpen` and `page.cached`. C1 can be done without `page.cached`: a script that needs server data can fetch it in `onOpen`, store it, and call `page.refresh()`.
- **Where the PR's review rounds came from.** The four review rounds of PR #43382 added guards for these cases: a replay still open when the background reads land (rounds 1 and 3), a docinfo read replaced by a newer one (rounds 2 and 4), and a feed read that must end after the gather (round 2). These are the costs of #43280 rule 7 (C9) and of an async `onRefresh` (C1).

## 7. The top five cuts

1. **Make `onRefresh` synchronous before the next return-visit build (C1).** The rulings already decided this (#43280 rule 4), but the build (#43361) is scheduled after the return-visit work. Doing it first removes about 70 lines on `desk-v2` and about 100 lines that PR #43382 needs only because a replay may be async. It re-opens no ruling.
2. **Apply each background read as it lands (C9).** This removes about 150 lines of PR #43382 and the timing cases its review rounds kept finding. The cost is that two changed sources can show as two quick updates instead of one. It re-opens one ruling: #43280 rule 7, which asks for a single replay after all background reads.
3. **One act queue (C4).** Five stores for held acts, with five release functions, become one queue that runs after the commit. It removes about 75 lines and five names, and it changes nothing a script author sees. It re-opens no ruling.
4. **Merge the comment and email writers (C2).** The two pipelines repeat restore, reopen, pending rows, upload counters and draft merging. Merging them removes about 120 lines, and a third writer would then cost less. It re-opens no ruling.
5. **Delete the empty tombstone machinery (C3).** `pageCompatibility.ts` is 109 lines that wrap `page` for a list of removals that is empty. Keep the rule in `COMPATIBILITY.md` and write the code when the first member is removed. It re-opens no ruling.

Together these five remove about 525 lines (est.) and seven named concepts. Four of them re-open no ruling. The next cuts to look at are C5 to C8, which are also free of rulings and remove about 250 lines together.

## 8. What I could not measure

- **Exact line savings for most cuts.** Only C3 and C15 are exact counts. The others are estimates from line ranges. A real count needs the change to be made.
- **Paint counts and timing.** I did not run the site. The paint numbers come from #43266 (220 cold loads) and from the walk recorded on PR #43382.
- **The overlapping-handler defect** in section 6 is a reading of the code, not a reproduction.
- **CRM frontend2's engine** is an older copy on the frappe branch `feat/saved-view-sidebar`, not the one on `desk-v2`. Its sizes compare two versions of one design, not two designs.
- **Users of `ui/src` outside desk v2.** About 9,100 lines of `ui/src` are not reached from `frontend/src` (ConditionBuilder, DataImport and others). Other apps may use them, so I made no cut there.
- **PR numbers for the record page parts.** Most of those files came in through squashed or direct commits, so the agents could give commit hashes but not issue numbers. The rulings are tied to them by name instead.

## Appendix: the counting script

```bash
# Non-test lines of .ts, .vue and .js files under each path.
for p in "$@"; do
  files=$(find $p -type f \( -name '*.ts' -o -name '*.vue' -o -name '*.js' \) \
    ! -path '*/tests/*' ! -name '*.test.*' ! -name '*.spec.*' ! -path '*/node_modules/*')
  printf "%s %s files %s lines\n" "$p" "$(echo "$files" | grep -c .)" \
    "$(echo "$files" | xargs cat | wc -l)"
done
```
