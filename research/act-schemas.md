# Act arguments, results and confirms, and how other systems describe a command to an LLM

Research for frappe/frappe#47615, part of map #47612 (Desk v2: the UI API an LLM drives).

- **Code read:** frappe `desk-v2` at `22494aa39f` (2026-11-16). CRM `desk-v2` at `6199d15f7` (2026-11-13). All paths are in the frappe repository unless the line names CRM.
- **Web sources read:** 2026-11-16. Each claim cites its URL.
- **Measured:** bundle sizes with esbuild 0.28.2, zod 4.6.7, valibot 1.5.0, @valibot/to-json-schema 1.8.0 and @cfworker/json-schema 4.1.6.
- **Inferred:** a claim marked *(inferred)* was not checked in code, in a browser or in a source.

## Short answer

1. The dispatcher holds about 127 built-in acts, plus acts that scripts, apps, workflows and row actions add at run time. No act has a description or an argument schema. The argument is one untyped `value` (`frontend/src/acts/dispatcher.ts:43`). The only typing is a TypeScript annotation on `run`, which the bundle does not keep.
2. `run` returns what the act's function returns (`dispatcher.ts:174-178`). For most acts that is `undefined`. When the person declines a confirm, the act also returns `undefined`. A caller cannot tell "done" from "declined".
3. No `confirm` or `danger` dialog reaches the readable stack. `page.dialog.confirm` and `page.dialog.danger` open frappe-ui's own dialog and never enter `entries` (`frontend/src/shell/dialogs/pageDialogs.ts:1-2`, `:136-153`). Only `open` and `form` dialogs go on a stack (`pageDialogs.ts:92-134`). The DocType editor's danger dialogs use `shellDialog().open`, so they are on the shell's stack (`pages/doctypeEditor/dangerHost.ts:33-52`).
4. Every system surveyed declares a name, a description and a JSON Schema object for the arguments. MCP and `frappe/mcp` add hints (read-only, destructive) and report a tool failure as a result with an error flag, not as a protocol error. Anthropic and OpenAI do not allow a dot in a tool name, so `header.save` needs a mapped name there.
5. A hand-written JSON Schema with a small checker costs 0.7 KB gzip. Zod Mini costs 12.4 KB and Valibot costs 4.8 KB when each also emits JSON Schema (measured). The record page is already over its JS budget (`frontend/speed-budgets.json:5`).
6. The recommendation: each act declares `description`, `input` (JSON Schema of its value) and `asks` (the dialogs it may wait on), and optionally `output`. The dispatcher checks `input` with a hand-written checker and wraps the result as `{ok, data, error}`. The declarations for `header.save`, `header.assign` and `shell.open` are in the last section.

## How the dispatcher holds an act today

- **Shape:** an item has `name`, `label`, `icon`, `run(context, value)`, and the optional `key`, `right`, `palette: false`, `argument` and `when` (`dispatcher.ts:27-44`). The full name is `<surface>.<item>`. App acts are `shell.<app>.<item>` (`shell/appActs.ts:43-46`).
- **Argument:** `argument` has only a `label` and an `options(context, query)` function that returns picker choices (`dispatcher.ts:22-25`). Each choice's `value` is passed to `run` unchanged (`dispatcher.ts:10-20`). The palette is the only caller of `options` today. `AvailableAct.argument.options(query)` is already exposed by `describe()` (`dispatcher.ts:270-279`), so an outside caller can use it to look up a value, such as a user for `header.assign`.
- **Checks before run:** the act must be present, not hidden, its `when` must hold, and its `right` must pass. Otherwise `run` rejects with `ActDenied` and the reason `missing`, `hidden` or `right` (`dispatcher.ts:82-96`, `:214-221`). Nothing checks the value.
- **Result:** `run` resolves with the act's own return value (`dispatcher.ts:174-178`). `perform`, which the UI uses, swallows the result and sends a failure to the scope's `failed` handler (`dispatcher.ts:181-195`). On the record page `failed` reloads the record (`pages/Record.vue:1100-1104`).
- **Registration:** five places call `acts.register`: the shell (`shell/shellActs.ts:105-120`), the record page (`recordPage/pageActs.ts:20-37`, called from `recordPage/createRecordPage.ts:444`), the list page (`pages/list/listActs.ts:62-67`), the DocType editor (`pages/doctypeEditor/editorActs.ts:50-68`) and the Create dialog, which registers empty `header`, `quickActions` and `tabs` surfaces to hide the page's acts (`pages/create/CreateDialog.vue:97-107`). A record dialog (`pages/recordDialog/RecordDialog.vue:244`) and a new record (`pages/record/UnsavedRecord.vue:273`) also register through `createRecordPage`.
- **Not acts:** `pageEngine/heldActs.ts` holds a script's `activate`, `focus` and `open` calls until a replay ends. It does not register on the dispatcher. The ticket's `pages/record*/pageActs.ts` is `recordPage/pageActs.ts`.

## Every act

Column key:

- **Argument today:** the value `run` takes, from its TypeScript annotation and `argument.options`. "none" means `run` reads no value.
- **Result today:** what `run` resolves with. `void` means `undefined`.
- **Asks the person:** the dialog, picker or confirm the act may open and wait on. "readable" means the dialog goes on a `PageDialogs.entries` stack. "not readable" means it is frappe-ui's own dialog or a component's own `<Dialog>`.

