# Does frappe-ui rc.1 ship a cache desk v2 can use for records and lists?

Research for frappe/frappe#43277, a child of the map frappe/frappe#43276 ("Desk v2 — return visits paint at once").

## Verdict

**Build the cache in `@framework/ui`.** No frappe-ui rc.1 helper meets the map's rulings. Each one writes to IndexedDB, none evicts, and the list and the document helpers keep separate copies of a document. The newer helpers also cannot call desk v2's API wrapper. Two ideas in frappe-ui are worth copying into the new cache (see "What to borrow").

## Sources

- frappe-ui `1.0.0-rc.1`, the version desk v2 pins (`frontend/package.base.json` line 29, `frontend/yarn.lock.base` line 1980 on `upstream/desk-v2` at `b6d4aa89af`). Read from the installed copy at `apps/frappe/frontend/node_modules/frappe-ui`, whose `package.json` says `1.0.0-rc.1`. Every path below is relative to that package.
- Desk v2's API wrapper: `ui/src/api/request.ts` and `ui/src/api/index.ts` on `upstream/desk-v2` at `b6d4aa89af`.
- CRM's newer frontend: `frontend2/src/data/cache/queryCache.ts` on `feat/crm-frontend2` of frappe/crm.

The map's rulings this is checked against: one shared in-memory cache for records and lists (ruling 2), in memory only, so a reload starts cold (ruling 3), no age limit and a bound by entry count, least recently used dropped first (ruling 6), saved data only (ruling 7).

## 1. The data helpers and their caches

frappe-ui rc.1 has two generations of helpers. Both are exported from the package root (`src/index.ts` lines 13 and 16).

| Helper | Cache option | Where it stores | Key | Eviction |
| --- | --- | --- | --- | --- |
| `createResource` (old) | `cache:` | A module object `cached` (`src/resources/resources.js:7`) plus IndexedDB through `idb-keyval` (`src/resources/local.ts:1-24`, written at `resources.js:112`) | `JSON.stringify` of the `cache` value (`resources.js:224-232`) | None. Never removed from memory or IndexedDB. |
| `createListResource` (old) | `cache:` | A reactive `listCache` object (`src/resources/listResource.js:8`) plus IndexedDB (`listResource.js:84`, read at 280-285) | Same `getCacheKey` | None. |
| `createDocumentResource` (old) | Always on, no option | A reactive `documentCache` object (`src/resources/documentResource.js:13`) plus IndexedDB (`documentResource.js:86`, read at 282-286) | `[doctype, name]` (`documentResource.js:18`) | None. Removed from IndexedDB only on a fetch error (line 92). |
| `useCall` (new) | `cacheKey` | IndexedDB through `idbStore` (`src/data-fetching/useCall/useCall.ts:125-128`, read at 314-320). Memory is used only when the browser has no IndexedDB (`src/data-fetching/idbStore.ts:8`, 17-20). | `["useCall", ...cacheKey]` (`src/data-fetching/utils.ts:62-76`) | None. |
| `useList` (new) | `cacheKey` | IndexedDB through `idbStore` (`src/data-fetching/useList/useList.ts:333-337`, read at 128-134). Rows live per instance in `allData` (line 72). | `["useList", ...cacheKey]` | None. |
| `useDoc` (new) | Always on, no option | The shared `docStore`: a `Map` of one Vue ref per document (`src/data-fetching/docStore.ts:12`, 30), mirrored to IndexedDB under `doc:<doctype>/<name>` (lines 27, 84) | `<doctype>/<name>` (`src/data-fetching/writeGate.ts:122-124`) | None by count. A 5-minute timer (`docStore.ts:26`, 225-229) only deletes the IndexedDB copy (lines 161-168); the in-memory ref stays. |
| `useDoctype`, `useNewDoc`, `useAction`, `useIsolatedCall` (new) | `useIsolatedCall` takes `cacheKey` like `useCall` (`src/data-fetching/useIsolatedCall.ts:122`, 182, 293). The rest are writes with no read cache. | They write into `docStore` and `listStore` after a save (`useDoctype.ts:154-155`, `useNewDoc.ts:67`). | | |

