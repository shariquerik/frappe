# Research: the server bulk contract each parity action needs

Ticket: [#47052](https://github.com/frappe/frappe/issues/47052), map [#47051](https://github.com/frappe/frappe/issues/47051). Measured on `upstream/desk-v2` at `29eb229ba8` (2026-11-12). Paths are relative to the frappe repo root.

The charter rulings this file checks against: every bulk action runs on the server with one API v2 call, a background job above a threshold, progress, and a per-record failure list (ruling 4). The User `bulk_actions` gate and the caps hold in the UI and in every v2 bulk endpoint (ruling 5). A run can act on all rows that match the filter (ruling 7a).

## Shared facts

- **The gate.** `User.bulk_actions` is a Check, default 1, permlevel 1 (`frappe/core/doctype/user/user.json:831`). Desk v1 reads it from `frappe.boot.desk_settings` (`frappe/boot.py:583`) and hides every item except Copy to Clipboard when it is off (`frappe/public/js/frappe/list/list_view.js:3540`). The v1 workflow items do not check it (`list_view.js:3074`). The desk v2 boot (`frappe/shell/boot.py:268`) does not send `desk_settings`, so v2 cannot read the gate now.
- **API v2 bulk endpoints.** `POST /api/v2/document/<dt>/bulk_delete` and `/bulk_update` (`frappe/api/v2.py:880-881`), and the cross-doctype `POST /api/v2/method/bulk_delete` and `/bulk_update` (`v2.py:866-867`). All four:
  - take names only, no filters;
  - do not check `bulk_actions` and have no cap;
  - above `get_bulk_operation_async_threshold` (site conf `bulk_operation_async_threshold`, default 20, per doctype or `*`, `v2.py:53`) call bare `frappe.enqueue` and return `202 {job_id}` (`v2.py:506`). There is no Background Task, no progress, and the result dict stays in RQ, which no endpoint reads;
  - return `{deleted|updated, failed: [{name, error}], total, success_count, failure_count}` when they run in the request (`v2.py:545`);
  - use one savepoint per record and no commit (`v2.py:530`). A background run that dies at record 400 rolls back the 399 done before it.
- **Per-document collaboration routes** (`frappe/api/collaboration.py`, routes at `v2.py:827`): `POST`/`DELETE /api/v2/document/<dt>/<name>/{assignments|shares|tags|follows|favourites|comments}`. The right checked per part is in `PART_RIGHT` (`collaboration.py:215`): assignments `write`, shares `share`, tags `write`, follows `read`. There is no bulk form.
- **v1 caps and thresholds differ by action.** See each table. Only submit/cancel/update and workflow refuse more than 500. Print refuses more than Print Settings `max_bulk_print_docs` (default 100, `frappe/utils/print_format.py:39`). The v1 print dialog checks its own hard-coded 500 (`frappe/public/js/frappe/list/bulk_operations.js:13`), so between 101 and 500 the server throws after the dialog.

## Per action

### Copy to Clipboard

| | |
|---|---|
| v1 method | None. The client builds TSV from the loaded rows (`list_view.js:3410-3531`). |
| Limits, background, progress | None. Only rows on screen. |
| Permissions | Shown without the `bulk_actions` gate (`list_view.js:3538`). |
| API v2 | Not needed for selected rows. |
| By filter | Needs one `GET /api/v2/document/<dt>` with the list's fields, filters and `limit` = cap. No new endpoint. |

### Edit

| | |
|---|---|
| v1 method | `frappe.desk.doctype.bulk_update.bulk_update.submit_cancel_or_update_docs`, `action="update"`, `data={field: value}` or `{child_table_updates: {child_dt: {field: value}}}` (`bulk_update.py:53`, client `bulk_operations.js:393`). One field per run. |
| Limits | Under 20 in the request. 20 to 500 as a Background Task, queue `short`, timeout 1000 s. Over 500 throws "Too Many Documents" (`bulk_update.py:67-89`). |
| Background, progress | `enqueue_task`. `task.publish_progress` per record (`bulk_update.py:143`). The return value (failed names) goes to `Background Task.result` (`task_queue.py:152`). |
| Result | A list of failed names, no reasons. Reasons go only to Error Log (`bulk_update.py:150`). |
| Permissions | `bulk_actions` gate (`bulk_update.py:61`). Per record: `doc.save()` checks write. Cancelled records fail. UI: editable fields only; on a workflow doctype only with List View Settings `allow_edit` (`list_view.js:3156`). The server does not check `allow_edit`. |
| API v2 | `bulk_update_docs` takes `docs: [{name, ...fields}]` (`v2.py:623`). Gaps: gate, cap, Background Task and progress, no "same values for all" body, no child-table update, no `allow_edit` check. |
| By filter | Precedent: the Bulk Update doctype resolves `condition` filters with `frappe.get_all(limit=500)` (`bulk_update.py:33-49`). `get_all` skips user permissions, so a v2 version must use `get_list` or the `document_list` query. |

### Export

| | |
|---|---|
| v1 method | Opens the Data Exporter dialog with filter `name in <selected>` (`bulk_operations.js:508`). The file comes from `frappe.core.doctype.data_import.data_import.download_template` (`data_import.py:357`). |
| Limits, background, progress | None. Synchronous, no row cap. |
| Permissions | `read` on the doctype (`data_import.py:372`), then `can_export` or export-if-owner per row (`exporter.py:154`). No `bulk_actions` check on the server. UI shows it only with the gate and `can_export` (`list_view.js:3548`). |
| API v2 | None. Desk v2 already calls `download_template` from the Data Import template modal (`ui/src/components/DataImport/steps/TemplateModal.vue`). |
| By filter | Native: `export_records="by_filter"` with `export_filters`. |

### Assign To

| | |
|---|---|
| v1 method | `frappe.desk.form.assign_to.add_multiple` (`assign_to.py:172`). |
| Limits, background, progress | None. Synchronous loop, no cap, no progress. |
| Result | None. The first failure throws and rolls back the whole request. |
| Permissions | `bulk_actions` gate (`assign_to.py:173`). Per record: `check_permission()` (read), assignee is an enabled System User and passes `validate_user_access` (`assign_to.py:89-96`). |
| API v2 | Per document only: `POST .../<name>/assignments`, right `write`. No bulk form. |
| By filter | Possible: resolve names, then the same per-record call. |

### Clear Assignment

| | |
|---|---|
| v1 method | `frappe.desk.form.assign_to.remove_multiple` (`assign_to.py:217`). The client also sends `ignore_permissions: true` (`bulk_operations.js:273`), which the signature drops. |
| Limits, background, progress | None. Synchronous, no cap. |
| Result | None. First failure rolls back all. |
| Permissions | `bulk_actions` gate (`assign_to.py:218`). Per record and assignee: `set_status` checks read on the document (`assign_to.py:244`). |
| API v2 | Per document `DELETE .../<name>/assignments/<user>`. No "all assignees" and no bulk form. |
| By filter | Possible. |

### Apply Assignment Rule

| | |
|---|---|
| v1 method | `frappe.automation.doctype.assignment_rule.assignment_rule.bulk_apply` (`assignment_rule.py:244`). |
| Limits | No cap. More than 5 records: one bare `frappe.enqueue` per record (`assignment_rule.py:249-258`). |
| Background, progress | No Background Task, no progress, no result. Returns `true` when queued. |
| Permissions | `bulk_actions` gate (`assignment_rule.py:245`). Per record: `check_permission()` (read) in `apply` (`assignment_rule.py:298`). |
| API v2 | None. |
| By filter | Possible. |

### Add Tags

| | |
|---|---|
| v1 method | `frappe.desk.doctype.tag.tag.add_tags` (`tag.py:64`). |
| Limits, background, progress | None. Synchronous, no cap. |
| Result | None. First failure rolls back all. |
| Permissions | `bulk_actions` gate (`tag.py:67`). Per record: `update_tags` checks write (`tag.py:235`). |
| API v2 | Per document `POST .../<name>/tags`. No bulk form. |
| By filter | Possible. |

### Remove Tags (charter addition)

| | |
|---|---|
| v1 method | None in bulk. Per record: `remove_tag` (`tag.py:78`). |
| Permissions | Per record: write (`tag.py:235`). |
| API v2 | Per document `DELETE .../<name>/tags/<tag>`. No bulk form. |
| By filter | Possible. |

### Print

| | |
|---|---|
| v1 method | Up to 25 by default: `download_multi_pdf` in a new window (`print_format.py:77`). Over 25 (client choice, `bulk_operations.js:14`): `download_multi_pdf_async` (`print_format.py:99`). |
| Limits | Print Settings `max_bulk_print_docs`, else site conf, else 100 (`print_format.py:39`). Async: a per-user rate limit and at most `max_concurrent_bulk_exports` (default 5) jobs per user (`print_format.py:57`, `:123`). |
| Background, progress | Bare `frappe.enqueue` with its own uuid `task_id`, not a Background Task. Progress is the legacy `progress` event to room `task_progress:<id>` (`print_format.py:331`), which needs `task_subscribe`. The end is `task_complete:<id>` with `{file_url}` or `{error}` to the user room (`print_format.py:394`, `:183`). |
| Result | One private File. Failed records: a realtime `msgprint` list of links (`print_format.py:403`). A permission error stops the whole run (`print_format.py:317`). |
| Permissions | `bulk_actions` gate (`print_format.py:88`, `:110`). Per record: `validate_print` (print right and docstatus rules, `frappe/www/printview.py:554`). |
| API v2 | None. |
| By filter | Possible. The cap is the Print Settings value, not 500. |

### Submit and Cancel

| | |
|---|---|
| v1 method | `submit_cancel_or_update_docs`, `action="submit"` or `"cancel"` (`bulk_update.py:53`). |
| Limits, background, progress | As Edit: under 20 inline, 20 to 500 Background Task with per-record progress, over 500 throws. |
| Queued submit | A doctype with `queue_in_background` goes to Submission Queue per record (`bulk_update.py:106`). The run reports it as done, but the real outcome arrives later per record (`submission_failed`, `doc_update`). |
| Result | Failed names, no reasons. A record in the wrong docstatus is a silent failure. |
| Permissions | `bulk_actions` gate. Per record: `submit()` / `cancel()` check the right. UI hides both on workflow doctypes (`list_view.js:3570-3578`); the server does not refuse them. |
| API v2 | None in bulk. Per document: `.../<name>/method/submit` and `cancel` (`v2.py:41`). |
| By filter | Possible. A filter on `docstatus` keeps the run clean. |

### Delete

| | |
|---|---|
| v1 method | `frappe.desk.reportview.delete_items` (`reportview.py:1056`), worker `delete_bulk` (`reportview.py:1078`). |
| Limits | More than 10 runs as a Background Task on queue `long` (`reportview.py:1064`). No cap. |
| Background, progress | `task.publish_progress` with a "Deleting i of n (k failed)" stage. In the request with 5 or more, the legacy `progress` event (`reportview.py:1097`). One commit per record. |
| Result | Reasons per record, grouped `{reason: [names]}`, linked-document lists for `LinkExistsError`. In the background: `task.store_result`, then it raises `PartiallyCompleteError`, so the task ends `Failed` even when most records were deleted (`reportview.py:1153-1160`). In the request: an HTML `msgprint` and the failed names. |
| Permissions | `bulk_actions` gate (`reportview.py:1058`). Per record: `delete_doc` checks delete. UI: `can_delete`, and `allow_edit` on workflow doctypes (`list_view.js:3583`). |
| API v2 | `bulk_delete_docs` (`v2.py:488`). Gaps: gate, cap, Background Task and progress, commit per record, readable result after the background run, no `allow_edit` check. Desk v2 does not call it. It loops single deletes in the browser (`frontend/src/list/useListView.ts:255`). |
| By filter | Possible. |

### Workflow transitions

| | |
|---|---|
| v1 method | `frappe.model.workflow.bulk_workflow_approval` (`workflow.py:385`). The menu shows the actions common to the selection from `get_common_transition_actions` (`workflow.py:481`, client `list_view.js:3115`). |
| Limits | Under 20 inline, 20 to 500 bare `frappe.enqueue`, over 500 throws (`workflow.py:387-401`). |
| Background, progress | No Background Task. Legacy `progress` event from 5 records (`workflow.py:504`). |
| Result | Two realtime `msgprint` HTML lists, "Failed Transactions" and "Successful Transactions" (`workflow.py:457`). Desk v2 does not show them. |
| Permissions | **No `bulk_actions` gate** on the server or in the UI. Per record: `run_workflow_transition` checks the transition and role. |
| API v2 | None. |
| By filter | Possible. The common-action list needs the selected docs. For a filter run the menu must offer all transitions, and records that do not allow the action fail with a reason. |

### Follow and Unfollow (charter addition)

| | |
|---|---|
| v1 method | None in bulk. Per record: `follow_document` / `unfollow_document` (`frappe/desk/form/document_follow.py:29`, `:89`). |
| Preconditions | Doctype has `track_changes`, user is not Administrator, user has `document_follow_notify` on. Each fails with a toast and returns `False`, not an error (`document_follow.py:60-72`). |
| Permissions | Read per record. |
| API v2 | Per document `.../<name>/follows`. |
| By filter | Possible. Check the doctype and user preconditions once, before the loop. |

### Share (charter addition)

| | |
|---|---|
| v1 method | None in bulk. Per record: `frappe.share.add` (`frappe/share.py:22`). |
| Permissions | `share` right per record, and the user can grant only rights they hold (`share.py:244`). System Setting `disable_document_sharing`. |
| API v2 | Per document `.../<name>/shares`. |
| By filter | Possible. |

### Mark seen and unseen (charter addition)

| | |
|---|---|
| v1 method | None for the list. `Document.add_seen` writes after the response (`frappe/model/document.py:2613`). Unseen exists only for Communication in the inbox (`frappe/email/inbox.py:69`). Open single issue: [#46900](https://github.com/frappe/frappe/issues/46900) (Mark as unseen on a record). |
| Preconditions | Doctype has `track_seen` and is not a Single. |
| Permissions | Read per record. |
| API v2 | None. The record read marks seen through the `seen` part (`frappe/api/include.py:186`). |
| By filter | Possible. |

## Progress and result plumbing

1. **Background Task.** `frappe.enqueue_task` (`frappe/utils/task_queue.py:12`) inserts a Background Task named by `task_id`, then enqueues after commit. `job_id` is the same as `task_id` (`task_queue.py:58`). The worker sets `Running`, stores the return value as JSON in `result`, and sets `Completed` or `Failed` (`task_queue.py:142-192`).
2. **Events.** Every status change and each `task.publish_progress(percent, stage)` publishes `task_update` with `{task_id, task_name, status?, progress?, stage?}` to the user room (`background_task.py:60`, `:71`, `:134`). Progress is throttled to one per 0.2 s. The latest state is cached for one hour under `background_task:<id>`.
3. **Reading after a reload.** `get_recent_tasks` and `get_cached_task_status` (`background_task.py:146`, `:173`). A Desk User can read their own Background Task (`if_owner` permission). `result` is permlevel 0, so `GET /api/v2/document/Background Task/<task_id>` returns it. `stop_task` cancels (`background_task.py:178`).
4. **Legacy paths.** `frappe.publish_progress` sends the `progress` event: with a `task_id` to room `task_progress:<id>`, which needs a `task_subscribe` emit (`realtime/handlers.js:48`); without one to the user room (`frappe/realtime/__init__.py:19`, `:65-72`). Print uses its own `task_complete:<id>`. Workflow and Delete send results as realtime `msgprint` HTML.
5. **Desk v1 listener.** `frappe/public/js/frappe/ui/background_tasks/background_tasks.js:78` listens to `task_update`.
6. **Desk v2 today.** The socket joins the user room on connect (`realtime/handlers.js:7`), so `task_update` already reaches each tab with no subscription. The shell has a generic `useRealtime().on(event, handler)` (`frontend/src/shell/realtime.ts`). Nothing in `frontend/src` or `ui/src` listens to `task_update`, `progress`, `task_complete:*` or `msgprint`. There is no `task_subscribe` helper (`ui/src/socket.ts` has only `doc_subscribe`).

What the v2 shell needs: one listener on `task_update`, filtered by the `task_id` the bulk call returned. On mount or reconnect it reads the task once (the cached status, then the Background Task doc for `result`). The result panel reads the per-record list from `result`. No other event is needed if every bulk endpoint uses `enqueue_task`.

## Gaps the server grilling must rule

**G1. One runner or one endpoint per action.** Options: (a) one route per action under `/api/v2/document/<dt>/bulk_*`, each a thin wrapper over one shared runner that does the gate, cap, selection, threshold, Background Task, progress and result; (b) one generic `bulk/<action>` route with a server registry. Recommend (a): it matches charter ruling 4, and the runner keeps the eleven endpoints the same.

**G2. Background mechanism and response.** Options: (a) `enqueue_task` everywhere, `202 {task_id, job_id}` with `job_id = task_id`; (b) keep bare `frappe.enqueue` and add a progress event. Recommend (a). Returning both keys keeps the existing `bulk_delete`/`bulk_update` callers working. Print moves to `enqueue_task` too, and its file URL goes in `result`.

**G3. Threshold.** v1 uses 5, 10, 20 and 25. Options: (a) `get_bulk_operation_async_threshold(doctype)` for all actions; (b) keep v1 numbers per action. Recommend (a). Print runs in the background at any size, because its result is a file.

**G4. The cap.** Options: (a) a constant 500; (b) site conf `bulk_operation_limit`, default 500, read like the threshold. Print always uses `max_bulk_print_docs`. Over the cap the endpoint refuses before any work, never truncates. Recommend (b), and send the cap in the v2 boot so the bar can say it before the call.

**G5. The `bulk_actions` gate.** Options: (a) check it in every v2 bulk endpoint, including the existing four, and send it in the shell boot; (b) check it only for desk v2 calls. Recommend (a), per ruling 5, with a release note for API users. Workflow gets the gate in v2 too (v1 has none). Export keeps the server ungated, because `download_template` also serves Data Import templates; the gate is in the UI only.

**G6. The per-record result.** Options: (a) one shape for every action: `{total, done: [name], failed: [{name, error}]}`, plain-text `error`, inline below the threshold and in `Background Task.result` above it; (b) keep each action's shape. Recommend (a). A run with record failures ends `Completed`, not `Failed` (v1 delete ends `Failed`). `Failed` means the run itself crashed. "Retry failed" posts the failed names again.

**G7. Commit per record.** API v2 commits once at the end, v1 commits per record. Options: (a) commit after each record in the background run; (b) keep one transaction. Recommend (a): a timeout or crash then keeps the work done, and progress matches the database.

**G8. The selection body and by-filter runs.** Options: (a) a body of `{names}` or `{filters, or_filters}`, resolved by the same `frappe.qb.get_query(ignore_permissions=False)` path as `document_list`, with `limit = cap + 1` to refuse an over-cap filter; (b) the client reads the names first and always sends names. Recommend (a), per ruling 7a. The server resolves the set when the run starts and reports what it acted on. Sub-question: does "all except these" (`exclude: [names]`) belong in the first cut? Recommend no.

**G9. Doctype-level preconditions.** v1 enforces some only in the UI: `allow_edit` for Edit and Delete on workflow doctypes, no Submit/Cancel on workflow doctypes, `track_changes` for Follow, `track_seen` for Seen. Options: (a) the endpoint checks them once and refuses the run; (b) UI only. Recommend (a).

**G10. Edit body.** `bulk_update_docs` takes per-record values. Options: (a) add `values` (same for all) and `child_values: {table_field: {field: value}}` to the bulk Edit body; (b) the client copies the values into each `docs` item. Recommend (a): (b) cannot work for a by-filter run.

**G11. Submit for queued doctypes.** On `queue_in_background` doctypes v1 reports "queued" as done. Options: (a) report those records as `queued` in the result; (b) count them as done. Recommend (a), so the panel does not claim a submit that can still fail.

**G12. The endpoint list.** New endpoints: `bulk_update` (Edit), `bulk_delete` (existing, gains G2-G8), `bulk_submit`, `bulk_cancel`, `bulk_workflow`, `bulk_assignments` (`POST` add, `DELETE` clear), `bulk_assignment_rule`, `bulk_tags` (`POST` add, `DELETE` remove), `bulk_print`, `bulk_follows`, `bulk_shares`, `bulk_seen`. Export reuses `download_template` and Copy needs none. Recommend that the collaboration parts reuse the per-document body (`collaboration.py:224-236`), so a bulk call equals the single call with a selection.