### `shell` (the shell, `shell/shellActs.ts`)

| Act | Argument today | Result today | Asks the person |
|---|---|---|---|
| `shell.all_apps` | none | void, leaves for `/apps` (`:208-213`) | no |
| `shell.customize_sidebar` | none | void (`:214-219`) | opens the navigation editor *(inferred: component dialog)* |
| `shell.copy_link` | none | void, toast (`:222-228`, `:334-342`) | no |
| `shell.toggle_sidebar` | none | void (`:230-236`) | no |
| `shell.open_settings` | `{prefix?, pane?, block?}` (`:66-70`), options: settings panes (`:245-248`) | void (`:249`) | no |
| `shell.about` | none | void (`:199`) | opens About dialog, not readable (`shell/AppShell.vue:153`) |
| `shell.my_settings` | none | void (`:294-299`) | no |
| `shell.theme` | `"light" \| "dark" \| "system"`, options: three schemes (`:300-313`) | void, throws on another value | no |
| `shell.desk_v1` | none | void, leaves for `/app` (`:314-319`) | no |
| `shell.log_out` | none | void (`:320-325`) | opens Log out confirm, not readable (`shell/AppShell.vue:156`, `:508`, `shell/LogoutDialog.vue:26`) |
| `shell.create` | `string` or `{doctype, values?}` (`:56`), options: doctypes (`:265-268`) | `CreatedDoc \| null` (`:269-274`, `shell/create.ts:42-64`) | opens the Create dialog on `createRequests`, which is readable in the bundle but is not a `PageDialogs` stack (`shell/create.ts:29-30`) |
| `shell.open` | `{doctype, name?, view?}` (`:59-63`), palette off | void (`:278-287`) | the route guard asks "Discard unsaved changes?" on a dirty record, not readable (`pages/Record.vue:1124-1133`) |
| `shell.frappe.duplicate_automation_flow` | `string`, the flow's name (`frappe/automation/frontend/acts.js:5-14`) | `CreatedDoc \| null` | opens Create |
| `shell.crm.make_a_call` | `string`, a phone number, options: the record's phones and the typed number (CRM `crm/fcrm/frontend/telephony/makeCall.js:51-74`) | void, throws with no number | no *(inferred: the call UI is a window, not a dialog)* |
| `shell.crm.log_a_call` | none (CRM `crm/fcrm/frontend/acts.js:8-16`) | `CreatedDoc \| null` | opens Create |
| `shell.crm.form_scripts_to_rewrite` | none (CRM `acts.js:17-26`) | `NavigationFailure \| void` | no |

### Record page: `header`, `quickActions`, `tabs`

The page draws these from `headerBuiltins()` (`pages/Record.vue:441-507`), `quickActionBuiltins` (`pages/record/builtinActions.ts:15-36`) and `recordTabBuiltins` (`pages/record/tabs/recordTabs.ts:26-60`). The context is `RecordPageApi`.