Points that matter for the rulings:

- **Every helper writes to IndexedDB, and `useDoc` cannot be told not to.** Ruling 3 says the cache is in memory only. A copy saved in IndexedDB comes back after a reload, and after a logout: the keys carry no user, and nothing calls `docStore.clearAll()` (`docStore.ts:245-261`) on logout. `docStore` is not exported either (`src/data-fetching/index.ts` comment at lines 8-14), so desk v2 could not call it.
- **Nothing is bounded by entry count.** Ruling 6 asks for a limit with least recently used dropped first. No helper has one.
- **`listStore` never lets go of a list.** `useList` registers itself (`useList.ts:276`, `src/data-fetching/useList/listStore.ts:20-23`) and there is no remove call, so every list ever mounted keeps receiving row updates. The old `createListResource` does the same with `resourcesByDocType` (`listResource.js:292-293`).

## 2. Does a cached value paint before the refetch, and does the refetch land in one step?

| Helper | Paints from memory at once on a return visit | Refetch lands in one step |
| --- | --- | --- |
| `createResource` with `cache` | Yes. A second call with the same key returns the same object, data and all, and reloads it if `auto` (`resources.js:11-21`). | Yes: one assignment, `out.data = transform(data)` (`resources.js:113`). |
| `createListResource` with `cache` | Yes, same pattern (`listResource.js:17-25`). | Yes. `reload()` fetches every loaded row in one request (`listResource.js:214-229`) and `setData` replaces the array (235-250). |
| `createDocumentResource` | Yes, same pattern (`documentResource.js:18-25`). | Yes: `out.doc = transform(data)` (`documentResource.js:87`). |
| `useCall` with `cacheKey` | No. The copy is read from IndexedDB with a promise (`useCall.ts:314-320`), so the first render has no data. | Yes: the `data` computed switches from the cached copy to the response (`useCall.ts:292-312`). |
| `useList` with `cacheKey` | No. Same promise read (`useList.ts:128-134`); a new instance starts with `allData` empty (line 72), so the skeleton shows for at least one frame. | Yes for the first page: `allData` is replaced (`useList.ts:326-327`). A return visit that had loaded more pages gets only the first page back, since a new instance starts at `start` 0 (line 46). |
| `useDoc` | Yes, if the document was loaded earlier in the tab: the `doc` computed reads the store's ref (`useDoc.ts:210-229`, `docStore.ts:96-115`). On the first read of a key it also reads IndexedDB, which can paint a copy from an earlier session (`docStore.ts:107-109`, 170-178). | Yes: `publish` assigns the whole document to the ref in one step (`docStore.ts:44-55`). |

So the old helpers and `useDoc` do paint from memory and then refetch. `useList` and `useCall` do not, because their copy is only in IndexedDB.

## 3. Can a helper take a custom fetcher?

- **New helpers: no.** `useCall`, `useList`, `useDoc`, `useDoctype` and `useNewDoc` all go through `useFrappeFetch`, a `createFetch` from `@vueuse/core` over the browser's `fetch` (`src/data-fetching/useFrappeFetch.ts:83-99`). It is internal and not exported (`src/data-fetching/index.ts` lines 22-26). The only knobs are `baseUrl` and `url` (`useList.ts:62-65`, `useDoc.ts:83-88`).
- **Old helpers: yes, but they speak the v1 API.** `createResource` takes a `resourceFetcher` option or a global `setConfig('resourceFetcher')` (`resources.js:57-58`). The list and document resources build `frappe.client.get_list`, `frappe.client.get` and `frappe.client.set_value` parameters (`listResource.js:27-35`, 59-73; `documentResource.js:27-33`). A fetcher would have to translate those into `/api/v2` calls.

