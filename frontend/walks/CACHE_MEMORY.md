# Desk v2 cache memory at its limits

This walk fills each desk v2 cache store to its limit and reads the JS heap after each step.
It answers one question: how much memory does each store hold when it is full?

## Result in short

- With the record page on its Details tab, the whole cache costs about 31 MB for 50 large
  Sales Invoices. Almost all of it is the 50 complete records, at about 620 KB each.
  Lists, list rows and field reads together cost under 0.3 MB.
- Opening a record's Activity tab changes this. Each feed store then keeps its record page
  alive after the page is left: the DOM, the component tree and the 100-row items grid.
  That is about 43 MB per Sales Invoice and 2.4 MB per ToDo. With 50 Sales Invoices the
  heap reached 1.97 GB. The feed store itself is only 3 to 6 KB.
- Every limit holds. One record, list or field read past the limit adds no lasting memory.

## What was measured

| Item | Value |
| --- | --- |
| Site | `crm.localhost` on the running bench, ERPNext installed |
| Build served | Built assets, not the Vite dev server: `/apps/desk` loads `/assets/frappe/frontend/assets/index-IBWLBxLJ.js`. The bundle was built at 19:43 from the main checkout on `desk-v2` at 31a8407561, the same commit this branch starts from. |
| Browser | Playwright headless Chromium 151.0.7922.34 |
| Large case | Sales Invoice, draft. 235 fields, 11 child tables. Each record has 100 item rows, 3 tax rows and 5 comments. Its feed shows the 5 comments and the creation row. |
| Small case | ToDo. 18 fields, no child tables, no comments. Its feed shows the creation row. |
| Reply sizes | One Sales Invoice record reply (doc, children and the nine parts): 454,718 bytes. One Sales Invoice list page (20 rows): 4,244 bytes. ToDo: 900 bytes and 4,064 bytes. |
| Runs | Two runs of each case, in each of two modes. Runs differ by under 5% on every step except ToDo steps under 2 MB, where the range is shown. |

## How

For each case the walk opens a fresh browser context on the desk home page. It then:

1. reads the heap there (baseline);
2. opens the first list and the first record (meta, form layouts and list settings are now held);
3. opens records 2 to 50;
4. opens lists 2 to 20, each with its own filter, so each is a separate list entry;
5. calls `getDocumentFields` for 50 more records;
6. opens a 51st record, a 21st list and makes a 51st field read, one at a time;
7. opens lists 2 to 21 again, because only a return to a list fills the rows memo.

Each record and list is opened from the home page through the app's router, so it mounts
afresh and the cache survives. A record visit shows the Details tab, then (in feed mode) the
Activity tab, and waits until the page and network have been quiet for 500 ms. The heap is
always read on the home page, so no list or record is on screen. Before each read the walk
forces garbage collection twice (`HeapProfiler.collectGarbage`) and then reads
`Runtime.getHeapUsage`. A store's heap cost is the heap change over the step that fills it.

`getDocumentFields` is called from the page itself. The walk finds the built chunk that
exports it, and the one that exports `readCachedDocument`, by the shape of their code, and
imports them by the same URL the app used, so it gets the app's own cache. It uses
`readCachedDocument` after every step to check how many records are complete or partial.

**Splitting stores.** One record visit fills two stores, the complete record and its feed
store, and one list visit fills the list entry and its row documents. To split them the walk
takes a heap snapshot and works out, for each store, how many bytes would be freed if that
store's objects went. It finds the objects by their property names, which survive the
minified build: the `DataCache` with its `documents`, `lists` and `memo` maps, each document
entry, each feed store and the map holding them. Vue component instances are treated as a
wall, so a page that a store keeps alive is counted on its own line. Weak references and the
key-to-value links inside a `WeakMap` do not count as keeping anything alive.

A heap snapshot of the 2 GB heap crashed the headless page. So in feed mode the walk also takes
a sample snapshot after 5 records, and skips the final snapshot when the heap is over 1 GB.

## Sales Invoice, Details tab only (`FEED=0`)

Heap at baseline: 19.3 MB. Heap at the end: 64.2 to 65.7 MB.

