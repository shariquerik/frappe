# Desk v2 speed: what each page costs on a cold load and a return visit

Research for frappe/frappe#43428, a child of the architecture map frappe/frappe#43426. The map
wants each page to have a speed budget (a first-paint time and a request count), so that simpler
code wins once a page meets its budget. This file gives the measured numbers those budgets need.
It decides nothing; the guardrails ticket decides the budgets.

## Short answer

- On this machine every desk v2 page is usable in about 150 to 230 ms from a cold start, and in
  350 to 680 ms when the CPU is slowed four times. Desk v1 needs 465 ms and 1,000 ms for the same
  record.
- The server is not where the time goes. The six reads a record page makes take 7 to 17 ms each
  on the server, mostly in parallel. The browser spends the rest loading about 50 JS files and
  drawing.
- A return to a record is instant: content on the first frame, no skeleton, 2 quiet re-reads. A
  return to the list or the home page still shows a skeleton, because neither is cached yet.
- Four files cost the most bytes: the rich-text editor on the record page (277 KB gzip), the Inter
  font (257 KB), the icon sprite (88 KB gzip) and the drag-and-drop library on the list (64 KB
  gzip). None of them is needed to draw the first screen.

## What was measured

| item | value |
| --- | --- |
| Code | `upstream/desk-v2` at `6352fefbdf` (the merge of the record page's return-visit build) |
| Bundle check | served bundle built 2026-09-26 00:36, 4 minutes after that merge; its `Record-*.js` holds that merge's last change (the record read errors wrapped in `__()`); `index.html` md5 was the same before and after every run |
| Server | `bench serve` on `crm.localhost:8019`, the built bundle, werkzeug, no gzip, developer mode |
| Site and user | `crm.localhost`, Administrator |
| Record | `CRM-LEAD-2026-00002`: 11 comments, 13 version rows, 1 email |
| Browser | headless Chromium 151 (Playwright 1.62.1 from `apps/crm/node_modules`), 1440 x 900, local network |
| Runs | 5 runs at normal CPU, 3 runs with the CPU slowed 4 times (Chrome's CPU throttling); medians |
| Scripts | `research/desk-v2-speed/measure.mjs` (driver), `pageProbe.mjs` (in-page frame counter), `summarize.mjs` (tables), `serverTime.sh` (server times with curl); raw results (gzip JSON) and summaries in `research/desk-v2-speed/results/` |

Words used in the tables:

| word | meaning |
| --- | --- |
| cold | new browser, empty HTTP cache, open the URL |
| warm reload | new tab in the same browser, so JS and CSS come from the HTTP cache |
| in-app | reached by clicking a link inside a running desk (the shell is already loaded) |
| return | Back or Forward in the same tab, to a page seen a moment ago |
| first paint | first contentful paint for a page load; first frame that changed the page for in-app steps |
| content | first frame that shows the page's content (home: the CRM Lead tile; list: a row; record: a form field) |
| usable | first frame from which the content is visible and no skeleton is left |
| still | last frame that changed the page before 1.5 s of quiet |
| paints | frames that changed the page between the start and "still" |
| gzip | each body compressed with gzip level 6 by the script; `bench serve` sends everything uncompressed, production nginx compresses |

Limits:

- Local network: no latency and no bandwidth limit. Real networks add a round trip per step on the
  critical path (see "Where the time goes") and transfer time for the gzip bytes.
- On this bench every API reply carries `no-store`. `frappe/app.py:291-292` puts `no-store` back on
  every response when the dev server is on. In production the address table and translations are
  sent with a one-year browser cache (`@http_cache(max_age=31536000)` on `get_addresses` at
  `frappe/shell/doctypes.py:130` and on `get_boot_translations` at `frappe/translate.py:139`),
  so a production warm reload would not fetch those two. I checked this by calling the same app
  in-process, which answers `private,max-age=31536000`.
- Another research agent walked the same site at the same time, so a few samples may carry its load.
- The disk filled twice during the work (another job); runs that hit it were thrown away and rerun.

## 1. Cost table

### Times (ms, median)

| page | visit | first paint | content | usable | still | paints | skeleton frames | usable, CPU x4 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| home | cold | 116 | 148 | 148 | 148 | 5 | 1 | 347 |
| home | warm reload | 100 | 148 | 148 | 148 | 5 | 1 | 347 |
| home | return | 10 | 43 | 43 | 43 | 2 | 1 | 58 |
| list | cold | 116 | 198 | 198 | 198 | 7 | 4 | 597 |
| list | warm reload | 108 | 182 | 182 | 182 | 8 | 4 | 582 |
| list | in-app, first visit | 24 | 91 | 91 | 91 | 4 | 3 | 320 |
| list | return | 7 | 39 | 39 | 41 | 3 | 2 | 121 |
| record | cold | 124 | 197 | 232 | 282 | 9 | 3 | 681 |
| record | warm reload | 108 | 182 | 215 | 265 | 9 | 3 | 681 |
| record | in-app, first visit | 14 | 75 | 115 | 158 | 7 | 3 | 353 |
| record | return | 10 | 10 | 10 | 59 | 3 | 0 | 4 |

At CPU x4 the cold first paints are 272 (home), 268 (list) and 276 ms (record).

### Requests (median count)

"Network" counts requests that reached the server. "Cache" counts requests the browser answered
from its HTTP cache. Socket.io polling and `data:` URLs are left out.

| page | visit | network | cache | API calls | JS files | CSS files | sent twice |
| --- | --- | --- | --- | --- | --- | --- | --- |
| home | cold | 64 | 0 | 4 | 41 | 14 | 0 |
| home | warm reload | 5 | 59 | 4 | 41 | 14 | 0 |
| home | return | 1 | 0 | 1 | 0 | 0 | 0 |
| list | cold | 72 | 0 | 7 | 45 | 15 | 0 |
| list | warm reload | 8 | 64 | 7 | 45 | 15 | 0 |
| list | in-app, first visit | 11 | 0 | 4 | 6 | 1 | 0 |
| list | return | 2 | 0 | 2 | 0 | 0 | 0 |
| record | cold | 82 | 15 | 9 | 53 | 28 | 0 |
| record | warm reload | 10 | 87 | 9 | 53 | 28 | 0 |
| record | in-app, first visit | 17 | 16 | 5 | 11 | 15 | 0 |
| record | return | 2 | 16 | 2 | 0 | 15 | 0 |

No API call is sent twice on any step. The record page asks for 15 CSS files a second time on
every visit; the browser answers them from memory, so they cost no bytes. That is the Vite preload
helper adding a `<link>` for each lazy chunk's CSS.

The API calls, in order:

| page | visit | calls |
| --- | --- | --- |
| home | cold | `get_boot`, `get_boot_translations`, `get_addresses`, `get_contents` |
| home | return | `get_contents` |
| list | cold | the 3 boot calls, CRM Lead meta, list view settings (`doctype_view.api.get`), CRM Lead Status search (for the quick filter), the list read |
| list | return | the list read, CRM Lead Status search |
| record | cold | the 3 boot calls, `get_client_scripts`, CRM Lead meta, `get_form_layouts` for Details, `get_form_layouts` for Side Panel, the record read (with 8 parts), the activity read |
| record | in-app, from the list | `get_client_scripts`, the 2 form layouts, the record read, the activity read |
| record | return | the record read, the activity read (both quiet re-reads) |

### Bytes downloaded (KB, raw / gzip, median; HTTP-cache hits left out)

| page | visit | HTML | API | JS | CSS | font | icon sprite | images |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| home | cold | 7.4 / 1.9 | 42.1 / 12.4 | 830 / 282 | 496 / 53 | 258 / 257 | 513 / 88 | 95 |
| list | cold | 7.4 / 1.9 | 156.7 / 17.7 | 1,115 / 378 | 498 / 53 | 258 / 257 | 513 / 88 | 95 |
| list | in-app | - | 117.4 / 5.9 | 288 / 97 | 2 / 1 | - | - | - |
| list | return | - | 2.8 / 0.7 | - | - | - | - | - |
| record | cold | 7.4 / 1.9 | 169.6 / 21.2 | 2,254 / 734 | 496 / 53 | 258 / 257 | 513 / 88 | 910 |
| record | in-app | - | 15.8 / 4.2 | 1,219 / 382 | - | - | - | 815 |
| record | return | - | 10.4 / 2.7 | - | - | - | - | - |
| any | warm reload | 7.4 / 1.9 | same as cold | 0 | 0 | 0 | 0 | 0 |

The boot payload is the HTML plus the three boot calls: 46.7 KB raw, 13.7 KB gzip.

| part | raw | gzip |
| --- | --- | --- |
| HTML (`index.html`, no boot data inside) | 7.4 | 1.9 |
| `get_boot` | 8.8 | 2.9 |
| `get_boot_translations` (English) | 1.9 | 0.8 |
| `get_addresses` (every DocType's address, all apps) | 28.7 | 8.0 |

The CRM Lead meta is 114 KB raw but 5.2 KB gzip. It is read again on every page load and every
reload, since it lives in memory only.

The record's 910 KB of images are site data, not code: 815 KB is one demo user photo
(`sarah-connor.png`) shown full size as an avatar in the feed. Desk v1 downloads the same 910 KB.

### Server time (ms)

Measured with `serverTime.sh`: 10 requests each, one after another, time to first byte, median.

| call | median | min | max | reply size |
| --- | --- | --- | --- | --- |
| `get_boot` | 8.7 | 5.5 | 17.6 | 9.0 KB |
| `get_addresses` | 5.3 | 4.0 | 6.4 | 29.4 KB |
| CRM Lead meta | 7.5 | 6.1 | 10.1 | 117 KB |
| record read | 9.5 | 6.1 | 14.7 | 2.5 KB |
| activity read | 17.2 | 9.8 | 27.1 | 7.4 KB |
| desk v1 `getdoc`, for comparison | 19.6 | 16.1 | 22.3 | 8.8 KB |

Inside the browser runs (time to first byte, median): `get_boot` 9, record read 14, activity 11,
meta 7, each form layout 9, `get_client_scripts` 9, `get_contents` 26 ms.

## 2. Where the time goes

A record opened cold, one run at normal CPU (ms from the HTML request; first paint 100, content
182, usable 215):

| from | to | what |
| --- | --- | --- |
| 0 | 10 | HTML |
| 11 | 109 | 53 JS files (the entry and everything it imports, then the record chunks) |
| 12 | 30 | main CSS, and the editor's CSS, which `index.html` links on every page |
| 55 | 64 | `get_boot`, sent once the entry JS has run |
| 64 | 70 | translations, address table and icon sprite, in parallel |
| 87 | 109 | the record page chunk and the editor chunk (`paperclip-*.js`, 925 KB raw) |
| 148 | 160 | client scripts, meta, both form layouts and the record read, in parallel |
| 177 | 187 | the activity read, which starts only after the record read has returned |

The list is the same shape: the list chunk at 102 ms, then meta and list settings together at 133,
then the status search and the list read at 168 and 172. The list read waits for meta and settings.

So a cold record takes 7 steps in a row: HTML, entry JS, boot, address table, page chunk, record
reads, activity. On localhost each step is a few ms. On a network with a 100 ms round trip, those
7 steps alone would add about 0.7 s, before transfer time. That part is arithmetic, not measured.

The CPU is the other cost. Slowing the CPU 4 times moves the cold record from 232 to 681 ms and the
cold list from 198 to 597 ms, while the server work stays the same. Most of that is parsing and
running about 2.2 MB of JS.

### The biggest single costs

| cost | size | where it comes from |
| --- | --- | --- |
| Rich-text editor on the record page | 925 KB raw / 277 KB gzip, 38% of the record's JS | The activity feed's comment card draws every saved comment with frappe-ui's TipTap editor, read-only. `ui/src/components/ActivityTimeline/CommentItem.vue:61` imports `Editor`, `EditorContent` and `CommentKit` from `frappe-ui/editor`. The comment writer at `frontend/src/pages/record/composer/CommentWriter.vue:34` already loads its editor lazily. |
| Inter font | 258 KB, does not compress | One variable font file on every cold load. Desk v1 loads 709 KB of font files for the same record. |
| Icon sprite | 513 KB raw / 88 KB gzip | `frontend/src/icons/sprite.ts:6` fetches desk v1's full lucide sprite once per page, to draw the navigation icons named in boot. |
| Main CSS | 456 KB raw / 42 KB gzip | `index-*.css`. |
| Drag-and-drop library on the list and record | 188 KB raw / 64 KB gzip | `vuedraggable`. The list page imports the column and sort settings panels at the top (`frontend/src/pages/list/DoctypeList.vue:91` and `:95`); they use it to reorder, and open only on a click. The record gets it through the form's child-table grid. |
| CRM Lead meta | 114 KB raw / 5.2 KB gzip | Read again on each page load; memory only. |
| Address table | 28.7 KB raw / 8.0 KB gzip | The largest part of boot; cached for a year by the browser in production, not on this bench. |

### Return visits

| page | what happens now |
| --- | --- |
| record | Paints from memory on the first frame, 0 skeletons, then re-reads the record and its activity quietly: 3 paints, still at 59 ms. This is what the return-visit map asked for. |
| list | 2 skeleton frames, content at 39 ms. The list is read again. The list half of the return-visit cache (its build task for the list and saved view) is not built yet. |
| home | 1 skeleton frame, content at 43 ms. `get_contents` (26 ms on the server) is asked again on every visit and not kept anywhere. |
| desk v1 | Record return: 0 requests, 5 ms. List return: 3 requests, 9 ms. Desk v1 hides a page's DOM when you leave and shows it again when you return. |

## 3. Cache table

Browser caches and memories on these three pages (non-blank, non-comment lines):

| cache | where | holds | key | limit | cleared when | lines only for it |
| --- | --- | --- | --- | --- | --- | --- |
| Shared record and list data cache | `ui/src/cache/` (two limits at `dataCache.ts:22-23`); fed by every API reply through `ui/src/api/feed.ts`; read by the record page's return visit (`frontend/src/pages/Record.vue:544`, `openFromMemory`) | one frozen entry per document (doc, 9 parts, a "complete" flag); one entry per list query (names, next page, count) | `doctype\0name`; list: doctype plus the sorted query | 50 complete records, 20 lists | user change; delete drops the entry and removes it from lists; save replaces the doc; not on `doctype_update` | about 720 (cache 633, feed 50, rest wiring), plus 68 in `Record.vue` for the return visit |
| Activity feed stores | `ui/src/components/ActivityTimeline/storeCache.ts:4`; record side in `frontend/src/pages/record/feed/recordFeeds.ts` | every activity page read so far, cursor, socket wiring | `doctype:name` plus the shown types | 20 idle stores | evicted past 20; not on user change or delete | about 172 |
| Doctype meta | `ui/src/composables/useDoctypeMeta.ts:42` | meta with child tables, per user (`masked_fields`) | doctype | none | `doctype_update`; not on user change | about 84 |
| Shared memo helper | `ui/src/utils/sharedState.ts:17` (`memoizedState`) | the store under meta and form layouts | caller's key | none | `drop` or `reset` | about 28 |
| Form layouts | `frontend/src/recordPage/formLayoutSource/useFormLayout.ts:47` | Form Layout rows and the fallback tree | `doctype:type` | none | `doctype_update` | 54 |
| List settings | `frontend/src/list/useListSettings.ts:46` | site and user list settings, a pending write | doctype | none | `doctype_update`; own write | 151 (whole file; about 30 is the memo) |
| List page state | `frontend/src/list/pageState.ts:29` and `history.state` | page size and scroll offset; no rows | doctype; history entry | one per doctype | a new query | 33 |
| Client Script tiers | `frontend/src/recordPage/clientScripts.ts:20` | a promise per doctype that loads and registers its Client Scripts | doctype | none | realtime Client Script change | 37 |
| Currency lookups | `ui/src/components/FormLayout/resolveCurrency.ts:30` | one field value of another record | `doctype\0name\0field` | 500 | never (tests only) | 47 |
| Address table | `frontend/src/addresses.ts:77`, fetched at `frontend/src/main.ts:48` | every DocType's slug and module | one per page load; HTTP key is `v=<metadata_version>` | one | page reload | 7 (the fetch) |
| Translations | `frontend/src/i18n.ts:10` | the language's messages | one per page; HTTP key has `v=` | one | page reload | about 10 |
| Icon sprite | `frontend/src/icons/sprite.ts:13` | the sprite in a hidden div, symbol names | one per page | one | page reload | about 18 |
| Browser storage | `frontend/src/navigation/sidebarMemory.ts`, `sectionMemory.ts`, `frontend/src/pages/record/formTabMemory.ts`, `frontend/src/pages/record/body/columnStore.ts` | last sidebar, section open state, last form tab, column widths (reader choices, not server data) | sessionStorage `frappe:desk:sidebar`; localStorage `frappe:desk:sections`, `frappe:desk:formTab`, `frappe:desk:record-body-columns` | sidebar 100 paths; others none | tab close (sidebar); never (others) | 147 |
| HTTP cache of hashed JS and CSS | werkzeug on `/assets` (`frappe/app.py:632`), `max-age=43200` plus ETag | built files | URL | browser | new build gives new names | 0 |
| Home page contents | `frontend/src/contents.ts:42` | nothing is kept | - | - | read on every visit | 0 |

Clear point: `frontend/src/shell/doctypeUpdates.ts:10` listens for `doctype_update` and clears
meta, form layouts and list settings. It does not clear the data cache, activity stores, Client
Scripts or currency lookups.

Server side:

| cache | where | holds | key | cleared when | lines only for it |
| --- | --- | --- | --- | --- | --- |
| Boot | `frappe/shell/boot.py:136` | not cached; built per request. Only an over-budget log marker is written (24 h) | `boot_budget:<key>:<prefix>` | expires | about 3 |
| Address table and doctype owners | `frappe/shell/doctypes.py:37-49` and `:112-122`, in `frappe.client_cache` (Redis plus a 10-minute copy per worker) | DocType to app; the address table | `shell_doctype_owners`, `shell_address_table_v2`, each storing the `metadata_version` it was built for | next read after `metadata_version` changes; full clear-cache | about 26 |
| Prefix registry | `frappe/shell/registry.py:47` | prefix to app | `shell_prefix_registry` | app install, full clear-cache | 6 |
| Doctype meta | `frappe/model/meta.py:84-91` | the Meta object | `doctype_meta::<doctype>` | DocType, Customize Form, Custom Field, Property Setter saves, migrate | framework, not desk v2 |
| Record read | `frappe/api/v2.py:112` and `frappe/api/include.py` | nothing is cached; each part is a fresh query | - | - | 0 |
| Translations | `frappe/translate.py:177` | merged messages per language | Redis hash `merged_translations` | `translate.clear_cache()` | framework |

Desk v2's own browser cache code is about 1,600 lines (147 of them the reader-choice memories),
and its cache tests about 4,900 raw lines. The server side adds about 35 lines.

Notes from reading the caches:

1. One open record is held up to four times: the data cache entry, a JSON copy in the page's own
   `doc` and `saved` (`frontend/src/pages/record/recordSource.ts:23`), the activity store, and,
   for list rows, both `useListRows` and the data cache's list entries.
2. List entries in the data cache are written and never read. `readCachedList` and
   `readCachedRows` are exported from `ui/src/index.ts:29-31` with no caller. They keep partial
   document entries alive and take the 20 list slots.
3. The currency lookup reads through the list API (`resolveCurrency.ts:65`), so each lookup also
   takes a list slot in the data cache, and keeps the value again in its own map that never
   refreshes.
4. Browser meta can go stale: a Custom Field or Property Setter saved on its own, or a migrate,
   clears the server's meta but sends no `doctype_update`, so open pages keep the old meta until a
   reload.
5. Dead clear functions: `forgetRows` (`frontend/src/list/pageState.ts:46`) and
   `clear_address_table` (`frappe/shell/doctypes.py:125`) have no caller;
   `clear_doctype_owners` (`:52`) is called only by tests.
6. Two server tables, the doctype owners and the address table, read the same DocType rows, check
   the same version and are always read together; they could be one key.

## 4. Comparison for the same record (CRM Lead, cold)

Desk v1 was measured the same way (`/desk/crm-lead/CRM-LEAD-2026-00002`). CRM's newer frontend
("frontend2", branch `feat/crm-frontend2` in `apps/crm`) cannot run on this bench: it needs four
DocType families (Navigation Item, Navigation Section, Saved View, Form Layout) from a frappe branch
the bench does not have. So its bytes come from a production `vite build` of commit `9d064a58d`
(reference worktree `crm-bench/reference/crm-frontend2`), and its requests are read from its
source. Its times were not measured.

| | desk v2 | desk v1 | CRM frontend2 (built, not run) |
| --- | --- | --- | --- |
| requests reaching the server (no socket) | 82 | 40 | about 76 files plus 14 API calls (from source) |
| API calls | 9 (3 are boot) | 6 | 14 (15 with a slug URL) |
| boot data | 13.7 KB gzip in 3 calls | 57.0 KB gzip inside the HTML | inside the HTML (not measured) |
| JS | 2,254 KB raw / 734 gzip | 4,000 / 1,162 | 3,131 / 929 |
| CSS | 496 / 53 | 814 / 122 | 6,399 / 450 |
| fonts | 258 | 709 | 264 |
| first paint | 124 ms | 308 ms | not measured |
| usable | 232 ms | 465 ms | not measured |
| usable, CPU x4 | 681 ms | 998 ms | not measured |
| still | 282 ms | 1,432 ms | not measured |
| return: requests | 2 quiet re-reads | 0 | 1 quiet re-read (`getdoc`), within 5 minutes |
| return: usable | 10 ms, no skeleton | 5 ms | paints the cached copy at once, within 5 minutes; skeletons after 5 minutes |

About frontend2:

- 5.76 MB of its 6.36 MB main CSS comes from `!`-prefixed rules made by the safelist in its
  `tailwind.config.js:13`.
- Its shell always loads the TipTap editor, a code editor and `marked`, because `AppShell.vue:158`
  mounts the page-script editor dialog directly.
- Its activity read starts only after the doc, page scripts, roles and meta have all answered, two
  round trips behind the doc.
- It keeps meta, layouts, roles, page scripts, sidebars and the activity feed for the tab's life;
  only `getdoc` has the 5-minute limit.

## 5. Candidate budgets

These are proposals for the guardrails ticket to decide. Each comes from one row above. Times are at
CPU x4 on this machine, because the unthrottled times are too small to separate good from bad.

| page | visit | candidate budget | measured now | from |
| --- | --- | --- | --- | --- |
| all | cold | first paint 300 ms or less | 268 to 276 ms | times table, CPU x4 |
| all | cold | boot payload 15 KB gzip or less; `get_boot` 20 ms or less on the server | 13.7 KB; 8.7 ms | boot payload table; server table |
| home | cold | usable 400 ms or less; 4 API calls; JS 300 KB gzip or less | 347 ms; 4; 282 KB | times, requests, bytes tables |
| home | return | 0 skeleton frames; usable 50 ms or less | 1 frame; 58 ms (fails) | times table |
| list | cold | usable 600 ms or less; 7 API calls; JS 320 KB gzip or less | 597 ms; 7; 378 KB (fails; 314 KB without `vuedraggable`) | times, requests, bytes tables |
| list | return | 0 skeleton frames; usable 50 ms or less; 2 re-reads or fewer | 2 frames; 121 ms; 2 (fails) | times table |
| record | cold | usable 700 ms or less; 9 API calls; JS 460 KB gzip or less; 10 paints or fewer | 681 ms; 9; 734 KB (fails; 457 KB without the editor chunk); 10 | times, requests, bytes tables |
| record | return | 0 skeleton frames; usable 50 ms or less; 2 re-reads or fewer; 3 paints or fewer | 0; 4 ms; 2; 3 (passes) | times table |
| any | any | no API call sent twice | 0 | requests table |

Three of these fail today, and each failure has one clear cause: the list and home returns are not
cached yet, the list page loads `vuedraggable` before anyone opens its settings, and the record
page loads the editor to show saved comments.

## How to rerun

```sh
cd research/desk-v2-speed
node measure.mjs 5 results/runs.json                       # all flows, 5 runs
CPU_SLOWDOWN=4 node measure.mjs 3 results/runs-cpu4.json   # CPU slowed 4 times
node summarize.mjs results/runs.json.gz > results/summary.md
RUNS=10 ./serverTime.sh
```

`BASE_URL`, `RECORD`, `USR`, `PWD_FRAPPE` and `PLAYWRIGHT` (path to Playwright's `index.mjs`) can
be set in the environment. Check that the served bundle matches the commit you mean to measure
before a run.