Desk v2's wrapper does things neither generation does:

| `@framework/ui/api` does | frappe-ui rc.1 |
| --- | --- |
| Rejects a 200 with no `data` and raises its own `ApiError` (`ui/src/api/request.ts:35-56`) | `useFrappeFetch` raises `FrappeResponseError` from `errors[0]` (`useFrappeFetch.ts:133-187`) |
| Saves with `PATCH` and refuses to save without `modified` (`ui/src/api/index.ts:145-160`) | `useDoc` and `useList` save with `PUT` (`useDoc.ts:177-190`, `useList.ts:198-213`) |
| Reads named parts beside `data` with `include` (`index.ts:98-107`) | `useDoc` keeps only `data` (`useDoc.ts:110-114`) |
| Reads `count` and `count_capped` from the list response (`index.ts:54-58`) | `useList` keeps only `data` and `has_next_page` (`useList.ts:308-317`) |

## 4. Do a list helper and a document helper share one copy of a document?

No, in either generation.

- **New:** `useList` keeps its rows in its own `allData` (`useList.ts:72`). Its GET does not write to `docStore` (`useList.ts:285-349`). After a save, `listStore.updateRow` copies the changed fields into each list's matching row (`listStore.ts:40-55`, `useList.ts:146-165`), and only fields the row already has. So the list and `useDoc` hold two copies that are kept in step on writes, not one copy. The one shared piece is the write gate (`writeGate.ts:60-110`): both stores ask it, so a stale response cannot overwrite a newer save in either.
- **Old:** `createListResource` keeps rows in `originalData`; `createDocumentResource` keeps `doc`. A save on the document copies its fields into list rows (`documentResource.js:47-52`, `listResource.js:303-323`).

## 5. CRM's newer frontend cache, compared

`frontend2/src/data/cache/queryCache.ts` on `feat/crm-frontend2`:

- A plain `Map` in memory, capped at 20 entries (line 1) with a 5-minute age limit (line 3). Nothing goes to IndexedDB.
- A write moves the key to the end and drops the oldest (lines 28-33). A read does not move it (lines 22-26), so the order is "least recently written", not "least recently used".
- Two separate caches, `docCache` and `listCache` (lines 60, 86). A document on the record page and the same document as a list row are two copies.
- Invalidation by tag: `invalidate(tag)` drops every entry written with that tag (lines 49-52); the tag is the caller's choice.
- `fetchCached` paints the cached answer with `resource.setData`, then fetches (lines 66-77). It sits on top of frappe-ui's old `createResource`.

Against the rulings it is close on ruling 3 (memory only), but it has an age limit (ruling 6 says none), no shared copy (ruling 2) and recency by write only.

## What to borrow

- **`docStore`'s shape:** one reactive ref per `<doctype>/<name>`, and a whole document assigned in one step (`docStore.ts:44-55`). That gives rulings 2 and 8 for records.
- **The write gate** (`writeGate.ts`): each request takes a number when it is sent, and a response older than a save already applied to that document is dropped. The background refetch in ruling 2 needs exactly this, so a slow refetch cannot undo a save.
- **The old list resource's reload:** refetch every row the list has loaded in one request, then replace the array (`listResource.js:214-229`). That keeps a return visit showing the same number of rows.

## Gaps if desk v2 used frappe-ui as it is

1. Writes to IndexedDB with no opt-out on `useDoc` (breaks ruling 3; copies outlive a logout).
2. No entry-count bound anywhere (breaks ruling 6).
3. `useList` paints nothing on a return visit, because its copy is only in IndexedDB.
4. List rows and documents are separate copies (breaks ruling 2).
5. No way to call `@framework/ui/api`: no custom fetcher on the new helpers, and v1 parameters on the old ones.
6. `useList` drops `count`; `useDoc` drops `include` parts and saves with `PUT` instead of `PATCH`.
7. `listStore` and `resourcesByDocType` never release a list.