| Store | Limit | Filled | Heap MB for the step | Heap KB per entry | Snapshot KB per entry | Snapshot MB |
| --- | --- | --- | --- | --- | --- | --- |
| Complete records (doc, children, nine parts) | 50 | 50 | 35.0 to 36.4 (records 2 to 50) | 683 to 715 (records 6 to 50) | 618 | 30.2 |
| Lists (names, count, next page) | 20 | 20 | 0.61 to 0.62 (lists 2 to 20) | 33 | 0.2 | 0.003 |
| Documents only a list row names | while listed | 400 | part of the list step | | 0.2 | 0.08 |
| Rows memo | one per list | 20 | 0.11 to 0.12 (returns to lists 2 to 21) | 6 | 7.6 | 0.15 |
| Field-read entries | 50 | 50 | 0.02 | 0.4 | 0.2 | 0.008 |
| Feed stores | one per complete record | 0 | feed not opened in this mode | | | |
| `page.cached` values | per complete record | 0 | no Client Script on these doctypes uses it | | | |
| Meta, form layouts, list settings | one per doctype | 1 | about 8.4 (see below) | | not split | |
| **Whole `DataCache` at its limits** | | 500 entries | | | | **30.5** |

Past the limit: the 51st record added 0.01 to 0.02 MB, the 21st list 0.03 MB, the 51st field
read 0.00 MB.

## Sales Invoice, Activity tab opened (`FEED=1`)

Heap at baseline: 19.3 MB. Heap after 50 records: 1,969 MB. Heap at the end: 1,974 MB.

| Store | Limit | Filled | Heap MB for the step | Heap KB per entry | Snapshot KB per entry (5 records) |
| --- | --- | --- | --- | --- | --- |
| Complete records | 50 | 50 | 1,902 (records 2 to 50) | 39,680 (records 6 to 50) | 622 |
| Feed stores | one per complete record | 50 | same step | | 5.7 |
| Record pages kept alive by the feed stores | none of its own | 50 | same step | | 42,800 |
| Lists and their row documents | 20 | 20 | 0.86 to 0.88 (lists 2 to 20) | 46 to 47 | as in `FEED=0` |
| Rows memo | one per list | 20 | 0.16 to 0.17 (returns to lists 2 to 21) | 8 to 9 | as in `FEED=0` |
| Field-read entries | 50 | 50 | 0.01 to 0.02 | 0.2 to 0.4 | as in `FEED=0` |

Past the limit: the 51st record added 4.3 MB. The feed store of the record that left is
dropped, and the page it kept goes with it, so the growth stops at 50 pages.

## ToDo, Details tab only (`FEED=0`)

Heap at baseline: 19.3 MB. Heap at the end: 29.2 MB.

| Store | Limit | Filled | Heap MB for the step | Heap KB per entry | Snapshot KB per entry | Snapshot MB |
| --- | --- | --- | --- | --- | --- | --- |
| Complete records | 50 | 50 | 2.5 to 2.7 (records 2 to 50) | 28 to 31 (records 6 to 50) | 1.2 | 0.06 |
| Lists | 20 | 20 | 0.68 to 0.84 (lists 2 to 20) | 37 to 46 | 0.2 | 0.003 |
| Documents only a list row names | while listed | 400 | part of the list step | | 0.2 | 0.08 |
| Rows memo | one per list | 20 | 0.20 to 0.21 | 10 to 11 | 6.4 | 0.13 |
| Field-read entries | 50 | 50 | 0.02 to 0.03 | 0.4 to 0.6 | 0.2 | 0.008 |
| Meta, form layouts, list settings | one per doctype | 1 | about 6.3 (see below) | | not split | |
| **Whole `DataCache` at its limits** | | 500 entries | | | | **0.36** |

Past the limit: the 51st record added 0.00 MB, the 21st list 0.03 to 0.04 MB, the 51st field
read 0.00 MB.

## ToDo, Activity tab opened (`FEED=1`)

Heap after 50 records: 140 MB. Heap at the end: 141 MB.

| Store | Limit | Filled | Heap KB per entry (records 6 to 50) | Snapshot KB per entry (50 records) | Snapshot MB |
| --- | --- | --- | --- | --- | --- |
| Complete records | 50 | 50 | 2,301 to 2,303 | 1.2 | 0.06 |
| Feed stores | one per complete record | 50 | same step | 2.3 | 0.12 |
| Record pages kept alive by the feed stores | none of its own | 50 | same step | 2,430 | 121.5 |

