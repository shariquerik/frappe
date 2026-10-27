# Merge to develop: client and `ui/` changes that desk v1 sees with desk v2 off

Ticket: frappe/frappe#45482. Map: frappe/frappe#45480 (ruling 3: with `enable_desk_v2` off, desk v1's UI and APIs do not change).

- **Range:** `MB..upstream/desk-v2`. `MB` is `git merge-base upstream/develop upstream/desk-v2` = `b9e4d35824` (2026-10-26). `upstream/desk-v2` = `8c96392df6`.
- **Notation:** `path:line@v2` is a line on `upstream/desk-v2`. `path:line@MB` is a line on the merge base.
- **Sources:** git objects only (`git show`, `git diff`, `git grep`). CRM and Insights were read from shallow clones of `frappe/crm@develop` (`bbca33d`) and `frappe/insights@develop` (`afb0d64`). Studio was built at both refs (see section (b)).

## (a) Desk v1 JS that changed

Only four v1 client files change. They are listed below. Nothing is added under `frappe/public/`. No `*.bundle.*` file is added anywhere. `esbuild/`, the root `package.json` and `yarn.lock`, `frappe/templates/`, `frappe/desk/form/meta.py` and `frappe/boot.py` do not change.

### a1. `frappe/public/js/frappe/form/form.js`: `docinfo_update` listener

The diff has two lines:

- `form.js:2551-2552@v2` returns early for `key` `tags` and `favourites`.
- `form.js:2558@v2` changes `if (action === "add")` to `if (action === "add" && docindex === -1)`.

This is needed because desk-v2 adds three new publishers of `docinfo_update` on the document's room. They run whether the setting is on or off.

- `TagLink.after_insert` / `on_trash` sends `key: "tags"` (`frappe/desk/doctype/tag_link/tag_link.py:34-56@v2`).
- `Favourite.after_insert` / `on_trash` sends `key: "favourites"` (`frappe/desk/doctype/favourite/favourite.py:26-38@v2`, a new DocType).
- `DocShare.after_insert` / `on_update` / `on_trash` sends `key: "shared"` (`frappe/core/doctype/docshare/docshare.py:84-119@v2`).

On `MB`, only Comment and Communication publish this event (`frappe/core/doctype/comment/comment.py:101@MB`, `communication.py:305@MB`).

What a v1 user sees with the setting off:

- **`tags`:** v1 keeps `docinfo.tags` as a string. Without the early return, `"…".findIndex` throws on every tag add or remove on an open form. With it, nothing happens. The tag pills are re-rendered by v1's own tag code, as on `MB`. **No change.**
- **`favourites`:** v1 has no `favourites` bucket, and the event is ignored. **No change.**
- **`shared`:** **This is a real change.** It is not filtered. Every open v1 form of the document now applies the share row to `frappe.model.docinfo[dt][dn].shared` and calls `this.timeline.refresh()` (`form.js:2570@v2`).
  - The sidebar share avatars do not re-render. `Share.refresh()` is not called, and it prefers `this.shared` when the dialog has been opened (`frappe/public/js/frappe/form/sidebar/share.js:13@MB`).
  - The timeline re-renders the same rows. A `Shared` comment is not in Comment's `key_map` (`comment.py:88-95@MB`), so the comment does not change the output.
  - The effect shows on the next `frm.refresh()`. `frappe.perm` reads `docinfo.shared` for share-granted rights (`frappe/public/js/frappe/model/perm.js:131-145@MB`). If a document is shared with, or unshared from, the viewing user while the form is open, the next refresh grants or drops `write`/`submit`/`share` without a reload. On `MB` these rights stayed stale until the user reloaded.
  - This is more correct, but it changes behaviour.
- **Dedupe (`docindex === -1`):** On `MB`, an `add` for a row that is already in the list pushes a duplicate. v1's own code never pushes into `docinfo.comments` / `communications` locally. The comment box relies on the socket only (`frappe/public/js/frappe/form/footer/footer.js:55-72@MB`). So a duplicate `add` comes only from a repeated socket message. The guard changes nothing in normal use.

Proposals:

- `tags` / `favourites` skip: **keep**. Without it, v1 throws on every tag change.
- Dedupe: **keep**. It is a no-op for v1's own event flow.
- `shared` live update: **fix** (strict ruling 3). Add `"shared"` to the skip list at `form.js:2552`. Alternatively, keep it and get an explicit owner ruling that "share rights update without reload" is an accepted v1 change. Today the spec `playwright/tests/form_docinfo_update.spec.js@v2` asserts that a `shared` add is applied once, so it pins the change in place. If the ruling is fix, that assertion becomes "the `shared` bucket is unchanged".
- **Test that proves v1 is unchanged:** extend `form_docinfo_update.spec.js` with a real share instead of a synthetic socket message.
  - Steps: open a ToDo as the Administrator, call `frappe.share.add` for another user over `api`, and wait for the socket.
  - Assert: no `pageerror`, `.form-sidebar .shares` DOM unchanged, timeline DOM unchanged, `frappe.model.docinfo.ToDo[name].shared` unchanged (fix) or extended once (keep).
  - Add the same check for `frappe.desk.doctype.tag.tag.add_tag`: the tag pills render as on `MB`, and `typeof docinfo.tags === "string"`.

### a2. `frappe/public/js/frappe/ui/sidebar/sidebar.js`: "Desk v2" row in the sidebar user menu

`sidebar.js:451-466@v2` adds a `Desk v2` link to `/apps`. It is shown only when `cint(frappe.boot.sysdefaults.enable_desk_v2)` is true. `SystemSettings.set_defaults` writes every changed field into defaults (`frappe/core/doctype/system_settings/system_settings.py:222-227@v2`). So the key is absent (→ `0`) on a site that never turned it on, and `"0"` after it is turned off.

- **Setting off:** the menu is the same as on `MB`.
- **Proposal: keep.**
- **Test:** a Playwright spec with the setting off opens the sidebar user dropdown and asserts that no item has the label "Desk v2" and the item list equals the `MB` list. Repeat with the setting on to assert that the row appears. Today no spec covers this menu (`git grep -i "desk v2" upstream/desk-v2 -- playwright` finds only the v2 API-count and code-editor specs).

### a3. `frappe/desk/page/desktop/desktop.js`: Desk v2 menu row and `?cloud_settings=1`

There are two changes. Both are in a page script. It is served raw by the Page loader and is not in a bundle.

- `desktop.js:295-298@v2` adds the same `Desk v2` row to the desktop's user menu, gated on `frappe.boot.sysdefaults.enable_desk_v2`. With the setting off, it is not shown. **Keep.** Use the same test as a2 on `/desk`.
- `desktop.js:27@v2` and `desktop.js:129-138@v2`: `open_cloud_settings_from_url()` runs on every desktop `on_page_load`, whatever the setting.
  - If the address has `cloud_settings`, the parameter is removed with `history.replaceState`.
  - If `frappe.boot.cloud_settings.enabled` and a bundle URL are set (Frappe Cloud sites only), the Cloud Settings dialog opens.
  - On `MB` the parameter was ignored and stayed in the address.
  - The only producer of the URL is the v2 index "Get more apps" tile (commit `8b1ff7a41e`). With v2 off, a v1 user reaches it only by typing it.
  - The rest of the diff (`desktop.js:49-127@v2`) moves the cloud-button loader out of `DesktopPage` into a module-level `CloudSettingsOpener`. Its behaviour is the same: prefetch on hover, one load, cache-bust retry, and the same alerts. There is only one `DesktopPage` per page load, so the module-level state is not shared more widely than before.
  - **Proposal: keep.** It is an additive address. No v1 link or button changes.
  - **Test:** a Playwright spec on a non-Cloud site loads `/desk?cloud_settings=1` and asserts that the URL becomes `/desk`, no dialog opens, and no console error. Then it asserts that the cloud button (when `cloud_settings.enabled`) still opens the dialog. `frappe/tests/test_cloud_settings.py@v2` covers only the server side.

### a4. `frappe/custom/doctype/client_script/client_script.js` (with `client_script.json`)

This is a v1 form script for the Client Script DocType.

- The schema adds `Record` to `view` ("Apply To") options. It also adds `run_order` (shown only for Record) and hides `sample` for Record (`client_script.json:44,57-63@v2`).
- The JS sets an `export default { onRefresh(page) {} }` boilerplate for Record (`client_script.js:96-105,122-127@v2`). It also guards a null `script` (`client_script.js:87@v2`). On `MB`, `frm.doc.script.includes` threw when `view` changed on an empty script.

What a v1 user sees with the setting off:

- The "Apply To" select shows a third option, "Record". Choosing it saves a script that never runs in v1. `frappe/desk/form/meta.py:168-185@v2` (unchanged from `MB`) adds only `List` and `Form` scripts to `__custom_list_js` / `__custom_js`, so an `export default` script is never evaluated by v1. The server-side template compile and class warning run only for `view == "Record"` (`client_script.py:76-100@v2`).
- Existing `List` / `Form` scripts behave as on `MB`. One edge: switching a new script to `List` now also clears a script that contains `export default` (`client_script.js:90@v2`). `view` is `set_only_once`, so this applies only to unsaved scripts.

Proposals:

- Null guard: **keep**. It is a bug fix.
- Record option and `run_order`: **gate**. In `client_script.js` `setup`/`refresh`, drop `Record` from the `view` options when `frappe.boot.sysdefaults.enable_desk_v2` is off and the document is not already `Record`. Without this, a v1 admin can author a script that silently does nothing.
- **Test:** a Playwright spec with the setting off opens a new Client Script and asserts that the `view` options are `["List", "Form"]`. It sets `view = List` with an empty script and asserts no error. With the setting on, it asserts that `Record` is present. The existing `frappe/custom/doctype/client_script/test_client_script.py@v2` already covers the server-side `view` filter.

### a5. Other v1-visible client items (setting off)

- **System Settings form:** a new "Enable Desk v2" check is shown on the App tab after `default_app` (`frappe/core/doctype/system_settings/system_settings.json:96,873-879@v2`). This is the switch itself. **Keep.** The patches/migrate part belongs to map #45480's "Not yet specified".
- **New DocTypes** (Favourite, Rail, Doctype View, …) show in awesomebar and list views. Ruling 3 allows them. None adds a `<doctype>.js` form script. The only new client files under `frappe/` are v2 shell files (`frappe/desk/frontend/settings/*.vue`, `frappe/desk/navigation_item_type/*/frontend/item.js`, `frappe/frontend/i18n.js`), and v1 never loads them.

## (b) Consumers of `ui/` (`@framework/ui`) on develop

`ui/` diff: 82 added, 109 modified and 2 deleted files (`ActivityTimeline/pagination.ts` and its test). `ui/island/**`, `ui/vite/**` and `ui/patches/**` do not change. `ui/package.json` adds 14 subpath exports and new peer dependencies. It also makes `@codemirror/lang-javascript` a required peer.

The package is **not published**: `https://registry.npmjs.org/@framework%2fui` returns 404. Each consumer links it by path.

### b1. Desk v1 islands (frappe, bundled by esbuild)

- **Consumers:**
  - `frappe/public/js/frappe/ui/island/chart/chart.island.js:1@MB` and `chart.vue:17@MB` import `@framework/ui/island`.
  - `frappe/public/js/frappe/ui/island/loader.js:26@MB` imports `@framework/ui/island/host`.
  - `frappe/desk/page/{notifications,profile,search}/*.island.js:1@MB` import `@framework/ui/island`.
  - `frappe/core/doctype/page/page.py:338,347@MB` generates a Page-island template that imports `@framework/ui/island`.
  - The other imports in these files are `vue`, `frappe-ui` and local files.
- **What changes:** nothing. `ui/island/**` has no diff.
- **Proposal: keep.**
- **Test:** the island build (`ui/vite/island/build-framework.js`, unchanged) produces the same `*.island.js` / `*.island.css` hashes in `assets.json` at `MB` and at the merge candidate.

### b2. Studio (`studio/frontend`, frappe develop)

Studio links `@framework/ui` (`studio/frontend/package.json:25@MB`) and aliases it to `ui/src` (`studio/frontend/vite/frameworkUIAlias.js@MB`). It uses the package in four ways:

- It uses 20 components in the editor (`src/globals.ts:169-250@MB`).
- It imports `Link.vue` in five editor panels.
- It bundles the same components into exported Studio apps (`src/scripts/build.js:32-58@MB`).
- It keeps hand-generated prop schemas in `src/json_types/frameworkui/*.json`.

The build check passes:

- `vite build` of the Studio editor succeeds against both `MB`'s and `desk-v2`'s `ui/`. I used two detached worktrees with Studio's installed `node_modules`.
- Total JS grows from 7,563,740 to 7,634,762 B (+71 KB, +0.9%). `globals` grows by 27 KB, there is a new 18 KB `api` chunk, and `FormLayout` grows by 5.9 KB.
- `ui/src/index.ts` and `ActivityTimeline/index.ts` only add exports. Every name in Studio's barrel allowlist and subpath map still exists.
- The only removed exports in `ui/src` are internal: `pagination.ts`'s `createHistoryPagination`, `applyFirstPage` and others, and `pendingRows.ts`'s `pendingRowsFor`, `retirePendingRows` and others. On `MB` only `useActivityTimeline.ts:10-20@MB` imported them, and no barrel exported them.

| Component used by Studio | API change | Render change | Server calls `MB` → `desk-v2` | Proposal |
| --- | --- | --- | --- | --- |
| `Link` | **`redirectable` prop removed.** `href` replaces it (`ui/src/components/Link/types.ts:9@MB` → `:10@v2`). `Link.json:52@MB` in Studio still offers `redirectable`. | The redirect arrow is now an `<a>`. A Studio app that sets `redirectable` loses the arrow with no error. | `frappe.desk.search.search_link` → `GET /api/v2/doctype/<dt>/search` | **fix:** accept `redirectable` as a deprecated alias that turns on the arrow, and regenerate Studio's `json_types` |
| `ActivityTimeline` | `paginate.loadMore.position: "inline"` and `paginate.isPagedRow` removed. `ActivityTimeline.json:739-762@MB` still offers them. | Skeleton instead of spinner. The inline load-more row falls back to the top. | none (the component takes rows as props) | **fix:** regenerate `json_types`. **Keep** the render. |
| `FormLayout` / Fields | `autofocus` and `v-model:sections` added | A read-only Link renders as text (`LinkValue`), not a disabled combobox. Tab error dot. | Currency: `frappe.client.get_value` → `/api/v2/document/...`. Link search → v2. | **keep** |
| `Filter`, `SortBy`, `QuickFilter`, `ColumnSettings`, `ListViewShell` | none | QuickFilter shows skeleton bars while meta loads. The customize panel and `vuedraggable` load lazily. | **Meta:** `frappe.desk.form.load.getdoctype` (`with_parent`, frappe-ui IndexedDB cache) → `GET /api/v2/doctype/<dt>/meta?include=children` (`ui/src/composables/useDoctypeMeta.ts:51@MB` → `:131@v2`) | **keep**, with a field-list test |
| `TableMultiSelect` | `titles`, `v-model:open` and `#create` slot added | The Create footer shows whenever `creatable` is set, even with an empty query | Link search → v2 | **keep** (pin it in a test) or restore the `query.trim()` check |
| `FileUploadDialog`, `AttachmentsList` | `attachTo` and `isPrivate` added (defaults as before) | none by default | `/api/method/upload_file` → chunked `POST /api/v2/document/File` (it wraps `upload_file`, so the permissions are the same) | **keep** |
| `EmailComposer`, `CommentComposer` | `fill`, `disabled` and `discard` emit added | Toolbar buttons now really get `size="sm"` | none | **keep** |
| `EmailItem`, `CommentItem`, `Grid` | none | Email HTML is parsed in one inert document (the same sanitising). Grid CSS selector renamed. | none | **keep** |
| `UploadTray`, `NotificationPanel`, `NotificationItem`, `Phone` | none | none | none | **keep** |

None of the new endpoints is gated. `is_desk_v2_enabled` is read only in `frappe/utils/data.py:2150-2157@v2` and the shell page. They ship in the same merge, so the calls work with the setting off.

**Test that proves Studio is unchanged:**

1. Run Studio's Cypress suite. It already runs in `.github/workflows/ui-tests.yml@MB`, and `drop-components.cy.ts` drops each `@framework/ui` component on a live site.
2. Add a component test that mounts `<Link doctype="User" redirectable model-value="Administrator">` and asserts that the redirect arrow renders.
3. Add a test that, for `User` and for one child DocType, asserts that `Filter`'s field list is the same as on `MB`.
4. Add a check that `yarn extract-frameworkui-types` leaves `json_types/frameworkui/` clean.

### b3. Other apps' develop branches (link `../../frappe/ui`)

- **`frappe/crm@develop`** links the package (`frontend/package.json:19`) and aliases `@framework/ui` to `ui/src`. It imports:
  - `EmailItem` (ActivityTimeline)
  - `ConditionBuilder`
  - `DataImport` (`* as dataImportUi`)
  - `GroupBy`, `SignupBanner` and `TrialBanner`
  - `Onboarding` (`useOnboarding`, `showHelpModal`, `minimize`, `IntermediateStepModal`)
  - `telemetry` (`useTelemetry`, `telemetryPlugin`, in 51 files)
