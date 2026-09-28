# The desk v2 report: today's code against security, user experience, speed and simplicity

Research for frappe/frappe#43431, a child of the map "Desk v2: the architecture" (#43426). That map exists because each ticket so far looked at its own feature and nothing looked at the whole desk.

**This file decides nothing.** It gathers four research files and the earlier simplification study into one read, ranks the cuts, and proposes budgets and a draft layer list. The rulings happen on the target-architecture ticket (#43432) and the guardrails ticket (#43433).

- Code: `upstream/desk-v2` at `6352fefbdf`, the merge of the record page's return-visit build (PR #43382). The security, speed, structure and user experience research measured this same commit. The simplification study measured the older `67b061fb88`; this report checked its 15 cuts again at `6352fefbdf`.
- Paths are from the frappe repo root. "Est." marks an estimate.
- It follows the map's fixed inputs. The program principles are not re-opened: the three authored tiers (app, site, per-user), one UI API that drives every surface by name, UI-first customization over scripting, REST API v2 only, and the rule that `ui/` holds code any app can use while `frontend/` holds desk v2's own code.
- Goals are weighed in the map's order. Security is never traded. User experience comes next. Speed is a budget, not a maximum: once a page meets its budget, simpler code wins. Simple means few concepts, not few lines: few names to learn, one way per job, few files per flow, no layer that uses a layer above it, and few places where the code must reason about the order of async events ("timing guards"). Lines are given only as a sign of size.

## 1. Summary

### State of each goal

| Goal | State |
| --- | --- |
| Security | Sound at the core. 66 ways in were checked; none lets one user reach another user's rows, and nobody below System Manager can put code into another user's browser. Four medium gaps leak data to people outside the desk; each has a fix of a few lines. |
| User experience | Faster to show something than desk v1 on a normal network (0.3 s against 1.2 s for a cold record). Weak on a slow network: a white page for up to 73 s, and a click that shows nothing for 26 s. A save confirms nothing, a bad field is not marked, and eight events look different from page to page. |
| Speed | Inside budget on most pages: a cold record is usable in 681 ms on a 4x slower CPU, against 998 ms for desk v1, and the server takes under 20 ms per call. Three candidate budgets fail, each for one reason: the editor loads to show saved comments, a drag library loads before a panel opens, and list and home returns are not cached. |
| Simplicity | The weak goal. The record page grew from 4,172 to about 13,300 lines in a month. A reader meets well over 100 names outside the record page and about 45 inside it, 10 pairs of mechanisms that do one job, 5 layer breaks, one loop of 13 folders that import each other, and about 40 timing mechanisms outside the record page alone. Opening a record passes through 110 files. |

### Must-fix security list

| ID | Gap | Smallest fix |
| --- | --- | --- |
| M1 | The email body is parsed into the live page before it goes into the sandboxed frame (`ui/src/components/ActivityTimeline/utils.ts:111-112`). | Parse with `DOMParser` and strip active content from that one document. |
| M2 | A signed-in Website User gets every site default from the v2 session route (`frappe/sessions.py:233,247`). | Send defaults only to System Users. |
| M3 | A signed-out visitor can list DocType names through the v2 link search (`frappe/api/v2.py:239`). | Refuse Guest in the route. |
| M4 | The attach route returns a record's attachment list with no read check (`frappe/api/files.py:48`). | Check read before building the answer. |

### Top ten cuts

Ranked by what a reader no longer has to learn. Section 6 has the full list: 31 cuts, plus 2 marked not recommended, with the ruling each re-opens.

| Rank | Cut | Removes | Ruling re-opened | Owning map |
| --- | --- | --- | --- | --- |
| 1 | One way to drop a reply that came too late | 9 guard names in `Record.vue` become 1; 11 hand-written counters across the desk become one helper | none | One page model (#43265) for the record page; no open map for the rest |
| 2 | Drop the list half of the data cache, which nothing reads, and the currency lookup's own map | 5 concepts, 5 timing guards, 2 duplicate memories | the return-visit map's plan for lists | Return visits paint at once (#43276) |
| 3 | Finish the synchronous `onRefresh`: drop the late-part path | 5 concepts, 4 timing guards; closes a wrong-source gap | return-visit rule 4 as the user amended it on 2026-09-25 | One page model (#43265) |
| 4 | One queue for held acts | 5 stores become 1; 10 timing branches become 2 | none | One page model (#43265) |
| 5 | The shell stops importing pages | 5 layer breaks become 0; 2 setter points; one loop of the 13-folder cycle | none known | Build and publishing (#43085) and the activity column (#42758) |
| 6 | One live path per record room | 2 listeners and 2 reconnect handlers become 1 each; 2 guards | none | Activity column (#42758) |
| 7 | Apply each background read when it lands | 3 concepts, 3 timing guards | return-visit rule 7 | Return visits paint at once (#43276) |
| 8 | The route table by registration: the router stops importing pages | the 13-folder cycle; standard pages and page replacements become one mechanism | none known | none open |
| 9 | One save path | 3 pairs: two de-duplications, two "saving" states, a keyboard save that skips the paint hold | none | One page model (#43265) |
| 10 | Delete dead and test-only code | 9 names, 1 repeated counter | none | none single; one small task |

## 2. Security

Source: the security research, which listed every way into desk v2 and the check at each one (#43427). It was measured at `6352fefbdf`, the same commit as this report.

### What it found

| Measure | Result |
| --- | --- |
| Doors listed (routes, boot data, stored scripts, caches, realtime messages, HTML sinks) | 66 |
| High gaps | 0 |
| Medium gaps | 4 |
| Low gaps | 11 |
| Can one user read or write another user's own rows (favourites, list views, rail, sidebar)? | No. Every desk v2 method takes the user from the session, and the DocType rules limit rows to their owner. Checked live. |
| Can someone who is not a System Manager put code into another user's browser? | No. There is no per-user script tier, and the list of importable modules is fixed at build time. |
| Stored scripts compared with desk v1 | Narrower: the same people write them, the text now needs read on the DocType, and it runs on fewer pages. |
| Boot data compared with desk v1 | Narrower for desk users. Wider for Website Users (gap M2). |

What it means for the desk: the model is sound. All four medium gaps are leaks to people outside the desk (signed-out visitors, portal users, email senders), and each has a small fix in one place. Three of the four came in with the move to REST API v2, so a v2 route should get the same "who may call this" test that its v1 twin had.

### Must-fix list

Security is never traded, so these four are not ranked against cuts. Each is a class of problem and a place, with the smallest fix the research found.

| ID | Class of problem | Where | Smallest fix | Area and owning map |
| --- | --- | --- | --- | --- |
| M1 | Untrusted HTML is parsed into the live page before it reaches the sandbox. The email body goes into an element of the real page to strip colours, and only then into the sandboxed frame. At that first step the only barrier is the server's HTML sanitiser. | The colour-stripping helper at `ui/src/components/ActivityTimeline/utils.ts:111-112`, first called from `EmailContent.vue:29`. It came with the activity timeline component, PR #40216. | Parse with `DOMParser`, which runs nothing, and do every stripping step on that one parsed document. | Activity feed in `ui/`. Owner: the activity column map (#42758, open). |
| M2 | Too much data to a lower role. A signed-in Website User (a portal customer or supplier) gets every site default from the session route, about 97 keys, including login and password policy settings. Desk v1 gives such a user 8 formatting keys. | The session block at `frappe/sessions.py:233,247`, served by the v2 session route at `frappe/api/v2.py:94`. It came with the move of session and boot data to REST API v2, PR #43019. | Send defaults only to System Users, as the Guest case already does. Add a Website User test next to the Guest test. | Server API. The map that made it, REST API v2 everywhere (#42920), is closed. No open map owns it. |
| M3 | A signed-out visitor can list DocType names and modules. The v2 link search skips permission checks when the searched DocType is DocType. Desk v1's search refuses Guest; checked live, v2 answered 200 and v1 answered 403. | The v2 search route at `frappe/api/v2.py:239`, which calls `frappe/desk/search.py:303`. It came with the move of lists to v2, PR #43002. | Refuse Guest at the top of the route. | Server API. No open map (REST API v2 everywhere, #42920, is closed). |
| M4 | A read with no read check. The attach route returns the record's whole attachment list and owner names after an upload, without checking read on the record. When guest uploads are on (off by default), a Guest also skips the write check. | The attach answer at `frappe/api/files.py:48`. It came with the move of file upload to v2 routes, PR #43080. | Check read on the record before building the answer, or return only the new File. | Server API. No open map (REST API v2 everywhere, #42920, is closed). |

### Low gaps, for the same pass

The research found 11 low gaps. Seven have a fix of a few lines and could ride with the must-fix pass. The other four need only a note.

| ID | Class of problem, in short | Where | Smallest fix |
| --- | --- | --- | --- |
| L1 | A navigation link URL has no scheme check. Only a System Manager or an app can set it. | `frappe/desk/doctype/navigation_item/navigation_item.py:41` | Accept only http(s) or a path starting with `/`. |
| L2 | An Attach field value opens in a new window with no scheme check; any writer of the record sets it. | `ui/src/components/Fields/AttachField.vue:167` | Open only http(s); reject other schemes on the server. |
| L4 | The code and HTML preview keeps `<style>` and `<form>`, so a field value can restyle the page or draw a fake form. No script runs. | `ui/src/components/Fields/CodePreview.vue:33,36` | Forbid those tags in the sanitiser call. |
| L6 | Two new document methods (resend an invitation, start a data import) need only read through v1's method route. No effect today. | `user_invitation.py:71`, `data_import.py:150` | Check write at the top of each. |
| L7 | Any signed-in user, Website Users included, can write Error Log rows that look like script failures, 30 a minute. | `frappe/desk/customization_error.py:27-80` | Require a System User. |
| L8 | File scripts from an app that is disabled on this site still run. Stored scripts and page replacements already skip it. | `frontend/src/contributions/registry.ts:68-88` | Skip a contribution whose app is not active, as `:119` already does for replacements. |
| L9 | A Website User gets the shell page at `/apps` and then an empty shell, not a 403. | `frappe/website/page_renderers/shell_page.py:63-65` | Run the prefix guard for everyone on the index. |
| L3 | Every reader of a record sees who favourited it, while the Favourite DocType limits rows to their owner. The favourite star PR (#42777) chose this on purpose. | `favourite.py:32-40,90-97` | A ruling: document it, or return only the caller's row. |
| L5 | A navigation "Record" item checks read on its DocType only, not the record's User Permissions. | `navigation_filter.py:63-77` | Check each Record item, or document the rule. |
| L10 | Any desk user gets every app and DocType name. Desk v1 sends more of this kind. | `boot.py:43,47`, `doctypes.py:129-143` | None; note it. |
| L11 | v2 has no impersonation marker, so an admin acting as someone sees no reminder; the sidebar memory is not keyed by user. | `frappe/sessions.py:226`, `frontend/src/navigation/sidebarMemory.ts:4` | Add `impersonated_by` and a banner; key the memory by user. |

### What a cut must not do

A cut in section 6 is marked "not recommended" if it would open one of these doors again:

- Move a permission check from the server to the browser.
- Put per-user data in a cache that outlives a user change.
- Parse untrusted HTML in the live page, or add a `v-html` without the sanitiser.
- Let a route answer before its read check.

## 3. User experience

Source: the user experience walk, which recorded what a person sees while each page loads, fails and saves (#43430). It walked `6352fefbdf` on a normal network, on Chrome's old "Slow 3G" numbers (400 ms latency, 400 kbit/s) and offline. It compared desk v1's form and CRM's current Vue UI.

### What it found

| Moment | What the person sees today | Cause in the code |
| --- | --- | --- |
| Cold load, slow network | A white page for 32 s (home), 44 s (list), 73 s (record). No shell, no spinner. | The rail and sidebar do not draw until the page's own code has downloaded. |
| Click to another page, slow network | The old page stays with no sign the click did anything: 6.5 s from home to a list, 26 s from a list to a record. | The router waits for the next page's code before it changes the page: `router.beforeResolve` calling `preloadMainPage` at `frontend/src/router/index.ts:74`. |
| Cold list or record | The content draws at full width, then the sidebar (224 px) mounts and pushes it right. Layout shift 0.19 on the list, 0.17 on the record; Chrome calls above 0.1 "poor". | The sidebar column mounts after the page. |
| First quick filter | About 1 s of nothing, then the rows go, one skeleton frame, then results. Layout shift 0.60: a quick filter moves into the overflow menu beside the input being typed in. | A 300 ms plus 500 ms wait; the filter row reflows when a filter is set. |
| Return to a list or home | A skeleton on every return (0.45 s on the slow network). | Only the record page reads the return-visit cache. Home clears its tiles before each fetch (`frontend/src/contents.ts:42-68`). |
| Return to a record | Painted at once from memory, no skeleton. | The return-visit build, PR #43382. |
| Save | A spinner on the Save button, then it greys out. No toast, no "Saved". Focus drops to the page body. | |
| Save with a validation error | A toast with the server's text. The field is not marked. The edit is kept. | A required field is not checked before the request. |
| List the person may not read | Red text with `<strong>` tags shown as text, and a count skeleton that never ends. | `frontend/src/pages/list/DoctypeList.vue:48-50` shows the raw message. |
| Offline | The list throws its rows away and shows "TypeError: Failed to fetch", with no retry. A save shows the same text as a toast. | |
| Keyboard | The record panel's field values cannot be reached by Tab (each is a `div` with `tabindex=-1`). 14 shell Tab stops come before page content in CRM, 228 in the framework app. No skip link. Focus is not moved after a page change. The only shortcut is Ctrl/Cmd+S. | |
| Tab title | Every page is "Frappe". | `frontend/index.html:23` sets it and nothing changes it. |

The walk also found eight places where one event looks or behaves differently on two pages:

| Event | One page | Another page |
| --- | --- | --- |
| Return visit | Record: from memory | List and home: skeleton again |
| Not found | Record: a small red line under the header | Unknown address: a centred "Not found" page |
| Network failure | Record: "Not found." (every failure that is not a 403 is read as not found, `frontend/src/pages/Record.vue:615-619`) | List: the raw "TypeError: Failed to fetch" |
| No permission | Record: a sentence | List: the server's message with HTML tags as text |
| Validation text | "... is not a valid Email Address" | "Error: Value missing for ..." |
| Empty result | An empty list: "No records" | A filter with no match: the same text, no hint a filter is on |
| Sort and filter memory | Filter: in the address | Sort: in the person's saved settings, not in the address |
| Skeleton shape | List skeleton: 4 columns; record skeleton: a 2-column form | The Deals list has 5 columns; the lead page opens on the activity feed |

### What it means for the desk

- On a normal network desk v2 shows something sooner than desk v1 (0.3 s against 1.2 s for a cold record) and sooner than CRM's Vue UI.
- It says the least after a save of the three: no confirmation, no marked field, focus dropped. Desk v1 marks the bad field; CRM keeps focus and confirms.
- The two worst moments on a slow network, the white page and the silent click, come from one design choice: the shell and the page wait for the page's code. Drawing the shell first and changing the address before the page code arrives would fix both. That is a change of order, not of code size.
- Most consistency breaks exist because each page wrote its own error, empty and loading states. One shared set of page states (loading, empty, not found, no permission, offline) would fix five of the eight and is itself a simplicity gain: one way to do one job.

## 4. Speed

Source: the speed research, which measured what each page costs on a cold load and a return visit (#43428). It measured `6352fefbdf` on the built bundle, headless Chromium, 5 runs at normal CPU and 3 with the CPU slowed 4 times, medians, on a local network.

### What it found

| Page | Visit | Usable | Usable, CPU x4 | API calls | JS, gzip | Skeleton frames |
| --- | --- | --- | --- | --- | --- | --- |
| Home | cold | 148 ms | 347 ms | 4 | 282 KB | 1 |
| Home | return | 43 ms | 58 ms | 1 | 0 | 1 |
| List (CRM Lead) | cold | 198 ms | 597 ms | 7 | 378 KB | 4 |
| List | return | 39 ms | 121 ms | 2 | 0 | 2 |
| Record (a CRM Lead) | cold | 232 ms | 681 ms | 9 | 734 KB | 3 |
| Record | return | 10 ms | 4 ms | 2 quiet re-reads | 0 | 0 |
| Desk v1 record, for comparison | cold | 465 ms | 998 ms | 6 | 1,162 KB | 0 |

- **The server is not the cost.** Each call takes 5 to 17 ms on the server. The time goes to loading about 50 JS files and drawing.
- **A cold record takes 7 steps in a row**: HTML, entry JS, boot, address table, page code, record reads, then the activity read, which waits for the record read. On a network with a 100 ms round trip those steps alone add about 0.7 s. That is arithmetic, not a measurement.
- **Four files cost the most bytes, and none is needed for the first screen:**

| Cost | Size | Why it loads |
| --- | --- | --- |
| Rich-text editor on the record page | 277 KB gzip, 38% of the record's JS | The feed's comment card shows every saved comment with the editor in read-only mode (`ui/src/components/ActivityTimeline/CommentItem.vue:61`). The comment writer already loads its editor lazily. |
| Inter font | 257 KB | One variable font on every cold load. Desk v1 loads 709 KB of fonts. |
| Icon sprite | 88 KB gzip | `frontend/src/icons/sprite.ts:6` fetches desk v1's whole icon sprite to draw the navigation icons. |
| Drag-and-drop library | 64 KB gzip | The list imports its column and sort panels at the top (`frontend/src/pages/list/DoctypeList.vue:91,95`); they open only on a click. |

- **Caches.** Desk v2's browser cache code is about 1,600 lines, and its cache tests about 4,900. The research found:
  - One open record is held up to four times: the data cache entry, the page's own `doc` and `saved` copies (`frontend/src/pages/record/recordSource.ts:23`), the activity store, and for list rows the list's own rows.
  - The data cache's list entries are written and never read. `readCachedList` and `readCachedRows` have no caller.
  - Browser meta goes stale after a Custom Field or Property Setter save, or a migrate, until a reload.
  - Two server caches, the DocType owners and the address table, read the same rows and are always read together.

### What it means for the desk

The desk is fast where it counts today: a cold record is usable in 681 ms on a slow CPU, against 998 ms for desk v1. Under the map's rule, speed is a budget, not a maximum, so most pages already have room for simpler code. The three failures below each have one cause, and none needs new machinery:

| Candidate budget that fails | Cause | Fix |
| --- | --- | --- |
| Record JS 460 KB gzip or less (today 734) | The editor loads to show saved comments | Show saved comments as sanitised HTML; load the editor when writing |
| List JS 320 KB gzip or less (today 378) | `vuedraggable` loads before a panel opens | Load the two panels when opened |
| List and home returns: 0 skeleton frames | Only the record reads the cache | The list half of the return-visit plan, or a simpler keep-alive of the page |

## 5. Simplicity

Sources: the simplification study, which asked where the same job can be done with fewer concepts (#43383, measured at `67b061fb88`); the structure research, which drew the import graph and counted concepts outside the record page (#43429; its full concept table was lost when the disk filled, so it gives counts); and two code readings for this report at `6352fefbdf`, one for the files per flow (section 8) and one that checked every cut again.

### What it found

**Size and growth.** The record page (the engine in `frontend/src/recordPage/`, its parts in `frontend/src/pages/record/`, and `frontend/src/pages/Record.vue`) was 4,172 lines on 2026-08-28 and 13,307 lines at `6352fefbdf`. It is 123 of the 183 files and 13,307 of the 18,506 lines in `frontend/src`. Most of it is features: the composer, panel, feed and header make up about 38%.

**Concepts.** A concept is a name a reader or a script author must learn.

| Area | Concepts | Source |
| --- | --- | --- |
| Record page, what a script author learns | 22 built, 2 more ruled (`onOpen`, `page.cached`), plus 5 that the return-visit build added for the late part of an async `onRefresh` | simplification study, table 2.1; the re-check for this report |
| Record page, what a reader of the code learns | 16 | simplification study, table 2.2 |
| Outside the record page, client | 70 | structure research |
| Python shell and build | 34 | structure research |
| Server routes only desk v2 uses | 10 | structure research |

**One job, two ways.** The re-check found these 10 pairs. Each is a thing a reader learns twice.

| # | Job | The two (or more) ways |
| --- | --- | --- |
| 1 | Rejoin socket rooms after a reconnect | `ui/src/socket.ts:79-84` and `frontend/src/shell/socket.ts:16-18` both do it, so every room is joined twice |
| 2 | Listen to one record's room | `pages/record/liveDocinfo.ts` and `ui/src/components/ActivityTimeline/liveUpdates.ts`, each with its own offline flag |
| 3 | Post a comment or an email | `commentPost.ts` and `emailPost.ts`; `useCommentDraft.ts` and `useEmailDraft.ts` repeat restore, reopen and the upload counter |
| 4 | Remember a per-user choice in the browser | six hand-written copies (form tab, column widths, section state, sidebar, composer, composer window) plus `useLocalStorage` in two places, with two key prefixes |
| 5 | Drop a reply that a newer request replaced | the same counter written by hand 11 times, plus the data cache's own ticket gate (`ui/src/cache/writeGate.ts`) |
| 6 | Build a record's address on the server | `frappe/shell/links.py:11-33` and `frappe/shell/navigation.py:288-330`. They escape `/` differently, so a record named with a `/` gets two different paths (section 10) |
| 7 | List the names customization code may import | `import_map` in `frappe/hooks.py:21-27`, `FRAMEWORK_NAMES` in `frappe/shell/manifest.py:29`, and `@shell` in `frontend/src/public.ts` |
| 8 | Hide a field from a script | `page.fields.hide` and `page.fields.update(x, {hidden})`, which set the same flag (`recordPage/fields.ts:54,97-107`) |
| 9 | Settle two apps that claim one slot | the first app wins a navigation renderer (`contributions/registry.ts:92-111`); the last app wins a page replacement (`:113-135`) and the permission hook for a navigation kind (`frappe/shell/navigation_filter.py:234-251`) |
| 10 | Remember a list's rows | the data cache's list entries, which nothing reads, and `rowsByDoctype` in `list/pageState.ts:29`, which the list reads |

**Layers and cycles.** From the import graph (`graph.json` on the structure branch: 73 folders, 244 edges).

- Five places where lower desk code imports a page or the page engine: the composer window in `shell/ComposerWindow.vue` imports 6 files from `pages/record/composer`; `shell/composer.ts:5-6` imports page-engine types; `shell/doctypeUpdates.ts:4-5` reaches into two page folders to clear their caches; `contributions/registry.ts:4` calls the engine; `main.ts:16-17` sets up the record page by hand.
- Seven groups of folders import each other. The largest holds 13 folders: the shell, the router, the list and every page folder. Two loops close it: the router imports the pages and the pages import the router; the shell's composer window and the record page's composer import each other.
- Nothing in `ui/` imports `frontend/`. But four `ui/` files use the record page's own words (for example `ui/src/components/FormLayout/resolveLayout.ts:180-195`), against the rule in `frontend/PHILOSOPHY.md` to place a module by who it serves.
- 86 of the 159 desk imports into `@framework/ui` reach inner files and skip its named exports.
- On the server, `frappe/utils/data.py` imports `frappe/shell/links.py`, so framework code depends on the desk's shell.

**Timing guards.** Outside the record page the re-check counted 39 timing mechanisms at 75 places: 12 generation or turn counters, 11 debounces, 9 in-flight or write gates, 2 fetch-once flags and 5 others. The record page adds 9 guard names in `Record.vue`, 6 in the paint gate (`recordPage/paintGate.ts`) and 3 in `liveDocinfo.ts`. One record open meets stale-reply protection at four layers: the cache ticket, the page's generation counter, a turn counter per store, and the timeline's own token.

**Files per flow.** Counted for this report; section 8 lists them in order.

| Flow | Front-end files | Server files | Folders | Timing guards |
| --- | --- | --- | --- | --- |
| Boot | 47 | 14 | 21 | 7 |
| Open a list | 41 | 6 | 17 | 9 |
| Open a record | 98 | 12 | 30 | about 20 |
| Save | 24 | 4 | 9 | 13 |
| Load a stored script | 13 (16 with the live update) | 4 | 8 (11) | 13 |

### What it means for the desk

- Desk v2 is not slow and not insecure; it is hard to learn. A new reader cannot follow a record open without meeting about 110 files and 20 timing guards.
- Most of the weight is repeated work, not wrong design. Stale-reply guards, browser memories, room listeners and writer pipelines each exist in two to eleven copies. These cuts re-open no ruling.
- The timing code grows with each return-visit and paint rule. The late part of an async `onRefresh`, the one background replay, and acts held until the commit are each a promise the engine keeps, and each costs a set of guards. Those are the cuts that re-open rulings.
- The 13-folder loop means the shell, router, list and pages cannot be read, tested or replaced one at a time. Two import sites keep the loop closed.

## 6. Ranked cuts

### How they are ranked

1. Cuts are ranked by what a reader no longer has to learn: concepts, pairs of mechanisms, layer breaks and cycles, and timing guards, in that order of weight.
2. When two cuts remove about the same, the one that re-opens no ruling ranks first, then the one that helps user experience or speed.
3. A cut that would open a security gap or break a proposed budget (section 7) is marked and not recommended.
4. Lines are shown only as a sign of size.

IDs: C1 to C15 are the simplification study's cuts, checked again at `6352fefbdf`. N1 to N21 are new, from the structure, speed and user experience research and the re-check. Where two IDs make one cut, both are given.

The effect columns use: **+** better, **=** no change, **-** worse.

### The rulings the cuts touch

| Short name | What it is |
| --- | --- |
| Return-visit rule 4 | `onRefresh` should be synchronous. The user amended it on 2026-09-25, while the record page's return-visit build was in review: an async `onRefresh` still works, and what it does after its first `await` lands as a later paint with a dev warning and an Error Log row. (Rulings ticket #43280.) |
| Return-visit rule 7 | After a return visit paints, the page gathers every background read and runs one replay. (#43280.) |
| Return-visit rules 9 and 10 | A new `onOpen` handler runs once per visit, and acts from the background replay are dropped. (#43280.) `onOpen` is not built. |
| The return-visit map | Return visits paint at once from one data cache for records and lists (#43276). Its cache-shape ticket ruled one cache entry per document (#43278). |
| The slow-script limit | The first paint waits at most 500 ms for scripts, then paints without the late ones. (The paint-once build, #43266.) |
| Held acts | A script's `open`, `close`, tab and focus moves wait until the replay commits, and are never saved as the reader's choice. (The panel grilling, #42568, decision 8.) |
| Header ownership | Header items have `props`, components in both zones, `clear()`, and dropdown and section containers two deep. (The header grilling, #42839.) |
| Read-only view | Every object `page` hands back refuses writes and names the verb to use. Written in `frontend/CONTEXT.md`; no ticket found. |
| Panel continuity | The reader keeps the panel they are in, across tabs and reloads. (The sidebar tickets #42464 and #42480.) |
| Compatibility promise | A removed `page` member keeps working with a warning for one major. `frontend/COMPATIBILITY.md` is the promise (#42555). |

### The list

| Rank | ID | What goes | Concepts | Pairs | Layer breaks, cycles | Timing guards | Security | User experience | Speed | Ruling re-opened | Owning map | Size (est.) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | C7, N12 | One visit object in `Record.vue` in place of `generation`, `docinfoRead`, `docinfoLanding`, `inFlight`, `whileOnRecord`, `toggleTurn` and three gather checks; one "latest reply wins" helper for the 11 hand-written counters in the list, shell, meta, layouts and scripts | 5 become 1 | pair 5 | 0 | 9 names become 1 on the record page | = | = | = | none | One page model (#43265) for `Record.vue`; no open map for the list and shell copies | 50 on the record page, 80 across the desk |
| 2 | N1 | The list half of the data cache (list entry, rows memo, name counts, list limit), which nothing reads; and the currency lookup's own 500-entry map that never refreshes | 5 | pair 10, and the currency map | breaks the `ui` api and cache file cycle in part | 5 (`admitList`, `retiringLists`, two ticket checks, the currency ref) | = | + (currency shown stale today) | + (less work per list read) | The return-visit map planned list entries for its list build (#43358, not built). That build could use the list's own row memory instead | Return visits paint at once (#43276) | 300 |
| 3 | C1 | The late part of an async `onRefresh`: the 5 s limit, the background counter, the running-source list, the inert page, `refreshWith` | 5 | 0 | 0 | 4 | = | - for scripts that fetch in `onRefresh` today: their later changes are dropped | = | Return-visit rule 4 as amended. Needs a way to get server data first: `page.cached` (#43361) or `onOpen` (#43360), neither built | One page model (#43265) | 110 |
| 4 | C4 | Five held-act stores (`heldActivations`, `heldDisclosures`, `heldFocus` in `createRecordPage.ts:284-304`; `heldOpen` in `composer.ts:44`; `heldScroll` in `feed.ts:135`) become one queue that runs after the commit | 5 become 1 | 0 | 0 | 10 staging and background branches become 2 | = | = | = | none; script authors see no change | One page model (#43265) | 60 |
| 5 | N9, N10, N14 | The shell stops importing pages. Each cache clears itself on `doctype_update`, as `clientScripts.ts:50-57` already does. The record page registers its own icon and prop setters instead of `main.ts` doing it. The composer window gets the writers through a registration, not an import | 2 setter points | 0 | all 5 layer breaks; one of the two loops in the 13-folder cycle | 0 | = | = | + (the writers no longer load into the shell at boot) | none found | Build and publishing (#43085) for `main.ts` and contributions; activity column (#42758) for the composer | 60 |
| 6 | C5 | One listener per record room: merge `liveDocinfo.ts` into the activity feed's `liveUpdates.ts`; one reconnect handler | 2 | pairs 1 and 2 | 0 | 2 (two offline flags) | = | = | + (each room joined once) | none. The live docinfo ticket (#42765) ruled on behaviour, not on two listeners | Activity column (#42758) | 45 |
| 7 | C9 | The gather of background reads on a return visit (`backgroundReads`, `applyInBackground`, the kept feed read, the staged timeline read): each read applies when it lands | 3 | 0 | 0 | 3 | = | - (two small repaints instead of one) | = | Return-visit rule 7 | Return visits paint at once (#43276) | 80 |
| 8 | N15 | The router gets pages by registration, as page replacements already do, so it stops importing the pages; standard pages become the default registration | 1 (standard pages and replacements become one) | 0 | the 13-folder cycle opens | 0 | = | = | = | none found. The page replacement map (#43270, closed) made replacements | none open | not measured |
| 9 | N16 | One save path: the engine's `saving` promise (`createRecordPage.ts:394`) and `inFlight` (`Record.vue:713`) become one; one saving state; Ctrl+S goes through the paint hold like the button | 0 | 3 small pairs | 0 | 1 | = | + (keyboard and button save paint the same) | = | none | One page model (#43265) | 30 |
| 10 | C8 | Dead and test-only code: `resolveDoctype`, `currentNavigation`, `forgetRows`, the unused `scope` in `arrangement.ts`, the second latest-wins loader in `useFormLayout.ts:130-162`, `readCachedList`, `readCachedRows`, `clear_address_table`, `clear_doctype_owners`, `setDocValueReader`, `reloadClientScripts` | 9 names | 0 | 0 | 1 | = | = | = | none | one small task; no single owner | 75 |
| 11 | C3 | `recordPage/pageCompatibility.ts`: the tombstone code for a list of removed members that is empty (`:19`). Keep the rule in `COMPATIBILITY.md` and write the code when the first member goes | 3 | 0 | 0 | 0 | = | = | = | none, if the rule text stays | One page model (#43265) | 110 |
| 12 | C2 | Merge the comment and email writer pipelines and their drafts | 2 become 1 | pair 3 | 0 | 1 (the upload counter, written twice) | = | = | = | none | Activity column (#42758) | 70 |
| 13 | N17 | One set of page states (loading, empty, empty with a filter, not found, no permission, offline, failed) shared by home, list and record, with a retry | 0 net; one way instead of three | 5 of the 8 consistency breaks | 0 | 0 | + (no raw server HTML shown as text) | + (fixes 5 of 8 breaks and the endless count skeleton) | = | none | none open | not measured |
| 14 | N13 | The router stops waiting for the next page's code (`router/index.ts:74`, `mainPage.ts:30`); the address and the page frame change at once and the page draws its skeleton while its code loads. The shell draws before the page code on a cold load | 0 | 0 | 0 | 1 (the preload) | = | + (fixes the 26 s silent click and the white page) | = on a fast network | none found | none open | not measured |
| 15 | C6 | One per-user browser memory helper for the six copies | 0 | pair 4 | 0 | 0 | + (the sidebar key becomes per user, low gap L11) | = | = | none | One page model (#43265) for the record page copies; none open for the shell | 50 |
| 16 | N2 | One server cache key for the DocType owners and the address table in `frappe/shell/doctypes.py` | 3 | 1 (the version read written twice) | 0 | 1 | = | = | = | none | none open | 25 |
| 17 | N5 | One rule for two apps claiming one slot: the last app wins everywhere | 1 rule | pair 9 | 0 | 0 | + (today app A can draw a kind while app B's hook decides who sees it) | = | = | none found | Build and publishing (#43085) | 10 |
| 18 | N4 | One list of names customization code may import | 1 or 2 | pair 7 | 0 | 0 | = (the import map stays fixed at build time) | = | = | none found | Build and publishing (#43085) | 15 |
| 19 | N3 | Drop the build-time page clash check; keep the run-time one, which sees the site's real app set | 1 | 1 | 0 | 0 | = | - (a clash shows in the browser console, not the build) | = | none found | Build and publishing (#43085) | 90 |
| 20 | N7 | File scripts and stored scripts through one per-doctype loader | 1 | 1 | 0 | 2 | = | = | = | none | One page model (#43265) | 20 |
| 21 | N8 | One memory of "where I was" on the list: history entry or per-doctype map, not both | 1 | 1 | 0 | 0 | = | - (one of two return cases loses its scroll) | = | none | none open | 25 |
| 22 | N18 | Take the session only from boot; drop the second fetch in `useSession.ts:31` and its generation counter | 0 | 1 | 0 | 1 | = | = | = | none | @framework/ui (#42660) | 20 |
| 23 | N19 | One record-address builder on the server (pair 6), which also fixes the `/` bug | 0 | 1 | 0 | 0 | = | + (one path per record) | = | none | none open | 25 |
| 24 | N11 | Move the record page's words out of four `ui/` files; move the commit channel into `frontend/` | 0 or 1 | 0 | 4 placement breaks | 0 | = | = | = | none | @framework/ui (#42660) | 10 |
| 25 | N20 | Show saved comments as sanitised HTML; load the editor only to write or edit | 0 | 0 | 0 | 0 | Safe only if the display keeps the sanitiser; comments are also sanitised on save | = | + (277 KB gzip off the record; the record JS budget passes) | none | Activity column (#42758) | not measured |
| 26 | N21 | Load the list's column and sort panels when opened | 0 | 0 | 0 | 0 | = | = | + (64 KB gzip off the list; the list JS budget passes) | none | none open | 5 |
| 27 | C14 | Acts only from `onOpen` and holds, never from `onRefresh`. Needs `onOpen` built first | 2 (net 1 with `onOpen`) | 0 | 0 | 2 | = | = | = | Held acts (#42568 decision 8) and return-visit rules 9 and 10. **Breaking** for scripts that move the reader from `onRefresh` | One page model (#43265) | 90 |
| 28 | C13 | Panel continuity from two inputs, the address and the history entry; drop `navigation/sidebarMemory.ts` | 2 | 0 | 0 | 1 | + (removes the per-tab key that is not per user) | - (Back or reload may open another panel when an address is in two) | = | Panel continuity (#42464, #42480) | none open | 60 |
| 29 | C10 | Drop nested header containers: keep `dropdown`, drop `section` and the depth-2 clamp | 3 | 0 | 0 | 0 | = | - for script authors: no titled section in a menu | = | Header ownership (#42839) | One page model (#43265) | 110 |
| 30 | C11 | Use Vue's `readonly()` for `meta`, `perms`, `roles`, `saved` instead of `recordPage/readOnly.ts` and its advice text | 2 | 0 | 0 | 0 | = (the server checks every write) | - for script authors: a wrong write fails silently in production, with no hint | = | Read-only view (`CONTEXT.md`) | One page model (#43265) | 140 |
| 31 | N6 | Drop one of the two script verbs that hide a field (pair 8) | 1 | 1 | 0 | 0 | = | = | = | The field grilling (#42759), which set `page.fields` | Every fieldtype has a control (#43206) | 10 |

### Marked: not recommended

| ID | What goes | Why not |
| --- | --- | --- |
| C15 | The whole return-visit cache (`ui/src/cache`, 788 lines, and the record page's return path) | It breaks the record return budget (0 skeleton frames, which passes today) and removes the feature the return-visit map exists for. It is not "the same job with fewer concepts". |
| C12 | The 500 ms early paint: always wait for the stored-script tier | A slow script fetch would hold the skeleton past the record's cold budget (700 ms usable at 4x slower CPU; 681 ms today leaves 19 ms). Not recommended unless a measurement shows the budget still holds. It re-opens the slow-script limit (#43266). |

## 7. Proposed budgets

These are proposals for the guardrails ticket (#43433) to decide. A budget is a ceiling a page or an area must stay under. Under the map's rule, once a page is inside its budget, simpler code wins over more speed.

### Per page

Times are at a 4x slower CPU on the research machine, because the normal-CPU times are too small to tell good from bad. Source: the speed research, cost table, unless another source is named.

| Page | Visit | Proposed budget | Today | Passes? |
| --- | --- | --- | --- | --- |
| All | cold | First paint 300 ms or less | 268 to 276 ms | yes |
| All | cold | Boot 15 KB gzip or less; `get_boot` 20 ms or less on the server | 13.7 KB; 8.7 ms | yes |
| All | any | No API call sent twice | 0 | yes |
| All | cold | Layout shift 0.1 or less (Chrome's line for "poor"). Source: the user experience walk | list 0.19, record 0.17 | no: the sidebar mounts after the page |
| All | cold, slow network | The shell (rail and sidebar) draws before the page's code arrives. Source: the user experience walk | a white page until the page code arrives | no |
| All | in-app click | Something on screen changes within 100 ms of a click (proposed; the walk measured only the failure) | nothing for 26 s on the slow network | no |
| Home | cold | Usable 400 ms or less; 4 API calls; JS 300 KB gzip or less | 347 ms; 4; 282 KB | yes |
| Home | return | 0 skeleton frames; usable 50 ms or less | 1 frame; 58 ms | no: not cached |
| List | cold | Usable 600 ms or less; 7 API calls; JS 320 KB gzip or less | 597 ms; 7; 378 KB | no: `vuedraggable` (cut 26 fixes it) |
| List | return | 0 skeleton frames; usable 50 ms or less; 2 re-reads or fewer | 2 frames; 121 ms; 2 | no: not cached |
| Record | cold | Usable 700 ms or less; 9 API calls; JS 460 KB gzip or less; 10 paints or fewer | 681 ms; 9; 734 KB; 10 | no: the editor chunk (cut 25 fixes it) |
| Record | return | 0 skeleton frames; usable 50 ms or less; 2 re-reads or fewer; 3 paints or fewer | 0; 4 ms; 2; 3 | yes |

### Per area

These count what a reader must learn. Source: section 5. The proposal is to freeze each count at today's value, so no ticket can raise it without a ruling, and to lower the ceiling as cuts land. Lines are never a budget.

| Area | Measure | Today | Proposed ceiling |
| --- | --- | --- | --- |
| Record page, script author | Concepts | 22 built, 2 ruled, 5 from the late `onRefresh` | today's count; lower with cuts 3, 4, 11, 27 |
| Record page, code reader | Concepts | 16 | today's count |
| Desk outside the record page | Concepts | 114 (70 client, 34 server and build, 10 routes) | today's count |
| Whole desk | Pairs of mechanisms for one job | 10 | 10, then 0 new |
| Whole desk | Lower layer importing a higher one | 5 | 0 new now; 0 after cut 5 |
| Whole desk | Folder cycles | 7 groups; the largest 13 folders | 0 new; the 13-folder group gone after cuts 5 and 8 |
| Boot | Files; timing guards | 61; 7 | today's count |
| Open a list | Files; timing guards | 47; 9 | today's count |
| Open a record | Files; timing guards | 110; about 20 | today's count; lower with cuts 1, 3, 4, 7 |
| Save | Files; timing guards | 28; 13 | today's count; lower with cuts 1 and 9 |
| Load a stored script | Files; timing guards | 17; 13 | today's count |

## 8. Files per flow

Counted for this report at `6352fefbdf`. A file counts when it holds logic for the flow. Type files, Vue, frappe-ui and vue-router are left out; our own `ui/` wrappers are counted. Every request passes through the same six `ui/` files: `api/index.ts`, `api/request.ts`, `api/envelope.ts`, `cache/index.ts`, `cache/dataCache.ts` and `cache/writeGate.ts`. Below they are written as "the request path". On the server, `frappe/api/__init__.py` (where `/api/v2` is mounted) counts; `frappe/app.py` and `frappe/model/document.py` do not.

Flows 1 and 2 were traced by one reader. Flows 3 to 5 were traced by three more and spot-checked.

### Boot: open `/apps/<prefix>` to the painted shell

61 files (47 front end, 14 server), 21 folders, 7 timing guards.

1. The shell page: `frappe/website/path_resolver.py:74` tries the shell page first; `frappe/website/page_renderers/shell_page.py:41-75` returns the built `index.html`, uncached; `frappe/shell/registry.py:59,69` maps the address to an app; `frappe/shell/permissions.py:37` checks the user may open it.
2. The mount: an inline theme script in `frontend/index.html:24-32`; `frontend/src/main.ts:25-79` runs boot, then addresses, then contributions, then the router, then mounts.
3. Boot request: `frontend/src/boot.ts:89-110`, then the request path.
4. Boot on the server: `frappe/api/__init__.py`, `frappe/api/v2.py:722`; `frappe/shell/boot.py:136-176` builds the payload; `frappe/sessions.py:228` fills the session; `frappe/shell/doctypes.py:56` the metadata version; `frappe/shell/navigation.py:59` reads the rail and sidebars; `frappe/shell/navigation_filter.py:23,150` filters them by permission; `frappe/shell/extensions.py:19` merges other apps' items; `frappe/desk/layers.py:45` resolves the site and user layers; `frappe/desk/desk_views.py` gives the allowed pages.
5. After boot: the address table, `frontend/src/addresses.ts:77`, served by `frappe/shell/doctypes.py:131`, awaited; translations `frontend/src/i18n.ts:12` and the icon sprite `frontend/src/icons/sprite.ts:18`, not awaited.
6. Record page setup by hand: `recordPage/iconClasses.ts`, `recordPage/drawnProps.ts`, `pages/record/drawnProps.ts`.
7. Contributions: `frontend/src/contributions/registry.ts:63-90` registers item kinds, page replacements and each app's `record.js`; `recordPage/registry.ts` and `recordPage/context.ts` take the record scripts.
8. The router: `frontend/src/router/index.ts`, `contributed.ts`, `generated.ts`, `failedPage.ts`, `routeFor.ts`.
9. Realtime: `frontend/src/shell/socket.ts` and `ui/src/socket.ts` open the socket and rejoin rooms; `recordPage/clientScripts.ts:50` and `shell/doctypeUpdates.ts:10` start their watchers; `ui/src/composables/useSession.ts:53` provides the session.
10. The paint: `frontend/src/shell/AppShell.vue:85-224` picks the open sidebar; seven navigation helpers in `frontend/src/navigation/`; the DocType item renderer `frappe/desk/navigation_item_type/doctype/frontend/item.js`; `RailColumn.vue`, `SidebarPanel.vue`, `SidebarRow.vue`, `useHashDialog.ts`, `ComposerWindow.vue` (mounted empty) and `PageFrame.vue` in `shell/`.
11. The home page: `router/mainPage.ts:30` preloads it; `pages/Home.vue` and `contents.ts:31` read the tiles, served by `frappe/shell/doctypes.py:185`.

### Open a list: sidebar click to rows painted

47 files (41 front end, 6 server), 17 folders, 9 timing guards.

1. The click: `shell/SidebarRow.vue` draws the link; `navigation/registry.ts:23` finds the renderer; the DocType item's `item.js` calls `routeFor`; `router/routeFor.ts` and `addresses.ts` build the address.
2. Routing: `router/failedPage.ts` notes the latest navigation; `router/index.ts:35-71` checks the slug; `router/mainPage.ts` preloads the page, choosing between `contributions/registry.ts` (a replacement) and `router/standardPages.ts`.
3. The page: `pages/MainPage.vue`, `pages/List.vue`, `pages/list/DoctypeList.vue`, `shell/PageFrame.vue`; `AppShell.vue` with `navigation/current.ts` and `sidebarMemory.ts` re-picks the panel.
4. List state: `list/useListPage.ts:65-223` holds the rows until meta and settings are in.
5. Meta: `ui/src/composables/useDoctypeMeta.ts` with `ui/src/utils/sharedState.ts`, then the request path; roles come from the boot session (`useDocPermissions.ts`, `useUserRoles.ts`, `useSession.ts`).
6. Settings: `list/useListSettings.ts`, then `list/storedSettings.ts`, `defaults.ts`, `query.ts`, `pageState.ts`; app list columns from `contributions/registry.ts:21`.
7. Rows: `list/useListRows.ts:70-178`, then `ui/src/api/feed.ts` and the request path; the reply goes into the data cache (`listKey.ts`, `admitList`), which the list never reads back.
8. Server: `frappe/api/__init__.py`, `frappe/api/v2.py:127` (list) and `:322` (meta), `frappe/api/include.py` (count), `frappe/desk/reportview.py`, and `frappe/desk/doctype/doctype_view/api.py` with `doctype_view.py` for the settings.
9. The paint: `ui/src/experimental/List/List.vue`, `useVirtualRows.ts`, `columnTracks.ts`; `list/useScrollMemory.ts` restores the scroll.

### Open a record: row click to the record page painted

110 files (98 front end, 12 server), 30 folders, about 20 timing guards. About 45 of the front-end files run before the paint; the rest draw it.

1. Routing: the row link from `list/useListPage.ts:278`; the same router files as the list; `pages/MainPage.vue` remounts the page for each record.
2. Start: `pages/Record.vue:879` calls `load()`, which blanks the page and shows the skeletons.
3. In parallel: `pages/record/liveDocinfo.ts` joins the record's room; `recordPage/clientScripts.ts` loads stored scripts (flow 5); `recordPage/formLayoutSource/` (six files) fetches the two form layouts; `ui` meta and permission composables; `pages/record/formTabMemory.ts`.
4. Return visit: `Record.vue:544` paints from the data cache through `recordSource.ts` and `metaSource.ts`, then re-reads and merges with `refetchMerge.ts`. First visit: `Record.vue:511` starts the feed through `feed/recordFeeds.ts` and the `ui` activity timeline store.
5. The record read: `Record.vue:635`, `recordSource.ts`, `metaSource.ts`, then the request path and `cache/entries.ts`.
6. The engine: `Record.vue:662` builds the controller through `recordPage/createRecordPage.ts` and 14 engine files (`registry.ts`, `pagePermissions.ts`, `paintGate.ts`, `surface.ts`, `staging.ts`, `context.ts`, `readOnly.ts`, `headerRenderings.ts`, `frame.ts`, `body.ts`, `formJoin.ts`, `formTabs.ts`, `fields.ts`, `feed.ts`).
7. Built-ins: about ten files in `pages/record/` for header actions, favourites, follow, panel sections, tabs and the composer host.
8. First paint: `Record.vue:652-658` waits for layouts and feed, runs the first replay, lands the paint, then waits a tick.
9. Drawing: the header (`RecordHeader.vue` and three more), the body and tabs, the form (`ui` `FormLayout.vue` and its section, column and field files), the panel (`panel/`, seven files) and the activity feed (`feed/`, three files, and `ui` `ActivityTimeline.vue`).
10. Server: `frappe/api/v2.py:112` reads the record with ten parts through `frappe/api/include.py`, which calls `desk/form/load.py`, `permissions.py`, `share.py`, `favourite.py` and `document_follow.py`; `v2.py:322` meta; `desk/doctype/form_layout/form_layout.py` and `custom/doctype/client_script/client_script.py`; `frappe/api/activity.py` and `desk/form/activity.py`.

### Save: edit a field and save, to the saved state shown

28 files (24 front end, 4 server), 9 folders, 13 timing guards.

1. The edit: a field control (for example `ui/src/components/Fields/TextField.vue`); `ui/src/components/FormLayout/FormLayoutField.vue` writes the draft and marks the commit owed; `FormLayout.vue:133` writes the value.
2. The page: `pages/Record.vue:249` works out "dirty" by comparing two JSON copies; `recordPage/commitChannel.ts` drops repeats and fires the owed commit; `createRecordPage.ts` and `registry.ts` run field handlers.
3. Save: `pages/record/RecordHeader.vue` emits it; `Record.vue:786` runs it inside the paint hold (Ctrl+S at `:859` skips the hold); `createRecordPage.ts:394-412` flushes, runs `beforeSave`, saves, runs `afterSave`; `paintGate.ts` and `staging.ts` draw the result in one commit.
4. The write: `Record.vue:715-746` refuses if the address moved, sends once, and replaces `saved` and `doc`; `pages/record/recordSource.ts:33-39`; `ui/src/api/index.ts:162-179` sends `PATCH` with `modified`; the request path, with the conflict branch in `envelope.ts`.
5. Server: `frappe/api/__init__.py`, `frappe/api/v2.py:300-313`, then the ordinary document save, which checks the timestamp, writes a version and publishes `doc_update` after commit.
6. After: the saved doc goes into the data cache; `Record.vue:454-467` re-reads the side data (`include.py`); the engine replays all 12 surfaces and every `onRefresh`; `Record.vue:261-292` redraws header and form; the activity feed re-reads on `doc_update` through `ActivityTimeline/liveUpdates.ts`, `timelineStore.ts` and `frappe/api/activity.py`.

### Load a stored script: found on the server and run on a page

17 files (13 front end, 4 server), 8 folders, 13 timing guards; 20 files with the live update when a script changes. There is no per-user tier in code: the app tier is an app's `record.js`, bundled and registered at boot, and the site tier is a `Client Script` row with the `Record` view.

1. `pages/Record.vue:477,491`: `load()` asks for the scripts beside the record read.
2. `recordPage/clientScripts.ts:72-76,107-113`: one promise per DocType, and a build counter.
3. The request path.
4. Server: `frappe/api/__init__.py`, `frappe/api/v2.py`, `frappe/custom/doctype/client_script/client_script.py:83-102` (read check, enabled rows in `run_order`), `frappe/app_state.py:73` (drops rows of disabled modules).
5. `clientScripts.ts:114-123` drops a stale build and adds each script; `recordPage/evaluateClientScript.ts:6-19` loads it as a module from a blob URL; `recordPage/context.ts`, `registry.ts` and `flattenHandlers.ts` register its handlers.
6. `Record.vue:652-662` hands "scripts ready" to the engine; `createRecordPage.ts:314-322,644-655` and `paintGate.ts:86-131` run a two-pass replay and refuse to paint until scripts are in, or 500 ms pass; `Record.vue:656-658` lands the paint.
7. Live update: `client_script.py:75-80` publishes a change after commit; `main.ts:67` watches for it; `pages/record/liveClientScripts.ts` refreshes the page if it has no unsaved edits.

## 9. Draft layer list

A draft for the target-architecture grilling (#43432), not a decision. Today's layers are the groups the structure research's graph script uses. The needed layers are one reading of what the code does. Each layer may use only the layers below it.

### Today

| Layer in the graph | Folders | Breaks today |
| --- | --- | --- |
| Framework server | `frappe`, `frappe/api`, `frappe/utils`, `frappe/desk`, the desk v2 DocTypes, `frappe/website/page_renderers` | `frappe/utils/data.py` imports `frappe/shell/links.py`; the shell page renderer imports the shell |
| Shell server | `frappe/shell/` (14 files) | Two navigation files import each other |
| Build | `frontend/plugin/` | none |
| `ui` | 22 folders under `ui/src` | Cycles: api and cache; Fields, FormLayout, Grid, Link, TableMultiSelect and composables; Composer and its two composers. Four files use record-page words |
| Desk | `shell`, `list`, `navigation`, `router`, `contributions`, `icons`, and the root modules (`main.ts`, `boot.ts`, `addresses.ts`, `arrangement.ts`, `contents.ts`, `i18n.ts`) | Five imports of pages (section 5); contributions and navigation import each other |
| Page | `recordPage/` and its layout folder, `pages/`, `pages/list`, the eight `pages/record/*` folders | Pages import the router (the 13-folder cycle) |

### What the code looks like it needs

| # | Layer | Holds | Folders today | Moves it implies |
| --- | --- | --- | --- | --- |
| 1 | Framework server | Documents, permissions, REST API v2 | `frappe/`, `frappe/api/`, DocTypes | `links.py`'s path builder moves down here or `data.py` stops calling it |
| 2 | Desk server | Boot, addresses, navigation, arrangement, the shell page | `frappe/shell/`, `shell_page.py` | none large |
| 3 | `ui` data | Requests, the data cache, the socket, the session | `ui/src/api`, `ui/src/cache`, `ui/src/socket.ts`, the session composable | api and cache stop importing each other |
| 4 | `ui` components | Fields, forms, lists, filters, the feed, the composer | the other `ui/src/components` folders, `ui/src/composables`, `ui/src/utils` | record-page words move to `frontend/` |
| 5 | Desk services | Boot data, addresses and `routeFor`, translations, icons, arrangement | the root modules, `icons/`, `routeFor.ts` | `routeFor` leaves `router/` so pages can build links without the router |
| 6 | Registry | Everything an app adds: item kinds, pages, record scripts, list columns, writers | `contributions/`, the build output of `frontend/plugin/` | standard pages and the composer writers register here too |
| 7 | Shell | Rail, sidebar, navigation, router, page frame, composer window | `shell/`, `navigation/`, `router/` | gets pages and writers from the registry, never by import |
| 8 | Page engines | The record page engine and its `page` object; the list engine | `recordPage/`, `list/` | sets its own icon and prop hooks at registration |
| 9 | Pages | The record page's parts, the list page, home | `pages/`, `pages/list`, `pages/record/*` | none |
| 10 | Customization | App file scripts and stored scripts, which reach the desk only through `page` and the published names | app folders, `Client Script` rows | one list of published names |

The entry file `main.ts` sits above all of these: it may wire every layer, and nothing imports it.

## 10. Found on the way

These came up while checking the cuts. They are not cuts; each needs its own look.

| Finding | Where | Class |
| --- | --- | --- |
| A record whose name contains `/`, `?` or `#` gets two different addresses from the server: one builder leaves those characters as they are, the other escapes them | `frappe/shell/links.py:31` against `frappe/shell/navigation.py:328` | correctness |
| The engine can credit a script's change to the wrong script. The return-visit build fixed the old restore-order bug (`recordPage/context.ts` is now a stack), but two gaps remain: when two async handlers overlap, the top of the stack names the wrong one; and the late part of an async `onRefresh` is not on the stack at all (`createRecordPage.ts:661-663`). The early paint filters by script (`paintGate.ts:212-214`), so a script's change can be drawn while it is still running. Found by reading; not reproduced | `recordPage/context.ts`, `createRecordPage.ts`, `paintGate.ts` | correctness; cut 3 removes the second gap |
| Desk v1 and desk v2 can run the same stored scripts in a different order: v1 orders by creation, v2 by `run_order` then creation | `frappe/desk/form/meta.py:146-158` against `client_script.py:83-102` | consistency |
| An open record does not listen to `doc_update`, so a save in another tab reaches only the activity feed. The return-visit invalidation grilling ruled live changes from other users a separate effort (#43279, rule 9) | `pages/Record.vue` | known, ruled separate |
| An open list does not listen to `list_update` | `list/useListRows.ts` | same as above |
| Browser meta goes stale after a Custom Field or Property Setter save, or a migrate, until a reload: the server clears its meta but sends no `doctype_update` | `frontend/src/shell/doctypeUpdates.ts:10` | correctness |
| The request code still checks for desk v1's template placeholder for the CSRF token, though v2 sets the token from boot | `ui/src/api/request.ts:35`, `frontend/src/boot.ts:109` | dead path |

## 11. What this report could not do

- **No new timing.** Every time and byte count comes from the speed and user experience research. This report measured nothing in a browser.
- **Line sizes are estimates**, except where a file is removed whole.
- **Files per flow come from reading the code**, not from tracing a running page. A runtime trace could find a file the readers missed, or show a file that loads but does no work for the flow.
- **The structure research lost its full concept table** when the disk filled. The concept counts outside the record page are its totals; this report did not rebuild the table.
- **"None found" for a ruling** means this report did not find one in the tickets it read, not that none exists. The new cuts (N-numbered) were checked against fewer rulings than the simplification study's cuts.
- **Owning maps.** Several areas (the list, the shell, navigation, server routes) belong to maps that are now closed. Those rows say "none open".