## What the numbers mean

**Complete records cost about 1.4 times their reply.** A 445 KB Sales Invoice reply becomes
618 KB of heap. A list page costs about the same as its reply: 4.2 KB for 20 rows.

**The first list and record cost 9.2 MB for Sales Invoice and 6.3 MB for ToDo.** This step
also loads the list and record page code, which is shared by every doctype. So the meta,
form layouts and list settings for Sales Invoice cost about 3 MB more than ToDo's; the
shared 6 MB is mostly code. The walk does not split this step further.

**About 20 to 40 KB per page visit is outside every store.** The heap grows by 28 to 31 KB per
ToDo visit and 33 to 46 KB per list visit, while the stores gain about 1 to 5 KB. For Sales
Invoice the gap is about 70 to 100 KB per visit. The walk did not trace it.

**The rows memo keeps an older copy of each list's rows.** A return to a list paints the memo's
rows, then reads the list again. The fresh reply replaces the documents in the cache, but the
memo still holds the rows it built before, until that list is painted again. That is why it
costs 6 to 8 KB per list, not a few hundred bytes.

**The feed store keeps its page.** In a snapshot, the path from a module-level object to a
left record page runs: the `trackedFeeds` set in `ActivityTimeline/pendingRows.ts`, a feed's
`data` ref, that ref's list of subscribers, the render effect of the `TimelineFeed` component,
and from its instance up through `ActivityTab`, `RecordTabs`, `Record` and `MainPage`. So the
`TimelineFeed` render effect is still subscribed to the store's `data` ref after the page
unmounts. The store lives as long as its record's complete entry, up to 50 records, so the
page lives that long too.

## Other things seen

- Opening a Sales Invoice on the Details tab sends about 425 requests: an Item search and a
  Warehouse search for each of the 100 item rows.
- Opening a Sales Invoice makes a field read of the Company's `default_currency`. Field reads
  share one limit of 50 across doctypes, so this pushed out one of the walk's own field reads.
- An element handle from Playwright's `page.waitForSelector` keeps its whole DOM tree alive
  until it is disposed. The first version of this walk measured about 2 MB per visit that
  was only this. The walk waits with locators instead.

## Run

Make the test data from the bench folder, run the walk, then delete the data:

```sh
bench --site crm.localhost execute "(__import__('runpy').run_path('apps/frappe/frontend/walks/cacheMemoryData.py', init_globals={'ACTION': 'create'}), None)[1]"
BASE_URL=http://crm.localhost:8019 RUNS=2 FEED=0 yarn --cwd frontend/walks memory --json /tmp/memory.json
BASE_URL=http://crm.localhost:8019 RUNS=2 FEED=1 yarn --cwd frontend/walks memory --json /tmp/memory-feed.json
bench --site crm.localhost execute "(__import__('runpy').run_path('apps/frappe/frontend/walks/cacheMemoryData.py', init_globals={'ACTION': 'delete'}), None)[1]"
```

`ACTION` is `create`, `delete` or `count`. The data script makes 51 large Sales Invoices, 420
one-row Sales Invoices in 21 list groups and 51 more for field reads, the same shape of ToDos,
100 items, a customer and three tax accounts. Every record carries the text
`cache-memory-research`, or a `CMR` name, so `delete` finds them again. It also deletes their
comments and their Deleted Document rows. It needs a company with a receivable and an income
account; it uses `Xamper` unless `cache_memory_company` is set in the site config.

| Variable | Default | Meaning |
| --- | --- | --- |
| `BASE_URL` | `http://localhost:8000` | The site |
| `FEED` | `1` | `0` leaves the Activity tab closed |
| `RUNS` | `1` | How many times to run each case |
| `CASE` | both | `Sales Invoice` or `ToDo` |
| `SNAPSHOT_DIR` | `/tmp/cache-memory` | Where heap snapshots are written; each is deleted after use |
| `KEEP_SNAPSHOTS` | unset | Keep the snapshots |

A Sales Invoice run takes about 5 minutes with `FEED=0` and 20 minutes with `FEED=1`. Each
heap snapshot file is about 0.5 GB while it exists.