| Act | Argument today | Result today | Asks the person |
|---|---|---|---|
| `header.favourite` | none | void (`Record.vue:456-463`, `:552-556`) | no |
| `header.save` | none, key `Mod+S` | `boolean` from `page.save()` (`Record.vue:465-472`, `:547-550`, `recordPage/createRecordPage.ts:461-469`) | Required fields dialog, readable (`pages/record/askRequired.ts:21`). Code errors dialog, readable (`Record.vue:1061-1068`). Save conflict confirm, not readable (`Record.vue:1071-1088`). |
| `header.amend` | none | `NavigationFailure \| void` (`pages/record/amendAct.ts:25-37`) | no |
| `header.favourite_row` | none, palette off | void (`builtinActions.ts:74-81`) | no |
| `header.follow_row` | none | void (`builtinActions.ts:84-90`) | no |
| `header.assign` | `string`, a User's name, options: user search with assigned users disabled (`pages/record/assignAct.ts:14-27`, `:30-37`) | void. With no value it toasts and resolves, it does not reject (`assignAct.ts:25`). | no |
| `header.rename` | none, the value is ignored | void (`pages/record/renameAct.ts:9-18`) | Rename form, readable (`renameAct.ts:44-52`). With Merge on, a danger confirm, not readable (`renameAct.ts:68-74`). |
| `header.copy_url`, `header.copy_id` | none | void, toast (`builtinActions.ts:95-96`) | no |
| `header.duplicate` | none | `NavigationFailure \| void` (`builtinActions.ts:99`, `:136-138`) | no |
| `header.customize_form`, `header.edit_doctype` | none | `NavigationFailure \| void` (`builtinActions.ts:108-111`, `pages/doctypeEditor/entries/editorEntries.ts:48-50`) | no |
| `header.edit_layout` | none | `NavigationFailure \| void` (`pages/record/editLayoutItem.ts:6-13`) | no |
| `header.submit` | none, right `submit` | void, also when declined (`pages/record/docstatusActs.ts:48-56`, `recordPage/createRecordPage.ts:481-505`) | confirm, not readable (`docstatusActs.ts:79`) |
| `header.cancel` | none, right `cancel` | void, also when declined (`docstatusActs.ts:59-67`) | danger, not readable (`docstatusActs.ts:88`, `:125`). An information confirm when the user cannot cancel linked records (`:116`). |
| `header.delete` | none | void, also when declined (`builtinActions.ts:104`, `:148-158`) | danger, not readable (`builtinActions.ts:149`) |
| `header.<field act>`, `header.<field act>_from` | none, or `string` (one of the record's values), palette off (`pages/record/fieldActionEntries.ts:29-55`) | what the named act returns | what the named act asks |
| `quickActions.email` | none | void, opens the composer (`builtinActions.ts:23`, `:117-119`) | the composer, not a dialog |
| `quickActions.comment` | none | void, opens the composer (`builtinActions.ts:26`, `:113-115`) | the composer, not a dialog. No act posts a comment. |
| `quickActions.attach` | none | void (`builtinActions.ts:28-29`) | upload dialog with a file picker, not readable (`pages/record/feed/recordFeeds.ts:134-137`, `RecordUploadDialog.vue:33`) |
| `quickActions.print` | none | void, opens `/printview` in a new tab (`builtinActions.ts:30`, `:121-125`) | no |
| `quickActions.copy_link` | none | void (`builtinActions.ts:31`) | no |
| `quickActions.follow` | none | void (`builtinActions.ts:32`) | no |
| `quickActions.<field act>`, `..._from` | as the header rows | as the header rows | as the header rows |
| `tabs.attach_file` | none, palette off | void (`recordTabs.ts:52-60`) | upload dialog, not readable |

`quickActions.tags` has no `run`, so it is not an act (`builtinActions.ts:34`). A new record registers only `header.save` and `header.edit_layout` (`pages/record/UnsavedRecord.vue:320-342`). Its `header.save` returns `NavigationFailure | void` or `boolean` (`UnsavedRecord.vue:376-378`).

### List page: `list` and `header` (`pages/list/listActs.ts`)

The renderer's surface is `typeKey(view.type)` (`listActs.ts:55`, `list/view.ts:37-39`). For the List view it is `list`, so bulk, row and key acts join `list`.

| Act | Argument today | Result today | Asks the person |
|---|---|---|---|
| `list.create` | none, right `create` | void (`listActs.ts:103-112`, `pages/list/ListPage.vue:155-170`) | opens Create |
| `list.favourite` | none | void (`listActs.ts:113-120`) | no |
| `list.open_view` | `{key: string}`, palette off | `NavigationFailure \| void`, throws without a key (`listActs.ts:121-131`, `:178-182`) | no |
| `list.set_default_view` | `{key: string, scope: "user" \| "site"}`, palette off | void, throws on a bad value (`listActs.ts:132-142`, `:184-188`) | no |
| `list.clear_default_view` | `{scope: "user" \| "site"}`, palette off | void (`listActs.ts:143-153`) | no |
| `list.customize_quick_filter` | none | void (`listActs.ts:154-162`) | no |
| `list.customize_form`, `list.edit_doctype` | none | `NavigationFailure \| void` (`listActs.ts:163-166`) | no |
| `list.<script control>` | whatever the script's `run` reads (`listActs.ts:171-176`) | the script's return | unknown |
| `header.favourite`, `header.new` | none, palette off | void (`pages/list/listHeader.ts:40-60`) | `header.new` opens Create |
| `list.submit`, `list.cancel`, `list.workflow-<transition>` | none. The wrapper passes the selection (`pages/list/bulkBarParts.ts:146-160`, `pages/list/bulkStatus.ts:58-85`) | void | bulk status dialog, not readable (`pages/list/BulkStatusDialog.vue:69`) |
| `list.assign`, `list.clear_assignment`, `list.apply_assignment_rule`, `list.add_tags`, `list.remove_tags`, `list.follow`, `list.unfollow`, `list.share`, `list.mark_seen`, `list.mark_unseen` | none, the selection | void (`pages/list/bulkCollaboration.ts:43-60`, `:118-131`) | bulk dialog, not readable (`pages/list/BulkCollabDialog.vue:129`) |
| `list.print` | none, the selection | void (`bulkBarParts.ts:99-107`) | print dialog, not readable *(inferred from `bulkBarParts.ts:21`)* |
| `list.edit` | none, the selection | void (`bulkBarParts.ts:108-116`) | edit dialog, not readable (`pages/list/EditDialog.vue:200`) |
| `list.favourite_records`, `list.unfavourite_records`, `list.unfavourite_matching` | none, the selection | void, writes at once (`pages/list/bulkFavourite.ts:32-33`, `:47-67`) | no |
| `list.copy` | none, the selection | void, clipboard (`bulkBarParts.ts:117-125`) | no |
| `list.export` | none, the selection | void (`bulkBarParts.ts:126-134`) | export dialog, not readable *(inferred from `bulkBarParts.ts:32-34`)* |
| `list.delete` | none, the selection | void (`bulkBarParts.ts:135-142`, `pages/list/ListView.vue:316-319`) | delete dialog, not readable (`pages/list/DeleteDialog.vue:64`) |
| `list.row_<name>` | a `ListRow`, palette off (`pages/list/rowActions.ts:13-25`) | the script's return | unknown |
| `list.toggle_row`, `list.extend_row` | none. They read the row under the pointer, so a caller cannot name a row (`pages/list/bulkKeys.ts:28-47`) | void | no |
| `list.open_bulk_menu`, `list.clear_selection` | none | void (`bulkKeys.ts:48-69`) | no |

The bulk acts are present only while rows are selected and the user's `bulk_actions` switch is on (`pages/list/useBulkBar.ts:81-84`).

### DocType editor (`pages/doctypeEditor/editorActs.ts` and its parts)

The context is `EditorActsHost`. The `passes` check lets every right through and relies on the server (`editorActs.ts:62`).

| Act | Argument today | Result today | Asks the person |
|---|---|---|---|
| `editor.save` | none, key `Mod+S` | void (`editorActs.ts:77-84`, `editorSave.ts:83-95`) | no *(inferred: refusals show in a banner)* |
| `editor.reload_and_reapply`, `editor.write_files_again`, `editor.open_list` | none | void (`editorActs.ts:85-105`) | no |
| `editor.undo`, `editor.redo` | none | void (`editorActs.ts:171-190`) | no |
| `editor.open_tab` | `"editor" \| "settings" \| "preview"`, options: three tabs (`editorActs.ts:191-203`) | the tab | no |
| `editor.find` | none | void (`editorActs.ts:204-210`) | opens the finder, not a dialog |
| `editor.preview_record` | `string \| null`, options: records (`editorActs.ts:211-222`) | void | no |
| `editor.set_mode` | `"Design" \| "Customize"`, options: the modes (`customizeActs.ts:45-62`) | void | Save-before-switch dialog, readable on the shell stack (`DoctypeEditor.vue:410-420`) |
| `canvas.add_tab`, `canvas.add_section` | optional keys, `Record<string, unknown>` (`canvasActs.ts:36-58`) | void | the fork warning in Customize mode, see below |
| `canvas.remove_tab` … `canvas.set_container_property` (11 acts), palette off | keys, `Record<string, unknown>` (`canvasActs.ts:15-34`). The server lists each act's keys (`frappe/desk/doctype_editor/design_edits.py:15-35`). | `Promise<boolean>`, true when staged (`designCanvas.ts:130-134`) | the fork warning |
| `canvas.select` | `CanvasSelection \| null`, palette off (`canvasActs.ts:60-66`) | void | no |
| `fields.add_field` | optional `{label, fieldname?, …keys}` (`canvasActs.ts:80-92`) | void | the fork warning |
| `fields.set_field_property` | `{fieldname} & ({property, value} \| {properties})` (`canvasActs.ts:71-74`, `:93-99`) | void | the fork warning |
| `fields.fetch_field` | `{link, source: FetchSource}` (`:100-106`) | void | the fork warning |
| `fields.reset_field_property` | `{fieldname, property}` (`:107-114`) | `Promise<boolean>` | the fork warning |
| `fields.rename_field` | `{fieldname, new_fieldname}` (`:115-124`) | void | the fork warning |
| `fields.delete_field` | `{fieldname}` (`:125-136`) | void | none in the act. The canvas asks a danger confirm before it calls the act (`fieldPanel.ts:160-180`). |
| `fields.add_child_table` | `{name, table_field, label?, link?}` (`childActs.ts:9-16`) | `Promise<boolean>` | the fork warning |
| `fields.open_child` | `string`, a Table fieldname (`childActs.ts:17-23`) | void | no |
| `fields.reorder_field` | `{fieldname, index}` (`childActs.ts:24-31`) | `Promise<boolean>` | the fork warning |
| `settings.set_doctype_property` … `settings.reset_permissions` (8 acts), palette off | `Keys \| Keys[]` (`editorActs.ts:128-160`) | `Promise<boolean>` or void | the fork warning on description *(inferred)* |
| `customize.reset_all` | none | void (`customizeActs.ts:65-74`, `:95-103`) | Reset dialog, readable on the shell stack (`customizeHost.ts:18-23`) |
| `customize.export` | none | void (`customizeActs.ts:75-81`, `:105-113`) | Export dialog, readable on the shell stack (`customizeHost.ts:24-28`) |
| `danger.change_kind` | optional `{kind}` | void (`dangerActs.ts:74-88`) | Change kind dialog, readable. **A value skips the dialog** (`dangerActs.ts:141`). |
| `danger.rename_doctype` | optional `{name}` | void (`dangerActs.ts:90-103`) | Rename dialog, readable. A value skips it. |
| `danger.move_doctype`, `danger.make_standard` | optional `{module}` | void (`dangerActs.ts:105-119`) | Module dialog, readable. A value skips it. |
| `danger.delete_doctype` | none, the value is ignored | void (`dangerActs.ts:121-133`) | Delete dialog, readable, always |
| `layouts.open` | `LayoutRef` (`layoutActs.ts:21-26`) | void | no |
| `layouts.add` | `{type, title, condition, start}` (`layoutActs.ts:9-14`, `:28-36`) | void | the fork warning |
| `layouts.rename`, `layouts.set_condition`, `layouts.delete`, `layouts.reset_to_app` | `{layout, title}`, `{layout, condition}`, `{layout}`, `{type}` (`layoutActs.ts:37-66`) | `Promise<boolean>` | none in the act. `reset_to_app` asks in a readable shell dialog before the menu calls the act (`layoutDialogs.ts:55-60`). |

Every danger act first asks "Save before you go on?" when edits are pending, in a readable shell dialog (`dangerHost.ts:57-71`).

**The fork warning:** in Customize mode, the first edit that gives a layout type its own site layout asks a confirm before it stages (`designCanvas.ts:130-134`, `forkWarning.ts:21-27`). The confirm is `shellDialog().confirm`, which is not readable (`layoutDialogs.ts:64-67`). So any staging act can wait on a person without saying so.

### Acts added at run time

- **Scripts:** a page script's header item, quick action, tab `create` entry or list control with `run` is an act (`recordPage/pageActs.ts:23-29`, `listActs.ts:171-176`). Its argument and result are whatever the script writes.
- **Apps:** each app's `acts.js` adds `shell.<app>.<item>` (`shell/appActs.ts:33-50`). Found in frappe (`frappe/automation/frontend/acts.js`) and CRM. Helpdesk and Telephony have none on any `desk-v2` branch in this bench.
- **Field actions:** `header.<act>` and `quickActions.<act>` with `_from` twins, named from the target act with `\W` replaced by `_` (`fieldActionEntries.ts:29-31`).
- **Workflow and row actions:** `list.workflow-<transition>` and `list.row_<name>`.

## Confirm and danger call sites

"On a readable stack" means the dialog is an entry in `PageDialogs.entries` (`shell/dialogs/pageDialogs.ts:49`, `:132`), either the page's or the shell's (`shell/dialog.ts:14`).

| Call site | Opened through | Reached from | On a readable stack |
|---|---|---|---|
| `pages/record/builtinActions.ts:149` | `page.dialog.danger` | `header.delete` | no |
| `pages/record/docstatusActs.ts:79` | `page.dialog.confirm` | `header.submit` | no |
| `pages/record/docstatusActs.ts:88` | `page.dialog.danger` | `header.cancel` | no |
| `pages/record/docstatusActs.ts:116` | `page.dialog.confirm` (one Close button) | `header.cancel` | no |
| `pages/record/docstatusActs.ts:125` | `page.dialog.danger` | `header.cancel` with linked records | no |
| `pages/record/renameAct.ts:69` | `page.dialog.danger` | `header.rename` with Merge | no |
| `pages/record/discardChanges.ts:12` | `page.dialog.confirm` | leaving a dirty record: `shell.open`, any link (`Record.vue:1126`, `UnsavedRecord.vue:382`, `RecordDialog.vue:323`) | no |
| `pages/record/discardChanges.ts:12` | `shellDialog().confirm` | leaving a dirty DocType (`DoctypeEditor.vue:402-407`) | no |
| `pages/record/saveResponse.ts:92` | `page.dialog.confirm` | a save or Submit conflict (`Record.vue:1086`) | no |
| `pages/record/staleRecord.ts:24`, `:31` | `page.dialog.confirm` | a conflict on another record (`Record.vue:1074`) | no |
| `pages/recordDialog/saveConflict.ts:19` | `page.dialog.confirm` | a record dialog's save conflict (`RecordDialog.vue:290`) | no |
| `pages/recordDialog/RecordDialog.vue:330` | `page.dialog.danger` | Delete in a record dialog | no |
| `pages/record/feed/FilesTab.vue:105` | `page.dialog.confirm` | Delete file (not an act) | no |
| `pages/doctypeEditor/fieldPanel.ts:173` | `shellDialog().danger` | Remove field, before `fields.delete_field` | no |
| `pages/doctypeEditor/layoutDialogs.ts:66` | `shellDialog().confirm` | the fork warning, inside any staging act | no |
| `pages/settings/SettingsBlocks.vue:194` | frappe-ui `dialog.confirm` | settings pane drafts (`paneDrafts.ts:41`, `bindingDraft.ts:38`) | no |
| `navigation/editor/NavigationEditor.vue:850` | frappe-ui `dialog.confirm` | discarding sidebar edits | no |
| `shell/LogoutDialog.vue:26` | the component's own `<Dialog>` | `shell.log_out` | no |
| `pages/list/DeleteDialog.vue:64` | own `<Dialog>` | `list.delete` | no |
| `pages/list/BulkStatusDialog.vue:69` | own `<Dialog>` | `list.submit`, `list.cancel`, `list.workflow-*` | no |
| `pages/list/BulkCollabDialog.vue:129` | own `<Dialog>` | `list.assign` and the other nine | no |
| `pages/list/EditDialog.vue:200` | own `<Dialog>` | `list.edit` | no |
| `pages/doctypeEditor/dangerHost.ts:33-52` | `shellDialog().open` | `danger.*` | yes, shell stack |
| `pages/doctypeEditor/dangerHost.ts:57-71`, `DoctypeEditor.vue:410-420` | `shellDialog().open` (ModeSwitchDialog) | `danger.*`, `editor.set_mode` | yes, shell stack |
| `pages/doctypeEditor/customizeHost.ts:18-28` | `shellDialog().open` | `customize.reset_all`, `customize.export` | yes, shell stack |
| `pages/doctypeEditor/layoutDialogs.ts:59` | `shellDialog().open` | Reset to app layout | yes, shell stack |

Notes:

- `page.dialog.confirm` and `danger` are tracked only as a close function in `openDialogs`, so `closeAll` can close them (`pageDialogs.ts:58-69`). They carry no id, title or answer that a reader can get.
- `shellDialog().confirm` and `danger` are not tracked at all: `track` is a no-op (`shell/dialog.ts:33`).
- The only "danger" dialogs on a readable stack are the DocType editor's. Every record and list confirm is off the stack.

## Findings that shape the declaration

1. **A declined confirm looks like success.** `header.submit`, `header.cancel`, `header.delete` and `header.rename` return `undefined` both when done and when the person declines (`recordPage/createRecordPage.ts:485`, `pages/record/builtinActions.ts:153`). The `{ok, data, error}` result needs the act to say "declined".
2. **Navigation hides its outcome.** `shell.open` awaits `router.push` and drops its result (`shellActs.ts:282-285`). When the discard confirm keeps the page, the push resolves with a navigation failure *(inferred from vue-router's documented behavior)*, and the act still resolves `undefined`.
3. **A value skips the confirm.** `danger.change_kind`, `danger.rename_doctype`, `danger.move_doctype` and `danger.make_standard` run with no dialog when given a value (`dangerActs.ts:141`). The audit named three, `make_standard` is the fourth. `fields.delete_field` and `layouts.reset_to_app` have their confirm outside the act, so a caller skips it by calling the act.
4. **Failures are reported, not returned.** `header.assign` with no user toasts and resolves (`assignAct.ts:25`). `page.save()` reports a failure and resolves `false` (`createRecordPage.ts:461-469`), so the error text goes to a toast, not to the caller.
5. **About ten acts take a value that is not an object:** `header.assign`, `shell.theme`, `editor.open_tab`, `editor.preview_record`, `editor.set_mode`, `fields.open_child`, the `_from` field actions, `shell.crm.make_a_call`, `shell.frappe.duplicate_automation_flow`, and `shell.create` (string or object). `settings.*` takes an object or an array. The palette passes `ActOption.value` to `run` as is, so these shapes are part of the palette contract.
6. **One name, two pages.** The record page and the list page both register a `header` surface. `header.favourite` is a different act on each. The last scope registered answers (`dispatcher.ts:109-127`).
7. **Existing key lists.** The server's `CANVAS_ACTS` lists the keys of each canvas edit act (`frappe/desk/doctype_editor/design_edits.py:15-35`), and `test_ts_parity.py` already compares TS and Python lists. These lists can seed the editor acts' schemas.

## Prior art

| System | Name rule | Description | Arguments | Result and error | Confirm |
|---|---|---|---|---|---|
| MCP 2025-11-25 tools | 1 to 128 of `A-Z a-z 0-9 _ - .`, so `admin.tools.list` is valid | `description`, "a hint to the model". Optional `title` for display. | `inputSchema`, a JSON Schema object, 2020-12 by default. A tool with no arguments: `{"type":"object","additionalProperties":false}`. Optional `outputSchema` for `structuredContent`. | `content`, `structuredContent`, `isError`. A tool failure, including a bad argument, is a result with `isError: true` so the model can correct itself. An unknown tool is a JSON-RPC error. | "there SHOULD always be a human in the loop with the ability to deny tool invocations". `annotations`: `readOnlyHint`, `destructiveHint` (default true), `idempotentHint`, `openWorldHint`, all hints, untrusted from untrusted servers. Tasks have an `input_required` status for a call that waits on input. |
| Anthropic Messages API | `^[a-zA-Z0-9_-]{1,128}$`, no dot | "Aim for at least 3–4 sentences": what it does, when to use it, what each parameter means, caveats | `input_schema` (JSON Schema). Optional `input_examples`, each checked against the schema. Optional `strict`. | `tool_result` with `is_error: true`. "Write instructive error messages": say what went wrong and what to try next. | not in the API. The application decides. |
| OpenAI function tools | a-z, A-Z, 0-9, `_`, `-`, at most 64 | "Explicitly describe the purpose of the function and each parameter (and its format), and what the output represents." Fewer than 20 functions at the start of a turn. | `parameters` (JSON Schema). Omitted means no parameters. `strict: true` needs `additionalProperties: false` on every object and every property in `required`, with `null` in the type for an optional one. | `function_call_output` with `call_id` and an `output` string. | not in the API |
| VS Code `contributes.commands` | a command ID, such as `extension.sayHello` | `title`, `category`, `icon`, `enablement` (a when clause) | none. `executeCommand(id, ...args)`. Built-in commands describe arguments in prose only. | whatever the command returns | not declared |
| VS Code `contributes.languageModelTools` | `{verb}_{noun}` with an extension prefix | `modelDescription` for the model ("what the tool does, what it returns, and when it should or should not be used"), `userDescription` for the UI, `displayName` | `inputSchema`, "must describe an `object` with typed properties". A `when` clause controls when the tool is available. | `LanguageModelToolResult`. On error, "throw an error with a message that makes sense to the LLM". | "A generic confirmation dialog will always be shown for tools from extensions". `prepareInvocation` returns `confirmationMessages` (`title`, `message`). The user can choose "Always Allow". |
| `frappe/mcp` (this repo) | snake_case: `get_document` | one sentence: "Delete a document." (`frappe/mcp/tools/documents.py:145-151`) | a pydantic `ToolArguments` model with `strict=True, extra="forbid"` (`frappe/mcp/tools/__init__.py:55-58`), emitted as compact JSON Schema without titles (`:22-49`, `:74-81`) | `structuredContent` plus the same JSON as text. A non-object value is wrapped as `{"result": value}` (`:155-162`). A bad argument is `isError: true` with "Invalid tool arguments: <field>: <message>" (`:132-135`, `:165-176`). | `annotations` with `readOnlyHint` or `destructiveHint` (`documents.py:105-151`) |

Sources:

- MCP tools: https://modelcontextprotocol.io/specification/2025-11-25/server/tools
- MCP schema (`Tool`, `ToolAnnotations`, `CallToolResult`): https://modelcontextprotocol.io/specification/2025-11-25/schema
- MCP tasks (`input_required`): https://modelcontextprotocol.io/specification/2025-11-25/basic/utilities/tasks
- Anthropic, define tools: https://platform.claude.com/docs/en/agents-and-tools/tool-use/define-tools
- Anthropic, handle tool calls: https://platform.claude.com/docs/en/agents-and-tools/tool-use/handle-tool-calls
- OpenAI function calling: https://developers.openai.com/api/docs/guides/function-calling
- OpenAI name rule, from the SDK's `FunctionDefinition` comment: https://unpkg.com/openai@4.45.0/src/resources/shared.ts
- VS Code contribution points: https://code.visualstudio.com/api/references/contribution-points
- VS Code built-in commands: https://code.visualstudio.com/api/references/commands
- VS Code language model tools: https://code.visualstudio.com/api/extension-guides/ai/tools
- `frappe/mcp` serves protocol versions `2026-07-28` and `2025-11-25` (`frappe/mcp/protocol.py:11-13`). This note reads the 2025-11-25 spec. The 2026-07-28 text was not read.

What the survey shows for acts:

- All five LLM-facing formats use a name, a description and a JSON Schema whose root is an object. None has an argument format of its own.
- Only MCP allows the dot. For Anthropic and OpenAI an adapter maps `header.save` to a name such as `header__save`. No act name contains `__` today *(inferred from the inventory above, not checked by a test)*.
- MCP, VS Code and `frappe/mcp` all mark a tool that changes or deletes. VS Code shows a confirm for every extension tool. MCP says the host SHOULD confirm. Ruling 4 is stricter: the person answers every confirm the act asks, whoever calls.
- The description guidance agrees: say what the act does, what it returns, when not to use it, and what each argument means.

## What a JSON Schema costs in the bundle

Method: each option declares the same three schemas (`header.save`, `header.assign`, `shell.open`), checks a value, and where the option can, emits JSON Schema. esbuild bundles it with `--bundle --minify --format=esm`. Size is `gzip -9`. All five options gave the same verdicts on the same three test values.

| Option | Check only, gzip | Check and emit JSON Schema, gzip | Raw, minified |
|---|---|---|---|
| zod 4.6.7 (`zod`) | not measured | 27.0 KB | 91.9 KB |
| Zod Mini (`zod/mini`) | 5.3 KB | 12.4 KB | 37.5 KB |
| Valibot 1.5.0 with `@valibot/to-json-schema` | 1.6 KB | 4.8 KB | 17.6 KB |
| Hand-written JSON Schema with `@cfworker/json-schema` 4.1.6 | 6.6 KB (the schema is the declaration) | same | 23.2 KB |
| Hand-written JSON Schema with a 30-line checker for the keywords acts use (`type`, `properties`, `required`, `additionalProperties`, `enum`, `minLength`, `items`) | 0.7 KB | same | 1.4 KB |

The libraries' own claims: Zod Mini is 64% smaller than Zod for a small script (https://zod.dev/packages/mini). Valibot starts "at less than 700 bytes" (https://valibot.dev/guides/introduction/). Neither claim includes JSON Schema output, which an act list needs.

The declarations cost more than the checker. The three proposed declarations below, with their descriptions, are 1.6 KB raw and 0.7 KB gzip (measured). At about 127 built-in acts, all declarations would be about 65 KB raw *(inferred: linear from three)*. The record page's acts are about 25 of these, about 13 KB raw *(inferred)*. The record page already loads 468.9 KB of JS against a 460 KB budget (`frontend/speed-budgets.json:5`). No runtime dependency validates schemas today (`frontend/package.base.json:17-46`).

## Proposed declarations

### New act fields

```ts
/** JSON Schema 2020-12, limited to the keywords the dispatcher's checker reads. */
export type ActSchema = Record<string, unknown>;

/** A dialog an act may open and wait on until the person answers. */
export type ActAsk = "confirm" | "danger" | "dialog" | "picker";

export interface ActFields<Context = any> {
	// ...the fields there now...
	/** What the act does, for an agent: what it changes, what it returns, what it asks the person. */
	description?: string;
	/** The value `run` takes. Absent: the act takes no value, and the dispatcher refuses one. */
	input?: ActSchema;
	/** The `data` the act resolves with. Absent: `data` is `null`. */
	output?: ActSchema;
	/** The dialogs the act may wait on. An agent's call then returns "waiting for the user" until the person answers. */
	asks?: ActAsk[];
}
```

Rules this proposal adds:

1. **The value keeps its shape.** `input` describes the value `run` gets, as the palette passes it, so the palette contract does not change. An adapter for MCP, Anthropic or OpenAI wraps a schema whose root is not an object as `{"type":"object","properties":{"value": <input>},"required":["value"],"additionalProperties":false}` and unwraps the call. `frappe/mcp` already wraps a non-object result as `{"result": value}` (`frappe/mcp/tools/__init__.py:156`).
2. **The palette's options must pass `input`.** A unit test can check every `options` result against the act's `input`.
3. **The result.** The dispatcher wraps the return as `{ok: true, data}`. It turns `ActDenied` into `{ok: false, error: {code: "missing" | "hidden" | "right"}}`, a refused value into `code: "invalid"` with the checker's message, and a throw into `code: "failed"` with the message. An act that the person declines returns `code: "declined"`. This needs the acts in finding 1 to return a declined marker, not `undefined`.
4. **Names for other formats.** MCP uses the act's full name. Anthropic and OpenAI adapters replace `.` with `__`.
5. **MCP hints.** `asks` containing `danger`, or an act on the `danger` surface, maps to `destructiveHint: true`. An act with no `asks` and no write maps to `readOnlyHint: true` *(inferred: needs a per-act decision, not derived)*.
6. **Where the text lives.** Inline on the act is the simplest and lets CI check "an act in the palette has a description". If the bytes matter on the record page, move `description`, `input` and `output` into a sidecar module per surface that loads on the first `window.desk` call. The palette does not need them.

### `header.save`

```ts
{
	name: "save",
	label: "Save",
	icon: "lucide-save",
	display: "button",
	key: "Mod+S",
	description:
		"Save the record open on this page. A new record is inserted. When a required field is empty, " +
		"the person sees the Required fields dialog and the act waits for it. When someone else saved " +
		"the record first, the person is asked what to do. data is true when the record is saved, " +
		"false when the save did not go through.",
	output: { type: "boolean" },
	asks: ["dialog", "confirm"],
	run: saveFromHeader,
}
```

No `input`: the act takes no value, and the MCP tool's `inputSchema` is `{"type":"object","additionalProperties":false}`. For `data: false` to carry a reason, `page.save()` must give the refusal's message to the caller, not only to `reportSave` (`createRecordPage.ts:458-469`).

### `header.assign`

```ts
{
	name: "assign",
	label: __("Assign to…"),
	icon: "lucide-user-plus",
	group: "assign_band",
	right: "write",
	description:
		"Assign the record open on this page to one more user. It adds an assignment and keeps the " +
		"ones there. Use the act's options to find a user by name. A user who is assigned already is refused.",
	input: {
		type: "string",
		minLength: 1,
		description: 'The user\'s ID, the User record\'s name, such as "jane@example.com".',
	},
	argument: {
		label: __("Users"),
		options: (_page, query) => assignOptions(state.assignees, query),
	},
	run: (page, user: string) => state.assign(page, user),
}
```

With `input`, the dispatcher refuses a missing user before `run`, so the toast branch at `assignAct.ts:25` goes. The adapter's tool takes `{"value": "jane@example.com"}`. No `asks`: the act writes with no dialog. Whether the server refuses a user who is assigned already, or the act must check, was not checked *(inferred)*.

### `shell.open`

```ts
{
	name: "open",
	palette: false,
	description:
		"Open a record, the list of a DocType, or a saved view of that list, in this tab. Leave out " +
		"name to open the list. When the page has unsaved changes, the person is asked to discard them " +
		"first, and the act waits. data.opened is false when the person kept the page.",
	input: {
		type: "object",
		properties: {
			doctype: { type: "string", minLength: 1, description: 'The DocType\'s name, such as "Sales Invoice".' },
			name: { type: ["string", "null"], description: "The record's name. Leave it out, or send null, for the list." },
			view: { type: "string", description: "The key of a saved view of the list. Used only without name." },
		},
		required: ["doctype"],
		additionalProperties: false,
	},
	output: {
		type: "object",
		properties: { opened: { type: "boolean" }, path: { type: "string" } },
		required: ["opened", "path"],
	},
	asks: ["confirm"],
	run: async (shell, { doctype, name, view }: OpenValue) => {
		const failure = await shell.router.push(routeFor(doctype, name, { view }));
		return { opened: !failure, path: shell.router.currentRoute.value.fullPath };
	},
}
```

The `if (!doctype) throw` line (`shellActs.ts:283`) goes, because `input` refuses a missing doctype. `view` is used only without `name` because `routeFor` reads `name` first (`router/routeFor.ts:63-71`). For OpenAI `strict` mode the adapter must list `name` and `view` in `required` and add `null` to `view`'s type. Without `strict` the schema works as written.

## Not checked

- The 2026-07-28 MCP spec that `frappe/mcp` also serves.
- Whether `customize_sidebar`, `list.print` and `list.export` open a component `<Dialog>`. The table marks these *(inferred)*.
- Act behavior in a browser. Every row comes from reading code, not from a walk.
- The JS size of all 127 declarations. The figure is linear from three measured ones.
- The palette, key binder or script code paths that call `acts.run` with a value that a strict `input` would now refuse.
