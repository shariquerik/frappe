# CRM settings: the setup doctypes' standard pages against CRM v1

Research ticket [#45949](https://github.com/frappe/frappe/issues/45949) on map [#45946](https://github.com/frappe/frappe/issues/45946) (Desk v2 — CRM settings).

**Measured on:** frappe `desk-v2` at `00b069a379` and crm `desk-v2` at `06f120a14`, on 2026-10-31. CRM paths are relative to `apps/crm` at that sha. Frappe paths are relative to `apps/frappe`. `Settings/` means `frontend/src/components/Settings/` in crm.

**Method:** a static read of both trees. No page was walked on a site.

## Verdicts

- **built-in:** the standard list or record page does the job with no script.
- **record.js:** a file script does it. For a CRM doctype it is `<module>/doctype/<doctype>/frontend/record.js`. For a frappe doctype it is CRM's `custom/<doctype>/record.js`. The `page` verbs are named.
- **gap:** no contribution can carry the job. The text is the body of a proposed `Desk v2: ` single issue.
- **drop:** CRM v1 does it, and the owner confirms that desk v2 does not.

## What desk v2 gives every standard page

These facts decide most verdicts below.

1. Every fieldtype these doctypes use has a control: Code, JSON, Password, Duration, Time, Table, Table MultiSelect, Text Editor and Autocomplete (`ui/src/components/Fields/fieldTypes.ts:66-128`).
2. A `Button` field is inert. Its click needs a `decorate` overlay (`ui/src/components/Fields/ButtonField.vue:7-12`). The record page passes no `decorate` to `createRecordPage` (`frontend/src/pages/Record.vue:776-801`). A field handler fires when a field commits a value (`frontend/SCRIPTING.md:1094-1096`), and a Button has no value.
3. The header has no rename and no duplicate. The built-ins are `doctype`, `record`, `favourite`, `save`, `favourite_row`, `follow_row`, `copy_url`, `copy_id` and `delete` (`frontend/SCRIPTING.md:659-673`). Rename is already filed as [#45898](https://github.com/frappe/frappe/issues/45898). REST v2 has `copy_doc` (`frappe/api/v2.py:294-302`), but no page act uses it.
4. `page.call(method, params)` posts to `/api/v2/method/<method>` (`frontend/src/pageEngine/createPageEngine.ts:177-178`). REST v2 mounts `/method/run_doc_method` (`frappe/api/v2.py:742-746`, `run_doc_method` at `:653`). So a script can run a whitelisted document method from a header act.
5. `page.fields` reaches the parent's fields only. It looks a name up in the parent meta's fields (`frontend/src/recordPage/fields.ts:186-191`). A script cannot change a child table column's `options`.
6. `@framework/ui` is on the import list for app files (`frontend/ARCHITECTURE.md:470-476`). It has `ConditionBuilder`, "the control behind an Assignment Rule's conditions, an SLA's" (`ui/src/components/ConditionBuilder/ConditionBuilder.md:1-6`). `toConditionExpression(tree, { fieldPrefix })` compiles the tree to the Python that `safe_eval` runs (`ui/src/components/ConditionBuilder/adapters.ts:56-61`, `types.ts:18-21`). `fromFrappeConditions` and `toFrappeConditions` read and write the JSON (`adapters.ts:27`, `:68`).
7. Desk v1 form scripts (`<doctype>.js`) do not run on desk v2. A desk v1 `set_query`, `set_df_property` or field trigger needs a `record.js` port.

## Email Account (S11)

CRM v1 pane: `Settings/EmailConfig.vue` with `EmailAccountList.vue`, `EmailAccountCard.vue`, `EmailAdd.vue`, `EmailEdit.vue` and `emailConfig.js`. Managers see it (`Settings/Settings.vue:179-185`). Ruling 4 keeps Email Account System Manager only, so on desk v2 only a System Manager reaches these pages.

| CRM v1 job | Source | Verdict |
| --- | --- | --- |
| List accounts, with the default badges | `EmailAccountList.vue:65-83`, `EmailAccountCard.vue:31-44` | **built-in.** `default_incoming` and `default_outgoing` are list columns if the build sets `in_list_view`, or the reader adds them. |
| Pick a service preset (GMail, Outlook, Sendgrid, SparkPost, Yahoo, Yandex, Frappe Mail) | `emailConfig.js:100-164`, `crm/api/settings.py:49-98` | **gap 1.** The `service` Select is in core (`frappe/email/doctype/email_account/email_account.json`). Its server defaults are applied by the desk v1 script (`email_account.js:1-73`, `:165-188`), which desk v2 does not run. The server sets only Sendgrid's `login_id` and Frappe Mail's flags (`email_account.py:161-168`). |
| Enter the password or the Frappe Mail API key and secret | `emailConfig.js:68-98` | **built-in.** `password` and `api_secret` are Password fields. |
| Check the credentials before save | `crm/api/settings.py:38-44` | **built-in.** Core `validate` checks the IMAP folders and the connection when incoming is on (`email_account.py:170-200`). |
| CRM defaults on create: an IMAP folder with `append_to: CRM Lead`, `create_contact`, `track_email_status` | `crm/api/settings.py:22-44` | **record.js** (`custom/email_account/record.js`). `onOpen`: `if (page.isNew)`, set the values on `page.doc` and push the `imap_folder` row. |
| `create_lead_from_incoming_email` toggle | `crm/install.py:308-327` | **built-in.** It is a Custom Field, so the page draws it after `create_contact`. |
| OAuth | none in CRM v1 | **built-in** for the fields. The `authorize_api_access` Button is inert (fact 2), see gap 1. |
| Rename | `EmailEdit.vue:191-198` | **gap**, filed as [#45898](https://github.com/frappe/frappe/issues/45898). |
| Delete | none in CRM v1 | **built-in** (`header.delete`). |

## Email Template (S12)

CRM v1 pane: `Settings/EmailTemplate/`. Every CRM user sees it (`Settings/Settings.vue:186-190`).

| CRM v1 job | Source | Verdict |
| --- | --- | --- |
| List templates for CRM Lead and CRM Deal only | `EmailTemplate/EmailTemplatePage.vue:31-52` | **built-in**, unfiltered. Ruling 6 keeps the CRM-filtered view in fog. The reader can filter on `reference_doctype`. |
| Search by name and subject, filter by doctype | `EmailTemplates.vue:54-79` | **built-in** (list search and filters). |
| Enabled switch in the list row | `EmailTemplates.vue:105-112`, `:186-208` | **drop.** The reader sets `enabled` on the record page. |
| Create and edit: name, subject, doctype, enabled | `NewEmailTemplate.vue:19-115` | **built-in.** Email Template is named by prompt (`email_template.json`, `autoname: Prompt`). |
| Doctype limited to CRM Lead and CRM Deal | `NewEmailTemplate.vue` (`reference_doctype` select) | **record.js** (`custom/email_template/record.js`). `onRefresh`: `page.fields.update('reference_doctype', { link_filters: [['name', 'in', ['CRM Lead', 'CRM Deal']]] })`. Owner: keep it, or allow any doctype on a site-wide page. |
| Rich text or HTML body | `NewEmailTemplate.vue:35-115` | **built-in.** `response` (Text Editor) and `response_html` (Code, Jinja) switch on `use_html` by `depends_on`. CRM v1's create never sets `use_html` (`NewEmailTemplate.vue:169-182`, against `EditEmailTemplate.vue:156`). |
| Preview | none in CRM v1 | none. |
| `enabled` and `reference_doctype` fields | `crm/install.py:279-305` | **built-in.** Core already has `reference_doctype` (`email_template.json`). The build ticket checks that CRM's custom field of the same name adds nothing. |
| Duplicate | `EmailTemplates.vue:227`, `NewEmailTemplate.vue:185-189` | **gap 2.** |
| Rename | `EditEmailTemplate.vue:216-233` | **gap**, filed as [#45898](https://github.com/frappe/frappe/issues/45898). |
| Delete | `EmailTemplates.vue:210-233` | **built-in**. |

## Assignment Rule (S13)

CRM v1 pane: `Settings/AssignmentRules/`. Managers see it (`Settings/Settings.vue:212`). Desk v1's form script sets the target query and the Select options (`frappe/automation/doctype/assignment_rule/assignment_rule.js:4-76`).

| CRM v1 job | Source | Verdict |
| --- | --- | --- |
| List rules for CRM Lead and CRM Deal | `crm/api/assignment_rule.py:7-22` | **built-in**, unfiltered (ruling 6). |
| Edit priority in the list row | `AssignmentRuleListItem.vue:167-195` | **drop.** The reader sets `priority` on the record page. |
| Name, description, priority, enabled | `AssignmentRuleView.vue:27-118` | **built-in.** The field is `disabled`, so the page shows "Disabled" where CRM v1 shows "Enabled". |
| Apply On: CRM Lead or CRM Deal | `AssignmentRuleView.vue:124-139` | **record.js** (`custom/assignment_rule/record.js`). `onRefresh`: `page.fields.update('document_type', { link_filters })`. Owner: same choice as Email Template. |
| Condition builder, with the JSON and the Python | `AssignmentRulesSection.vue:63-88`, `AssignmentRuleView.vue:670-681`, `crm/install.py:587-614` | **record.js.** `onRefresh`: `page.fields.update('assign_condition_json', { component })`, where the component wraps `ConditionBuilder` with `doctype` set to `page.doc.document_type`. Same for `unassign_condition_json`. A field handler `assign_condition_json(page)` writes `page.doc.assign_condition = toConditionExpression(fromFrappeConditions(...))` (fact 6). CRM's property setters hide the Python field when the JSON is set (`crm/install.py:540-585`). |
| Legacy Python condition banner | `AssignmentRuleView.vue:161-204` | **record.js.** `onRefresh`: `if (page.doc.assign_condition && !page.doc.assign_condition_json) page.form.add({ name: 'legacy_condition', component }, { before: <conditions section> })`. |
| Close condition | none in CRM v1 | **built-in** (`close_condition`, Code). |
| Schedule: which weekdays | `AssignmentSchedule.vue:45-80` | **built-in** (`assignment_days` grid). **record.js** for the default of all seven days: `onOpen`: `if (page.isNew)`, push seven rows. |
| Rule type: Round Robin or Load Balancing | `AssigneeRules.vue:138-147` | **built-in.** The Select also offers Based on Field and Weighted Distribution. |
| `due_date_based_on` and `field` options from the target's fields | desk v1 `assignment_rule.js:59-76` | **record.js.** `onRefresh`: read the target's meta with `page.cached('meta:' + page.doc.document_type, ...)`, then `page.fields.update('due_date_based_on', { options })` and the same for `field`. Without it both Selects are empty. |
| Users | `AssigneeSearch.vue:119-147` | **built-in** (`users`, Table MultiSelect on User). Desk User has select on User (`frappe/core/doctype/user/user.json`). |
| Users limited to CRM users, no Administrator | `AssigneeSearch.vue:119-132` | **drop.** `page.fields` cannot filter the link inside a Table MultiSelect row (fact 5). The picker lists every desk user. |
| Block enabling a rule with no users | `AssignmentRuleListItem.vue:171-178` | **record.js.** `beforeSave`: if `!page.doc.disabled` and `users` is empty for Round Robin or Load Balancing, `throw page.fields.setError('users', ...)`. |
| Last user badge | `AssigneeRules.vue:99-110` (never set) | **built-in** (`last_user`, read only). |
| Duplicate | `AssignmentRuleListItem.vue:132-165`, `crm/api/assignment_rule.py:26-32` | **gap 2.** A header act could call CRM's `duplicate_assignment_rule`. The map's rule sends a framework gap to frappe, not to a CRM endpoint. |
| Rename | `AssignmentRuleView.vue:753-776` | **gap**, filed as [#45898](https://github.com/frappe/frappe/issues/45898). |
| Delete | `AssignmentRuleListItem.vue:116-146` | **built-in**. |

## CRM Service Level Agreement (S14)

CRM v1 pane: `Settings/Sla/`. Managers see it (`Settings/Settings.vue:212`). The doctype is CRM's, so its script is `crm/fcrm/doctype/crm_service_level_agreement/frontend/record.js`.

| CRM v1 job | Source | Verdict |
| --- | --- | --- |
| List with search, Default badge and Apply On | `SlaPolicyList.vue:14-37`, `:82-86` | **built-in**. |
| Enabled switch in the list row | `SlaPolicyList.vue:252-268` | **drop.** |
| Name, Apply On, Rolling Responses, start and end dates, enabled | `SlaPolicyView.vue:26-208` | **built-in**. Naming is `field:sla_name` (`crm_service_level_agreement.json:3-4`). |
| Condition builder | `SlaAssignmentConditions.vue:47-49`, `SlaPolicyView.vue:434-438` | **record.js**, as for Assignment Rule, on `condition_json` and `condition`, with `fieldPrefix: 'doc'` (fact 6). The server evaluates `condition` on save (`crm_service_level_agreement.py:65-72`). |
| Response time by priority | `SlaPriorityList.vue:36-64` | **built-in** (`priorities` grid on CRM Service Level Priority: `priority` Link, `first_response_time` Duration, `default_priority` Check). Neither CRM v1 nor the doctype has a resolution time. |
| A new SLA gets one row per communication status | `SlaPriorityList.vue:141-167` | **record.js.** `onOpen`: `if (page.isNew)`, read the statuses with `page.call` and push the rows. |
| One default priority | `SlaPriorityList.vue:236-241`, desk v1 `crm_service_level_agreement.js:20-30` | **record.js.** `beforeSave`: throw `page.fields.setError('priorities', ...)` when more than one row is default. |
| Working days and hours | `SlaHolidays.vue:243-280`, `WorkDayModal.vue:11-46` | **built-in** (`working_hours` grid on CRM Service Day: `workday` Select, `start_time` and `end_time` Time). **record.js** for the Monday to Friday, 09:00 to 17:00 default (`Sla/utils.js:4-30`): `onOpen`, `if (page.isNew)`. |
| Date order, unique priorities, unique workdays, start before end | `Sla/utils.js:96-283` | **record.js** (`beforeSave` with `setError`). Owner: or drop, because the server checks none of these. |
| Pick a holiday list | `SlaHolidays.vue:15-73` | **built-in** (`holiday_list` Link). |
| Create and edit holiday lists | `SlaHolidays.vue:240-242`, `:282-286` (opens desk v1) | **built-in** on the CRM Holiday List standard pages. Its two Button fields, `add_to_holidays` and `clear_table`, are inert (fact 2). **record.js** (`crm_holiday_list/frontend/record.js`): hide the two fields, and add header acts. `add_to_holidays` runs `page.call('run_doc_method', { document: page.doc, method: 'get_weekly_off_dates' })` and pushes the rows into `page.doc.holidays`. `clear_table` empties `page.doc.holidays` (desk v1 `crm_holiday_list.js:5-30`). |
| Default SLA, one per Apply On | `SlaPolicyView.vue:113-118` | **built-in.** The server refuses a second default (`crm_service_level_agreement.py:53-63`). |
| Default turns enabled on, and the default cannot be disabled | `SlaPolicyView.vue:384-397` | **record.js.** A field handler `default(page)` sets `page.doc.enabled = 1`. `beforeSave` refuses `default && !enabled`. |
| Duplicate | `SlaPolicyList.vue:198-232` | **gap 2.** |
| Rename | `SlaPolicyView.vue:459-468` | **gap**, filed as [#45898](https://github.com/frappe/frappe/issues/45898). |
| Delete | `SlaPolicyList.vue:234-250` | **built-in**. |

## Lead Sync Source and Failed Lead Sync Log (S20)

CRM v1 pane: `Settings/LeadSyncing/`. Managers see it (`Settings/Settings.vue:245-249`). The doctypes are CRM's, under `crm/lead_syncing/doctype/`.

| CRM v1 job | Source | Verdict |
| --- | --- | --- |
| List sources | `LeadSyncSources.vue:54-58` | **built-in**. |
| Enabled switch in the list row | `LeadSyncSources.vue:79-84` | **drop.** |
| Create: type, name, frequency, access token | `LeadSyncSourceForm.vue:51-101` | **built-in.** `access_token` is a Password field. |
| Fetch the Facebook pages and lead forms | `lead_sync_source.py:51-54`, `facebook.py:142-217` | **built-in.** The server fetches them in `before_insert`. |
| Page and lead form only after the first save, lead form filtered by page | `LeadSyncSourceForm.vue:111-126`, `:343-349` | **record.js** (`lead_sync_source/frontend/record.js`). `onRefresh`: `if (page.isNew)` hide `facebook_page` and `facebook_lead_form`. Also `page.fields.update('facebook_lead_form', { link_filters: { page: page.doc.facebook_page } })`. A field handler `facebook_page(page)` clears `facebook_lead_form`. |
| Enable a source | `LeadSyncSourceForm.vue:17` | **built-in.** The server refuses two enabled sources on one form (`lead_sync_source.py:33-49`). |
| Last synced at | `LeadSyncSourceForm.vue:103-109` | **built-in** (read only). |
| Sync now | `LeadSyncSourceForm.vue:21-27`, `lead_sync_source.py:56-62` | **record.js.** `onRefresh`: `if (!page.isNew) page.header.add({ name: 'sync_now', label, run: (page) => page.call('run_doc_method', { document: page.doc, method: 'sync_leads' }) })`. |
| Map lead form questions to CRM Lead fields | `LeadSyncSourceForm.vue:129-153`, `:362-374`, `facebook_lead_form_question.json:46-49` | **record.js** on the Facebook Lead Form page (`facebook_lead_form/frontend/record.js`). `mapped_to_crm_field` is an Autocomplete with no options, and `page.fields` cannot set a child column's options (fact 5). So the script hides `questions` and adds a form part (`page.form.add`) with one row per question and a picker of CRM Lead fields that writes `page.doc.questions[i].mapped_to_crm_field`. Gap 4 would let the build keep the standard grid. The server requires `first_name` to be mapped (`facebook_lead_form.py:28-48`). |
| Edit the source and the mapping with one save | `LeadSyncSourceForm.vue:260-279` | **drop.** The mapping saves on the Facebook Lead Form page. The source page links to it through the `facebook_lead_form` field. |
| Failed syncs of a source | `LeadSyncSourceForm.vue:194-210`, `FailureLogs.vue:101-119` | **built-in** on the Failed Lead Sync Log list, filtered on `source`. **record.js** for a link from the source: `page.header.add({ name: 'failed_syncs', label, href })` to the list with a `source` filter. |
| Read a failed sync | `FailureLogs.vue:20-55` | **built-in.** `lead_data` and `traceback` are read-only Code fields. |
| Retry a failed sync | `FailureLogs.vue:127-144`, `failed_lead_sync_log.py:25-40` | **record.js** (`failed_lead_sync_log/frontend/record.js`). `onRefresh`: `if (page.doc.type !== 'Synced') page.header.add({ name: 'retry', label, run })`, where `run` calls `page.call('run_doc_method', { document: page.doc, method: 'retry_sync' })`, then `page.refresh()`. |
| Delete a source or a log | `LeadSyncSources.vue:171-181` | **built-in**. |
| Duplicate a source | `LeadSyncSources.vue:183-197` | **drop.** It opens the same record in CRM v1 (`LeadSyncSourceForm.vue:312-315`). A Facebook lead form takes one enabled source. |
| Rename | none in CRM v1 | **gap**, filed as [#45898](https://github.com/frappe/frappe/issues/45898), not needed for parity. |

## The pages for a Sales Manager under ruling 4

Ruling 4 gives Sales Manager read, write and create on Assignment Rule and Email Template. A static read finds no step on these pages that needs a further right:

- **Link search on DocType** (`document_type`, `reference_doctype`, `apply_on`): search on DocType runs with `ignore_permissions` (`frappe/desk/search.py:339-355`).
- **Link search on User** (Assignment Rule `users`, `last_user`): Desk User has select on User (`frappe/core/doctype/user/user.json`).
- **The `due_date_based_on` and `field` options:** the script reads CRM Lead or CRM Deal meta, which a Sales Manager reads.
- **Save:** Assignment Rule's `validate` checks only ToDo and repeated days (`assignment_rule.py:45-67`). Email Template's controller and CRM's override check no role (`email_template.py:34-36`, `crm/overrides/email_template.py:5-50`).
- **CRM's own doctypes:** CRM Service Level Agreement, Lead Sync Source, Facebook Page, Facebook Lead Form and Failed Lead Sync Log already give Sales Manager full rights (the doctype JSONs' `permissions`).

Three points for the build tickets:

1. **Email Account.** A Sales Manager has no read on it, so its list refuses them. The Setup sidebar's Email Accounts row must not show to them ([#45950](https://github.com/frappe/frappe/issues/45950), ruling 3).
2. **A Sales User reads Email Template and CRM Holiday List.** Desk User reads Email Template (`email_template.json` permissions). Sales User has full rights on CRM Holiday List (`crm_holiday_list.json:105-129`). If a Setup sidebar row shows to whoever reads its doctype, a Sales User sees the Templates and Holiday Lists rows. Ruling 3 says a Sales User sees no setup list. [#45950](https://github.com/frappe/frappe/issues/45950) checks this.
3. **The grant is site-wide.** A Sales Manager can write an Assignment Rule on any doctype, not only CRM Lead and CRM Deal. The `link_filters` on `document_type` guide the reader, but they are not a boundary.

This was not walked on a site. [#45962](https://github.com/frappe/frappe/issues/45962) (the walk) confirms it with a Sales Manager.

## Proposed single issues

Each is the body of a `Desk v2: ` issue on frappe `desk-v2`. None is filed.

### Gap 1. Desk v2: Email Account's record page does what its desk v1 form script does

Desk v2 does not run `frappe/email/doctype/email_account/email_account.js`. On the standard Email Account page, picking a `service` fills no server fields. Desk v1 fills them from `frappe.email_defaults` and `frappe.email_defaults_pop` (`email_account.js:1-73`, `:165-188`). The `authorize_api_access` and `validate_frappe_mail_settings` Buttons do nothing, because a Button field has no click on the record page (gap 3). The OAuth messages in `refresh` do not show (`email_account.js:242-340`).

**Need:** frappe ships `frappe/email/doctype/email_account/frontend/record.js`: the service presets as a `service` field handler, header acts (or Button handlers) for OAuth authorize and the Frappe Mail check, and the `refresh` messages as a frame band.

**Who needs it:** every desk v2 admin who adds an email account. Frappe CRM's guided create with presets (CRM v1 `Settings/emailConfig.js:100-164`, `crm/api/settings.py:49-98`) maps to it. It blocks part of [Build: Email Accounts and Email Templates on their standard pages](https://github.com/frappe/frappe/issues/45960) on map #45946.

### Gap 2. Desk v2: duplicate a record from its record page

Desk v2's record header has no duplicate act (`frontend/SCRIPTING.md:659-673`). REST v2 has `copy_doc` (`frappe/api/v2.py:294-302`), but no page uses it. `page.create(doctype, { values })` cannot carry child tables when it opens the full page, because the values go in the query string (`frontend/SCRIPTING.md:175-184`).

**Need:** a `duplicate` act in the header's `⋯` for a reader with create on the doctype. It copies the record through `copy_doc`, child rows included, and opens it as a new record.

**Who needs it:** desk v1 has it on every form. Frappe CRM duplicates assignment rules, SLAs and email templates (CRM v1 `AssignmentRuleListItem.vue:132-165`, `SlaPolicyList.vue:198-232`, `EmailTemplates.vue:227`). It blocks part of [#45958](https://github.com/frappe/frappe/issues/45958), [#45959](https://github.com/frappe/frappe/issues/45959) and [#45960](https://github.com/frappe/frappe/issues/45960) on map #45946.

### Gap 3. Desk v2: a Button field runs its handler when clicked

A `Button` field draws a button that does nothing. Its click needs a `decorate` overlay (`ui/src/components/Fields/ButtonField.vue:7-12`), and the record page passes none (`frontend/src/pages/Record.vue:776-801`). A field handler keyed by the Button's fieldname never fires, because a Button commits no value.

**Need:** a click on a Button field runs the script handler keyed by its fieldname, as desk v1's `frm.trigger(fieldname)` does.

**Who needs it:** every doctype with a Button field, for example Email Account (`authorize_api_access`, `validate_frappe_mail_settings`) and CRM Holiday List (`add_to_holidays`, `clear_table`). Until it lands, a script hides the field and adds a header act. It blocks no ticket on map #45946.

### Gap 4 (optional). Desk v2: a script changes a child table's column

`page.fields` finds a name in the parent's fields only (`frontend/src/recordPage/fields.ts:186-191`). A script cannot set `options`, `link_filters`, `label` or `hidden` on a column of a Table or Table MultiSelect field.

**Need:** `page.fields.update('<table>.<column>', patch)`, the same name form the field handlers use (`frontend/SCRIPTING.md:1096`).

**Who needs it:** Frappe CRM's lead sync maps Facebook form questions to CRM Lead fields in the `questions` grid (`facebook_lead_form_question.json:46-49`, CRM v1 `LeadSyncSourceForm.vue:129-153`). It also filters the users of an assignment rule (CRM v1 `AssigneeSearch.vue:119-132`). Without it, [#45961](https://github.com/frappe/frappe/issues/45961) redraws the mapping as a form part. The owner decides whether it blocks #45961.

### Already filed

[#45898](https://github.com/frappe/frappe/issues/45898) (rename a record from its record page) covers rename on all six doctypes. It blocks part of #45958, #45959, #45960 and #45961.

## Drops for the owner to confirm

1. The enabled or priority switch in a list row (Email Template, Assignment Rule, SLA, Lead Sync Source). The reader sets the field on the record page.
2. Assignment Rule users limited to CRM users and without Administrator. The picker lists every desk user, unless gap 4 lands.
3. One save for a lead sync source and its field mapping. The mapping saves on the Facebook Lead Form page.
4. Duplicate a lead sync source. It is broken in CRM v1, and a lead form takes one enabled source.
5. SLA client checks (date order, unique priorities, unique workdays, start before end), if the owner does not want them in `record.js`.

## Questions for the owner

1. Limit `document_type` (Assignment Rule) and `reference_doctype` (Email Template) to CRM Lead and CRM Deal with `link_filters`, or leave them open on a site-wide page?
2. Gap 4: does it block #45961, or does #45961 draw the mapping as a form part?