- **`frappe/insights@develop`** links it (`frontend/package.json:50`). It imports:
  - `Filter` (`Filter`, `serializeFilters`, types) and `QuickFilter`, each with `doctype="Insights Dashboard v3"`
  - `TrialBanner` and `telemetry`
  - `island` and `vite/island`
  - It also applies `ui/patches` in `postinstall`.
- **No match on develop:** helpdesk, gameplan, erpnext and hrms (`frontend/package.json`). The local `crm` checkout here is on its `desk-v2` branch, which is out of scope.

| Export | Change (`MB` → `desk-v2`) | Effect on CRM / Insights | Proposal |
| --- | --- | --- | --- |
| `TrialBanner` | `createResource` (`/api/method`, cached as `current_site_info_data`) → `runMethod` `GET /api/v2/method/...current_site_info` with no cache. A failure now hides the banner without an error (`ui/src/components/TrialBanner/TrialBanner.vue:54-67@v2`). | Same banner. One request per mount instead of a cached one. | **keep** |
| `useOnboarding` | `get_onboarding_status` moves to v2 GET. The save call moves from `update_user_onboarding_status(appName)` to `update_onboarding_status(app)`. The old method is kept as an alias (`frappe/onboarding.py:13,29-31@v2`). | Same data. The endpoint and argument names change. | **keep** (the alias protects older bundles) |
| `telemetry` (`fetchBootConfig`) | `call` → `runMethod`, which reads `.data` from the v2 envelope (`ui/src/telemetry/pulse.ts:57-59@v2`) | Same config. It still falls back to `{}` on any error. | **keep** |
| `DataImport` | Calls move from `frappe.client.get/get_list/get_count/get_value` and `remove_attach` to `/api/v2` documents. The upload uses the v2 File route. Downloads post to `/api/v2/method/...`. | Same screens. A different endpoint set. | **keep** |
| `ConditionBuilder` | Card background `bg-surface-white` → `bg-surface-base`. Value inputs provide `CreateRecordKey` / `RecordLinkKey = null`. | A colour token change. The Link inputs in it can no longer create or open records. | **keep** if `bg-surface-base` equals white in light mode; otherwise **fix** |
| `EmailItem` | `EmailContent` parses once (the same sanitising) | none | **keep** |
| `Filter` / `QuickFilter` | Meta moves from `getdoctype` to `/api/v2/doctype/<dt>/meta?include=children`. QuickFilter adds a skeleton. | The Insights dashboard and workbook lists show skeleton bars while meta loads. The same fields are expected. | **keep**, with a field-list test |
| `GroupBy`, `SignupBanner`, `island`, `vite/island` | none | none | **keep** |

Every changed export moves its calls to `/api/v2` through `ui/src/api/request.ts:5@v2`. It sends the same CSRF and site headers as frappe-ui's `call` (`request.ts:34-41@v2`). These routes exist on `develop` once `desk-v2` merges.

New third-party imports in `ui/src`:

- `@tiptap/core`, `@codemirror/{autocomplete,language,lang-vue,lint}` and `@lezer/common`, from `Fields/templateLanguage.ts`, `codeErrorMarks.ts`, `TextEditorInput.vue` and `Composer/ComposerEditor.vue`.
- `~icons/lucide/*`, from `ActivityTimeline/AttachmentChip.vue`.

CRM pulls in `ComposerEditor`'s module graph only if it imports a Composer, and it does not. `EmailItem` → `AttachmentChip` does need an `~icons` resolver, which CRM's `frappeui({ lucideIcons })` plugin provides.

**Test that proves CRM and Insights are unchanged:** in CI, build `frappe/crm@develop` and `frappe/insights@develop` against the merge candidate's `ui/` with `yarn build`. Then smoke-load the CRM sidebar (TrialBanner and Onboarding) and the Insights dashboard list (Filter and QuickFilter field lists) on a site, comparing against `MB`.

## (c) Desk v1 asset bundles

