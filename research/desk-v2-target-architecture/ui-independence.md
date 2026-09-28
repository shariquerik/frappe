# ui/ independence and feature usage, desk-v2 at 6352fefbdf

Source: a read-only subagent, 2026-09-28. Paths under `ui/src` unless noted.

## Where ui/ does not stand on its own

| # | Break | Where | What an app outside the desk hits |
| --- | --- | --- | --- |
| U1 | The cache keeps a record only when all 9 record-page parts were read | `cache/dataCache.ts:67,83-87`, `cache/entries.ts:5-15` | `getDocument` is never cached |
| U2 | Number and currency formatting read a session the desk provides | `FormLayout/formatDefaults.ts:45`, `Fields/NumberField.vue:61,70,79,93` | Silent fallback: no site currency or number format |
| U3 | FormLayout requires the desk's commit channel | `Fields/types.ts:118-151`, `FormLayout/FormLayout.vue:141`, `FormLayout/warnMissingCommit.ts:12-15` | A DEV error on every mount |
| U4 | ConditionBuilder reads desk v1's `globalThis.__` | `ConditionBuilder/internal/context.ts:109` | English labels, desk v2 included |
| U5 | Phone imports a JSON file from the Python package | `Phone/utils.ts:1` | Build fails outside the frappe repo |
| U6 | CSRF token read from `globalThis.csrf_token` | `api/request.ts:34-35` | 403 on every write if the app does not set it |
| U7 | Upload limits come only from desk boot | `FileUpload/useUploader.ts:91-93`, `DataImport/UploadStep.vue:195` | No size check, default chunk size |
| U8 | Socket found by provide or globalProperties | `socket.ts:18-23` | Live updates silently off |
| U9 | Translations need `translations_version`, which only boot carries | `api/index.ts:289-298` | App must supply its own cache key |
| U10 | Paint-gate functions exported from ActivityTimeline | `useActivityTimeline.ts:37-87`, `ActivityTimeline/index.ts:9-17` | Desk-only API in the public surface |
| U11 | `perm_denied` is set only by the desk | `FormLayout/resolveLayout.ts:13-27`; set in `frontend/src/recordPage/formLayoutSource/fieldAccess.ts:15-16` | Permlevel-hidden fields can show (display only; server enforces) |
| U12 | Invite redirect defaults to `/app` | `InviteUser/useInviteUser.ts:47` | Lands on desk v1 |
| U13 | `"./*": "./src/*"` in package.json exposes every file; the desk uses about 20 deep paths | `ui/package.json` | No defined public surface |
| U14 | ui has no test config; tests run through `frontend/vitest.config.js`, which aliases `@` to `frontend/src` | `ActivityTimeline/tests/emailFade.test.ts:3` | A desk import in ui is not caught |
| U15 | `reka-ui` used but not declared | `FormLayout/FormLayoutSection.vue:56` | Works only through frappe-ui |
| U16 | About 10 comments use record-page words | e.g. `FormLayout/resolveLayout.ts:186`, `Fields/TableField.vue:303-305` | Readers meet desk words |

No call to `frappe/shell/`. All socket events come from framework code.

Public exports: `readCachedList`, `readCachedRows`, `useSession` are public from `src/index.ts:23,30,31`. `admitList` is private. The currency lookup is in no barrel. `readCachedList` and `readCachedRows` have no consumers in frontend, CRM or ERPNext.

## Script features behind cuts 3, 27, 29, 31

No real app code uses any of them. CRM's two `record.js` scripts call only `page.tabs.order` from a synchronous `onRefresh`. ERPNext has no record-page scripts.

| Feature | Tests | Docs |
| --- | --- | --- |
| Header `section` items (4 nested in a dropdown) | 11 | 1 example, `frontend/COMPATIBILITY.md:135` |
| `page.fields.hide` | 18 | 3 |
| `page.fields.update(x, {hidden})` | 1 | 0 |
| `onRefresh` that changes the page after an await | 8 | prose only |
| Panel, tab or focus acts inside `onRefresh` | 28 bodies | 4 |
