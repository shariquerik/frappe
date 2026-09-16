# Every v1 call the desk sends, and its v2 route

Research for [frappe/frappe#42921](https://github.com/frappe/frappe/issues/42921), a ticket
of the map "Desk v2 — REST API v2 everywhere" (#42920). Read against `desk-v2` at
`71beab9bb05` and frappe-ui `1.0.0-beta.63` as installed in `frontend/node_modules`.

Paths below are relative to the frappe repo root, or to the frappe-ui package root where
they start with `frappe-ui/`.

## Summary

1. Every dotted RPC the desk sends already has a v2 route by construction:
   `/api/v2/method/<dotted.path>` runs the same whitelisted function with the same
   `form_dict` (`frappe/api/v2.py:46-71`, rule at `:627`). The only thing that changes is
   the envelope: the return value moves from `message` to `data`, and errors move from
   `exc_type` / `exc` / `_server_messages` to an `errors` array (see "The envelope").
2. Keys a method writes onto `frappe.response` itself (`docs`, `docinfo`, `_link_titles`,
   `user_settings`, `parent_dt`) ride through both versions unchanged, because `as_json`
   dumps the whole `frappe.local.response` (`frappe/utils/response.py:148-158`) and the v2
   handler only adds `data` (`frappe/api/__init__.py:63-64`). So `getdoc` and
   `getdoctype` on `/api/v2/method/…` answer with `docs` and no `data` at all.
3. The document routes (`/document/…`, `/doctype/…/meta`, `/doctype/…/count`) replace
   five v1 targets, but not one for one: `read_doc` has no docinfo, no link titles, no
   `onload` and no "seen"/"viewed" side effects; `get_meta` returns one doctype, not the
   child-table bundle; `document_list` has no `or_filters` and treats `limit=0` as zero
   rows, not unlimited; PATCH detects a timestamp conflict only if `modified` is in the
   body.
4. frappe-ui `call()` and `createResource` cannot be pointed at v2 as they are. A leading
   `/` does skip the `/api/method/` prefix (`frappe-ui/src/utils/frappeRequest.ts:115-117`),
   but the function then returns `data.message` (`:168`) and parses only v1 error keys
   (`:190-213`). Nothing in `setConfig` changes that. The v2-native primitives are
   `useCall`, `useList`, `useDoc`, `useDoctype` and `useNewDoc` under
   `frappe-ui/src/data-fetching/`, which read `data.data` and the `errors` array.
5. Uploads: `/api/v2/method/upload_file` exists (`frappe/api/v2.py:624`), but every upload
   helper in frappe-ui and in `ui/src` reads `message.file_url` or `r.message || r`, so a
   v2 upload returns an object whose `file_url` is `undefined`.
6. No desk call site uses `/api/resource` or `/api/v1`; the bare `add_comment` the ticket
   names is not sent anywhere in production code (one commented example in a story).

## The envelope: v1 and v2 side by side

`get_api_version()` is decided by the request path (`frappe/api/__init__.py:104-110`), so
a dotted method behind `/api/v2/method/` gets the v2 envelope in full.

| Concern | v1 (`/api/method`, `/api/resource`) | v2 (`/api/v2/…`) | Source |
|---|---|---|---|
| Return value | `message` | `data` | `frappe/handler.py:59`; `frappe/api/__init__.py:63` |
| Keys the method sets on `frappe.response` (`docs`, `docinfo`, `_link_titles`, …) | as set | as set (no `data` if the method returns `None`) | `frappe/utils/response.py:148-158` |
| Exception | `exc_type` (class name), `exception` (last traceback line, dev only), `exc` (JSON string of tracebacks) | `errors: [{type, exception?, …}]`; the matching `msgprint` (title, message, indicator) is merged into the same entry | `frappe/utils/response.py:38-66`, `:80-88` |
| `msgprint` log | `_server_messages`: JSON string of JSON strings | `messages`: plain list of dicts | `frappe/utils/response.py:191-221` |
| `frappe.flags.error_message` | `_error_message` | not emitted | `:210-211` |
| Debug log | `_debug_messages` | `debug: [{message}]` | `:208`, `:220-221` |
| HTTP status | from `frappe.response.http_status_code` | same | `:152-154` |
| Bare method names (`logout`, `upload_file`) | resolved from `frappe.handler` globals with a deprecation warning | only the names with their own rule: `login`, `logout`, `ping`, `upload_file`, `bulk_delete`, `bulk_update`, `run_doc_method`; anything else fails in `frappe.get_attr` | `frappe/handler.py:283-295`; `frappe/api/v2.py:621-632` |
| Verb | `POST` by convention; whitelist `methods=` enforced | same enforcement (`is_valid_http_method`) | `frappe/api/v2.py:69` |
| Doctype controller RPC | none | `/method/<doctype>/<method>` expands to the controller module | `frappe/api/v2.py:49-52`, `:633` |

## What frappe-ui beta.63 sends and expects

Version confirmed at `frappe-ui/package.json:3`. The package ships TypeScript `src/`.

### `call()` and `createResource` (the v1 family)

| Question | Answer | Source |
|---|---|---|
| URL from a method name | prefixed with `/api/method/` unless the string starts with `/` or an `http(s)://` scheme; so `call("/api/v2/method/x")` sends to v2 | `frappe-ui/src/utils/frappeRequest.ts:115-117` |
| Verb | `call` is always `POST`, args as JSON body; `createResource` passes `method` through (`GET` puts params in the query string) | `frappe-ui/src/utils/call.ts:28-51`; `frappe-ui/src/utils/request.ts:36-52` |
| Headers | `Accept`, `Content-Type: application/json`, `X-Frappe-Site-Name`, `X-Frappe-CSRF-Token` from `window.csrf_token` | `frappe-ui/src/utils/frappeRequest.ts:92-110` |
| What it resolves to | the whole body if `docs` is present or the URL is a login URL, otherwise `data.message`; on v2 that is `undefined` | `frappe-ui/src/utils/frappeRequest.ts:137-168` |
| Errors | HTTP status only; reads `exc_type`, `exc`, `_server_messages`, `_error_message`; never reads `errors` | `frappe-ui/src/utils/frappeRequest.ts:169-216` |
| `createResource` fetcher | `options.resourceFetcher`, else `setConfig("resourceFetcher")`, else the raw `request` (no prefix, GET, whole body) | `frappe-ui/src/resources/resources.js:57-58` |
| Desk's global setting | `setConfig("resourceFetcher", frappeRequest)` | `frontend/src/main.ts:21` |
| `createListResource` targets | `frappe.client.get_list`, `frappe.client.insert`, `frappe.client.set_value`, `frappe.client.delete`, `run_doc_method`; sends both `start`/`limit` and `limit_start`/`limit_page_length`; expects a bare array; `hasNextPage = data.length >= pageLength` | `frappe-ui/src/resources/listResource.js:27-35`, `:57-85` |
| `createDocumentResource` targets | `frappe.client.get` (GET), `frappe.client.set_value`, `frappe.client.delete`, `run_doc_method` | `frappe-ui/src/resources/documentResource.js:27-33`, `:77-78` |
| `setConfig` keys | `systemTimezone`, `localTimezone`, `maxFileSize`, `resourceFetcher`, `defaultDocGetUrl`, `defaultDocInsertUrl`, `defaultDocUpdateUrl`, `defaultDocDeleteUrl`, `defaultRunDocMethodUrl`, `defaultListUrl`, `fallbackErrorHandler`, `serverMessagesHandler`, `requestBaseUrl`, `requestHeaders` | `frappe-ui/src/utils/config.ts:3-38` |
| A v2 prefix or version key | none. `default*Url` retargets the v1 resources' method names, but they still read `message` and a bare array | `frappe-ui/src/utils/config.ts` (whole file) |

Conclusion: `call()` and `createResource` reach v2 URLs but cannot read v2 answers. Moving a
`call` to v2 means moving it to `useCall` (or a desk wrapper over `fetch`), not changing
its URL string.

### `useCall`, `useList`, `useDoc` and friends (the v2 family)

All go through `useFrappeFetch` (`frappe-ui/src/data-fetching/useFrappeFetch.ts:60`): same
headers as above (`:163-185`), reads `errors[0]` into a `FrappeResponseError`
(`:105-159`), and pushes any `docs` in the body into the doc and list stores (`:81-104`).
`requestBaseUrl` and `requestHeaders` from `setConfig` are not consulted here; each
composable takes its own `baseUrl` option.

| Composable | Sends | Expects | Source |
|---|---|---|---|
| `useCall({url, method, params})` | `${baseUrl}${url}` verbatim, `GET` by default, params in the query string for GET and the body otherwise | `data.data` | `frappe-ui/src/data-fetching/useCall/useCall.ts:35-106`, `:153-173` |
| `useList({doctype, fields, filters, orderBy, start, limit, groupBy, parent})` | `GET /api/v2/document/<doctype>?fields=<json>&filters=<json>&order_by&start&limit&group_by&parent`; `url` option replaces the path | `data.data` (rows) and `data.has_next_page`; falls back to `rows.length >= limit`; no count call, no header read | `frappe-ui/src/data-fetching/useList/useList.ts:52-65`, `:308-318`; `types.ts:41-42` |
| `useList` writes | `insert` POST `/api/v2/document/<dt>`; `setValue` PUT `/api/v2/document/<dt>/<name>`; `delete` DELETE same | the returned doc under `data` | `useList.ts:177-178`, `:199-200`, `:228-229` |
| `useDoc({doctype, name})` | `GET /api/v2/document/<dt>/<name>`; `url` option replaces the path; `setValue` PUT, `delete` DELETE, `methods` POST `/api/v2/document/<dt>/<name>/method/<m>` | `data.data`; nothing in the package reads `docinfo` | `frappe-ui/src/data-fetching/useDoc/useDoc.ts:61-66`, `:86-107`, `:134-170` |
| `useDoctype(doctype)` | `runMethod` POST `/api/v2/method/<doctype>/<method>`; `runDocMethod` POST `/api/v2/document/<dt>/<name>/method/<m>`; `insert`/`setValue`/`delete` as above; no `url` option | `data.data` | `frappe-ui/src/data-fetching/useDoctype/useDoctype.ts:35-149` |
| `useNewDoc(doctype, doc)` | POST `/api/v2/document/<dt>` with the doc as body | created doc under `data` | `frappe-ui/src/data-fetching/useNewDoc/useNewDoc.ts:29-39` |

There is no `useCount` and no `useDocinfo`.

### Upload helpers

| Helper | URL | Reads | Source |
|---|---|---|---|
| `useFileUpload` (frappe-ui) | `options.upload_endpoint \|\| '/api/method/upload_file'`, XHR POST multipart | `r.message \|\| r` | `frappe-ui/src/utils/useFileUpload.ts:205-215`, `:257-263` |
| `FileUploadHandler` (frappe-ui) | same | same | `frappe-ui/src/utils/fileUploadHandler.ts:91-99`, `:134-140` |
| `ui/src` chunked path | hard-coded `/api/method/upload_file` | `JSON.parse(xhr.responseText)?.message?.file_url`; errors from `_server_messages` and `_error_message` | `ui/src/components/FileUpload/useFileUpload.ts:143-200` |

On v2 the File document sits under `data`, so `r.message || r` yields the envelope and
`.file_url` is `undefined`. The `upload_endpoint` option changes the URL but not the parse.

## The table: one row per distinct v1 target

Columns: the v1 target as sent today; where it is sent; the v2 route; and what a caller
must absorb beyond the envelope change in the table above ("envelope only" means: read
`data` instead of `message`, and errors from `errors[0]`).

### Document, meta, list and count (the routes v2 has as document APIs)

| v1 target | Call sites | v2 route | What the caller must absorb |
|---|---|---|---|
| `frappe.desk.form.load.getdoc` (GET, `doctype`, `name`; reads `docs[0]`, `docinfo`, `_link_titles`) | `frontend/src/pages/Record.vue:336-350` | `GET /api/v2/document/<dt>/<name>` (`read_doc`, `frappe/api/v2.py:84-95`) **for the document only**; or `GET /api/v2/method/frappe.desk.form.load.getdoc` for the same answer as today | `read_doc` returns `doc.as_dict()` under `data` and nothing else: no `docinfo`, no `_link_titles` (`frappe/desk/form/load.py:563-568`), no `run_onload` (so no `__onload`), no `add_viewed`/`add_seen` (`:47-56`). It also casts integer Link values to strings (`v2.py:90-93`). Via `/method/`, the body is `{docs, docinfo, _link_titles}` with no `data` (getdoc returns `None`); a 404 today is an empty `docs` list, not a status. The map's open question (second call, `include`, or `/method/`) stands; the facts are: docinfo has no document route, and `get_docinfo` puts its answer under `docinfo`, never under `data` (`load.py:142`). |
| `frappe.desk.form.load.get_docinfo` (GET, `doctype`, `name`; reads `docinfo`) | `frontend/src/pages/Record.vue:352-368`; `frontend/src/pages/record/liveDocinfo.ts:43-51` | `GET /api/v2/method/frappe.desk.form.load.get_docinfo` | No document route. Answer rides in `docinfo`, `data` absent. `useCall` would report `data: null`; a fetch wrapper reads `body.docinfo` as today. |
| `frappe.desk.form.load.getdoctype` (`doctype`, `with_parent: 1`; reads `docs[]` by name, `fields`, `permissions`, `title_field`) | `ui/src/composables/useDoctypeMeta.ts:82-110`; `ui/src/components/DataImport/DataImport.vue:97-106`; `ui/src/components/DataImport/TemplateModal.vue:92-101` | `GET /api/v2/doctype/<dt>/meta` (`get_meta`, `v2.py:245-247`) or `GET /api/v2/method/frappe.desk.form.load.getdoctype` | `get_meta` returns `frappe.get_meta(doctype)`, serialised through `__json__` → `as_dict(no_nulls=True)` (`frappe/model/base_document.py:279-280`): fields, permissions, custom fields and property setters are applied, and `title_field` is there. Missing against `getdoctype`: the child-table doctypes bundled in the same `docs` list (`load.py:82-90`, one extra request per Table field on v2), `user_settings` and `parent_dt` (`:72-77`, neither read by the desk), and FormMeta's `__js`/`__css`/`__list_js` assets (`frappe/desk/form/meta.py:15-28`, not read by the desk either). `useDoctypeMeta` indexes `res.docs` by `d.name`, so the child bundle is the one real gap. `with_parent` has no v2 equivalent. `get_meta` needs a logged-in user (`frappe.only_for("All")`). Via `/method/`, the body is `{docs, user_settings}` with no `data`. |
| `frappe.client.save` (POST `{doc}`; reads `message` as the saved doc, `exc_type === "TimestampMismatchError"`, `_server_messages[0]`) | `frontend/src/pages/Record.vue:491-500`; `frontend/src/pages/record/saveResponse.ts` | `PATCH` or `PUT /api/v2/document/<dt>/<name>` with the document as body (`update_doc`, `v2.py:223-236`); or `POST /api/v2/method/frappe.client.save` | Semantics match if the whole document is sent: `doc.update(data)` empties and refills every child table present in the body (`frappe/model/base_document.py:314-340`), the same rows `frappe.client.save` would write. Conflict detection: `set_user_and_timestamp` copies `self.modified` (now the client's value) into `_original_modified` (`frappe/model/document.py:1052-1055`) and `check_if_latest` compares it with the row (`:1404-1409`), so a stale `modified` raises `TimestampMismatchError` exactly as today. If `modified` is not in the body, no conflict is ever detected. The error arrives as `errors[0].type === "TimestampMismatchError"` with the msgprint merged into the same entry (`response.py:56-60`, `:80-88`); `saveResponse.ts` reads `exc_type` and `_server_messages` and must change either way. `update_doc` drops a `flags` key and returns the saved doc under `data`, unlike v1's `PUT /resource` which returned the Document object. New documents go to `POST /api/v2/document/<dt>` (`create_doc`, `:200-209`). |
| `frappe.client.get_list` (POST; `fields`, `filters`, `or_filters`, `order_by`, `limit_page_length`, `limit_start`; reads a bare array) | `frontend/src/pages/record/panel/remoteSearch.ts:62-78` (User picker, uses `or_filters`); `ui/src/components/InviteUser/useInviteUser.ts:46-56` (`limit_page_length: 0`), `:61-71` (`or_filters`); `ui/src/components/Notifications/useNotifications.ts:72-76`; and via `createListResource` at `ui/src/components/ListView/useListData.ts:46-52`, `ui/src/components/Notifications/useNotifications.ts:37-56`, `ui/src/components/DataImport/DataImport.vue:80-95` | `GET /api/v2/document/<dt>?fields=[…]&filters=…&order_by=…&start=…&limit=…&group_by=…` (`document_list`, `v2.py:98-189`); this is what `useList` already sends | Parameter names: `start`/`limit`, not `limit_start`/`limit_page_length`; `fields` must be a JSON list (`:147-148`); `filters` may be a dict or a list. Rows come under `data` with `has_next_page` beside them (`:188-189`). **No `or_filters`** (`:137-145`), so the two "name or full_name like" searches have no document route; `/api/v2/method/frappe.client.get_list` keeps them. **`limit=0` returns zero rows** (`limit + 1` fetched, `data[:0]` returned, `:162`, `:189`), where `limit_page_length=0` meant "all"; the invite dialog's already-invited list relies on that. A controller's static `get_list(query)` hook applies only on v2 (`:167-185`). `parent` and `expand` are not accepted. |
| `frappe.client.get_count` (POST `{doctype, filters, limit: 1001}`; reads a number or `null`) | `frontend/src/list/useListRows.ts:152-158`; `ui/src/components/ListView/useListData.ts:56-72`; `ui/src/components/Notifications/useNotifications.ts:102-109` | `GET /api/v2/doctype/<dt>/count?filters=<json>&limit=1001` (`count`, `v2.py:192-197`) | Same implementation underneath (`frappe.desk.reportview.get_count`, `frappe/client.py:77-90`), which reads `filters`, `limit` and `distinct` from `form_dict` and parses JSON strings itself (`frappe/desk/reportview.py:60-100`, `:295-303`). The number is under `data`; a statement timeout still answers `null` (`:93-96`), so `useListRows`' "null means more than the bound" logic holds. `cache` is v1-only and unused. |
| `frappe.client.get_value` (`doctype`, `filters: name`, `fieldname`; reads `data[field]`) | `ui/src/components/FormLayout/resolveCurrency.ts:51-56` | `GET /api/v2/method/frappe.client.get_value`, or `GET /api/v2/document/<dt>/<name>` and pick the field | Envelope only via `/method/`. The document route returns the whole document with field-level read permissions applied, one round trip either way. |
| `frappe.client.insert` via `createListResource.insert` (`{doc: {doctype, …}}`; reads `data.name`) | `ui/src/components/DataImport/DataImportList.vue:134-155`; `ui/src/components/DataImport/UploadStep.vue:263-290` | `POST /api/v2/document/<dt>` with the fields as body (`create_doc`, `v2.py:200-209`); `useList().insert` or `useNewDoc` | Body is the flat field dict, not `{doc: …}`; the created doc returns under `data`. |
| `frappe.client.set_value` via `createListResource.setValue` (`{doctype, name, fieldname: {…}}`; reads the updated doc) | `ui/src/components/DataImport/UploadStep.vue:294-315`; `ui/src/components/DataImport/MappingStep.vue:100-121`, `:157-178` | `PUT /api/v2/document/<dt>/<name>` with the changed fields as body (`update_doc`); `useList().setValue` | Body is the flat field dict. Both save the parent when the target is a child row. |
| `frappe.client.delete` (POST `{doctype, name}`; response discarded) | `frontend/src/pages/record/builtinActions.ts:78`; `useListRows` already uses `useList().delete` at `frontend/src/list/useListRows.ts:188` | `DELETE /api/v2/document/<dt>/<name>` (`delete_doc`, `v2.py:239-242`) | Same `frappe.client.delete_doc` underneath (child rows removed through the parent, `frappe/client.py:551-575`). v2 answers `202` with `data: "ok"`; v1 answered nothing. |

### Search, upload, boot, session

| v1 target | Call sites | v2 route | What the caller must absorb |
|---|---|---|---|
| `frappe.desk.search.search_link` (POST `doctype`, `txt`, `filters`; reads rows' `value`, `label`, `description`) | `ui/src/components/Link/Link.vue:105-120`; `ui/src/components/Filter/MultiLinkInput.vue:53-64`; `ui/src/components/TableMultiSelect/TableMultiSelect.vue:108-115` | `/api/v2/method/frappe.desk.search.search_link` (GET or POST) | Envelope only: the list of `{value, label, description}` sits under `data` (`frappe/desk/search.py:61-84`). The `http_cache` decorator sets `Cache-Control` only on a GET whose path contains the qualified name (`frappe/utils/caching.py:249-253`), which a v2 GET satisfies; today's POSTs get no caching. |
| `upload_file` (bare; XHR multipart POST; reads `message.file_url`, errors from `_server_messages`) | `ui/src/components/FileUpload/useFileUpload.ts:62-72`, `:143-200`; `ui/src/components/DataImport/UploadStep.vue:224-251`; `frontend/src/pages/record/panel/RecordImage.vue:121-133` | `POST /api/v2/method/upload_file` (own rule, `v2.py:624`, same `frappe.handler.upload_file`) | Same multipart fields; the File document returns under `data`. Every helper reads `message` (see "Upload helpers"), so each needs a v2 reader; the chunked path in `ui/src` also parses `_server_messages` for its error text. |
| `frappe.shell.boot.get_boot` (GET `?path=`; reads `message`; 401/403 → unauthorized screen) | `frontend/src/boot.ts:90-106` | `GET /api/v2/method/frappe.shell.boot.get_boot?path=…` | Envelope only; status handling unchanged. `csrf_token` still comes from the boot body (`frappe/shell/boot.py:140-181`). |
| `frappe.shell.doctypes.get_addresses` (GET `?v=`) | `frontend/src/addresses.ts:77-84` | `GET /api/v2/method/frappe.shell.doctypes.get_addresses?v=…` | Envelope only; the one-year `Cache-Control` still applies on a v2 GET (`frappe/shell/doctypes.py:101-103`). |
| `frappe.shell.doctypes.get_contents` (GET `app`, `module`) | `frontend/src/contents.ts:18-22` | `GET /api/v2/method/frappe.shell.doctypes.get_contents` | Envelope only. |
| `frappe.translate.get_boot_translations` (GET `lang`, `v`) | `frontend/src/i18n.ts:7-14` | `GET /api/v2/method/frappe.translate.get_boot_translations` | Envelope only; whitelisted GET-only with a one-year cache (`frappe/translate.py:138-139`). |
| `logout` (bare, POST) | `frontend/src/shell/session.ts:7` | `POST /api/v2/method/logout` (own rule, `v2.py:622`) | Nothing to absorb; both return no body value. The desk then navigates to `/login`. |

### Record page actions (dotted RPC, all through `page.call` → frappe-ui `call`)

Every row: `POST /api/v2/method/<same dotted name>`, envelope only. The response is
discarded and the panel re-reads docinfo, so only the error shape matters (toasts read
frappe-ui's `error.messages`, which v2 will not fill through `call`).

| v1 target | Call sites | Note |
|---|---|---|
| `frappe.desk.doctype.favourite.favourite.toggle_favourite` (`doctype`, `name`, `add`) | `frontend/src/pages/Record.vue:312-316` | `frappe/desk/doctype/favourite/favourite.py:68-69` |
| `frappe.desk.form.assign_to.add` / `.remove` | `frontend/src/pages/record/panel/peopleActions.ts:22-24` | |
| `frappe.share.add` / `.set_permission` | `peopleActions.ts:26-36` | |
| `frappe.desk.doctype.tag.tag.add_tag` / `.remove_tag` (`tag`, `dt`, `dn`) | `peopleActions.ts:38-40` | `frappe/desk/doctype/tag/tag.py:38-64` |
| `frappe.desk.doctype.tag.tag.get_tags` (`doctype`, `txt`; reads `string[]`) | `frontend/src/pages/record/panel/remoteSearch.ts:87-90` | `tag.py:73-74` |
| `frappe.custom.doctype.client_script.client_script.get_client_scripts` (`dt`, `view`; reads `can_write`, `scripts[]`) | `frontend/src/recordPage/clientScripts.ts:108` | |
| `frappe.desk.doctype.form_layout.form_layout.get_form_layouts` (`dt`, `type`; reads `layouts`, `fallback`) | `frontend/src/recordPage/formLayoutSource/useFormLayout.ts:119-125` | via `createResource` with `frappeRequest` |
| `frappe.desk.customization_error.report_customization_error` (fire and forget) | `frontend/src/recordPage/reportError.ts:52-61` | |
| `add_comment` | not sent anywhere in production; one commented example at `ui/src/components/Composer/stories/Composer.story.vue:125` | The bare name has no v2 rule; the dotted `frappe.desk.form.utils.add_comment` (`frappe/desk/form/utils.py:26-30`) does. |

### Shell, list settings, arrangement

All `POST /api/v2/method/<same dotted name>`, envelope only.

| v1 target | Call sites | Reads |
|---|---|---|
| `frappe.shell.arrangement.get_arrangement` / `save_arrangement` / `reset_arrangement` | `frontend/src/arrangement.ts:29-57` | the returned array or `Navigation` (`frappe/shell/arrangement.py:35-69`) |
| `frappe.desk.doctype.doctype_view.api.get` / `.save` / `.reset` | `frontend/src/list/useListSettings.ts:57-125` | `{site, user}` |

### `@framework/ui` components

All `POST /api/v2/method/<same dotted name>` unless noted, envelope only.

| v1 target | Call sites | Note |
|---|---|---|
| `frappe.core.doctype.user.user.get_current_user_roles` | `ui/src/composables/useUserRoles.ts:35-40` | `string[]` |
| `frappe.auth.get_logged_user` | `ui/src/components/Notifications/useNotifications.ts:188-192` | |
| `frappe.desk.doctype.notification_log.notification_log.mark_as_read` / `.mark_all_as_read` / `.trigger_indicator_hide` | `useNotifications.ts:141-154` | responses ignored |
| `frappe.desk.form.activity.get_activity_timeline` / `.get_more_email_activities` / `.get_more_milestone_activities` | `ui/src/components/ActivityTimeline/useActivityTimeline.ts:44-166` | reads `activities`, `has_more_emails`, `has_more_milestones`, `next_milestone_start` from the returned dict |
| `frappe.core.api.user_invitation.get_pending_invitations` (GET) / `.invite_by_email` / `.cancel_invitation` (PATCH) / `.resend_invitation` | `ui/src/components/InviteUser/useInviteUser.ts:36-102` | the PATCH stays valid only if the whitelist allows it; `is_valid_http_method` is enforced on both versions |
| `frappe.core.doctype.data_import.data_import.get_preview_from_template` / `.form_start_import` / `.get_import_logs` | `ui/src/components/DataImport/dataImport.ts:51-61`; `PreviewStep.vue:289-301` | |
| `frappe.core.doctype.data_import.data_import.download_template` (GET, reads a blob) | `ui/src/components/DataImport/UploadStep.vue:320-341`; `TemplateModal.vue:170-190` | The method sets `frappe.response.type = "download"`; `build_response` honours that before the JSON default (`frappe/utils/response.py:93-108`), so a v2 GET still streams the file. |
| `frappe.onboarding.get_onboarding_status` / `.update_user_onboarding_status` | `ui/src/components/Onboarding/onboarding.ts:45-53`, `:143-146` | |
| `frappe.utils.telemetry.pulse.client.boot_config` | `ui/src/telemetry/pulse.ts:59` | |
| `frappe.integrations.frappe_providers.frappecloud_billing.current_site_info` | `ui/src/components/TrialBanner/TrialBanner.vue:49-59` | |

### Already on v2

| Call | Where | Sends and reads |
|---|---|---|
| `useList` rows | `frontend/src/list/useListRows.ts:193-203` | `GET /api/v2/document/<dt>` with `fields`, `filters`, `orderBy`, `start`, `limit`; reads `page.data`, `page.hasNextPage`, `page.error`; `page.delete.submit({name})` sends `DELETE /api/v2/document/<dt>/<name>` |

### Not HTTP API calls

`frontend/src/icons/sprite.ts:21-34` fetches a static SVG under `/assets/`;
`frontend/src/shell/socket.ts` opens socket.io; `ui/src/telemetry/pulse.ts:94` imports a
script from the Pulse CDN. None of these is a v1 route.

## Where v2 has no route, and what the gap is

| Need | Gap | Options the facts allow |
|---|---|---|
| Docinfo with the document | `read_doc` is the document alone; `get_docinfo` answers under `docinfo`, not `data`, and has no document route | A second call through `/api/v2/method/frappe.desk.form.load.get_docinfo` read from `body.docinfo`; or `/api/v2/method/frappe.desk.form.load.getdoc` read from `docs`/`docinfo`/`_link_titles`; or v2 grows an `include` on `read_doc` (framework surface, goes to `develop`). |
| Link titles, `onload`, seen/viewed | only `getdoc` produces them | Same three options. |
| Meta bundle with child doctypes | `get_meta` is one doctype | One `/doctype/<child>/meta` per Table field, or `/api/v2/method/…getdoctype` read from `docs`, or v2 grows a bundle. |
| `or_filters` in a list | `document_list` does not accept it | `/api/v2/method/frappe.client.get_list` for the two pickers, or v2 grows `or_filters`. |
| "All rows" (`limit_page_length: 0`) | `limit=0` returns nothing | Send a large `limit`, or `/api/v2/method/frappe.client.get_list`. |
| Bare `add_comment` | no rule; `frappe.get_attr("add_comment")` fails | Use the dotted name; nothing sends the bare one today. |
| frappe-ui `call`/`createResource` on v2 | they read `message` and v1 error keys | `useCall` for RPC; `useList`/`useDoc`/`useNewDoc` for documents; a desk `fetch` wrapper for `getdoc`-style bodies without `data`. This is a frappe-ui gap only if `call` must learn v2; the v2 primitives exist. |
| Uploads through frappe-ui | helpers read `message.file_url` | A v2 reader in the `UploadTransport` seam (`ui/src/components/FileUpload/useUploader.ts:29-35`), or `upload_endpoint` plus a parse fix upstream. |
| Count under `useList` | `useList` never counts | `useCall({url: '/api/v2/doctype/<dt>/count', params: {filters, limit}})`. |

## Sources

- `frappe/api/__init__.py`, `frappe/api/v1.py`, `frappe/api/v2.py` (`frappe/api/utils.py`
  is empty on this branch)
- `frappe/handler.py`, `frappe/utils/response.py`, `frappe/utils/caching.py`
- `frappe/desk/form/load.py`, `frappe/desk/form/meta.py`, `frappe/desk/reportview.py`,
  `frappe/desk/search.py`, `frappe/client.py`, `frappe/model/base_document.py`,
  `frappe/model/document.py`, `frappe/shell/boot.py`, `frappe/shell/doctypes.py`,
  `frappe/shell/arrangement.py`, `frappe/translate.py`
- Call sites under `frontend/src` and `ui/src` as cited per row (test files and stories
  excluded; `frontend/node_modules` read from the shared bench checkout)
- frappe-ui `1.0.0-beta.63`: `src/utils/call.ts`, `src/utils/frappeRequest.ts`,
  `src/utils/request.ts`, `src/utils/config.ts`, `src/utils/useFileUpload.ts`,
  `src/utils/fileUploadHandler.ts`, `src/resources/*.js`, `src/data-fetching/**`