- **Bundle inputs:** the only changed inputs to v1 esbuild bundles are `form.js` (in `form.bundle.js`) and `sidebar.js` (in `desk.bundle.js`, `frappe/public/js/desk.bundle.js:43@MB`). No `*.bundle.*` entry is added. `esbuild/esbuild.js` and the root `package.json` / `yarn.lock` do not change.
- **Size:** each file, minified alone with the repo's esbuild:

  | File | Minified | Gzip | Where it ships |
  | --- | --- | --- | --- |
  | `form/form.js` | 42,403 → 42,446 B (+43) | +23 B | `form.bundle.js` |
  | `ui/sidebar/sidebar.js` | 20,407 → 20,555 B (+148) | +58 B | `desk.bundle.js` |
  | `desk/page/desktop/desktop.js` | 5,871 → 5,902 B (+31) | +139 B | page script, not a bundle |
  | `client_script/client_script.js` | 3,344 → 3,566 B (+222) | +68 B | DocType script, not a bundle |

  The v1 bundles grow by about 0.2 kB minified, or about 80 B gzip, in total.
- **Islands:** the v1 islands (`frappe/public/js/frappe/ui/island/chart/*`, `frappe/desk/page/{notifications,profile,search}/*.island.js`) import only `@framework/ui/island` and `@framework/ui/island/host`. Neither changes. Their Tailwind scan reads the bundle's module list (`ui/island/decisions/0003-…md`), so the island JS and CSS are byte-identical in input.
- **New output under `frappe/public`:** `bench build` now runs `build_shell` before esbuild (`frappe/bundler.py:117-118,126-165@v2`). It writes the v2 shell to `frappe/public/frontend/` (gitignored, about 21 MB / 222 files in the main checkout). esbuild globs `public/**/*.bundle.*` (`esbuild/esbuild.js:281-288@MB`). The shell output has no `*.bundle.*` file (`find frappe/public/frontend -name '*.bundle.*'` returns nothing), so it does not enter `assets.json` or any v1 bundle. A failed shell build fails `bench build` before esbuild runs (`raise_err=True`). Map ruling 4 owns that question.
- **Proposals:**
  - `form.js` / `sidebar.js` bytes: **keep**.
  - Shell build ordering: refer to ruling 4. Nothing to do here.
- **Test:**
  1. Build `sites/assets/assets.json` at `MB` and at the merge candidate. Assert that the key set is equal. Assert that every bundle except `desk.bundle.js` and `form.bundle.js` has the same hash.
  2. Run the existing `default-js-bundle-size` workflow (`.github/workflows/default-js-bundle-size.yml@MB`). Assert that the delta is under 1 kB.

## Summary

- **Desk v1 JS:** only four files change. With the setting off, three are unchanged for the user or are additive:
  - the sidebar and desktop "Desk v2" rows are gated on `sysdefaults.enable_desk_v2`;
  - `?cloud_settings=1` is a new address only the v2 index links to;
  - the `tags`/`favourites` skip stops a v1 crash that desk-v2's new `TagLink` publisher would cause.
- **One real v1 change:** `DocShare` now publishes `docinfo_update` `shared`, and the v1 form applies it. Share rights update without a reload. **Fix** (skip `shared` too), or get an explicit keep ruling. The current spec pins the change.
- **Client Script:** a v1 admin now sees a "Record" option that does nothing in v1. **Gate** it on the setting.
- **v1 bundles:** only `form.bundle.js` and `desk.bundle.js` change, by about 0.2 kB minified in total. Islands are unchanged because `ui/island` has no diff. The shell output under `public/frontend` has no `*.bundle.*` file.
- **`ui/` consumers on develop:** v1 islands (unaffected), Studio, CRM develop and Insights develop. The package is not on npm, and each consumer links `../../frappe/ui`.
  - No barrel export was removed. `pagination.ts`'s exports were internal.
  - The changed components move their server calls to `/api/v2`. Those routes are not gated and ship in the same merge.
- **Two fixes for Studio:**
  1. Restore `Link.redirectable` as an alias.
  2. Regenerate Studio's `json_types/frameworkui` (stale `redirectable`, `inline`, `isPagedRow`).

  Studio's editor builds against both refs (+0.9% JS).
- **Tests to add before the merge:**
  - a real-share and real-tag case in `form_docinfo_update.spec.js`
  - a menu spec with the setting off
  - a Client Script options spec
  - an `assets.json` hash diff between `MB` and the merge candidate
  - Studio Cypress plus a `Link redirectable` test
  - CRM and Insights develop builds against the merged `ui/`
