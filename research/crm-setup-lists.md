# What CRM's setup lists lack on their standard pages

Ticket: [frappe/frappe#45972](https://github.com/frappe/frappe/issues/45972), map
[#45964](https://github.com/frappe/frappe/issues/45964) (Desk v2 — CRM settings), rulings 6 and 7.

Measured 2026-10-31 on `desk.localhost` (frappe, erpnext, crm, gameplan), served on port 8000
by the main checkout. frappe `desk-v2` at `00b069a379`, crm `desk-v2` at `06f120a14`. The
bench has no `crm.localhost`. The pages were opened at `/apps/crm/<slug>` with Playwright as
Administrator (minted session). Scratch records named `R45972 …` were made to read the
record pages, then deleted. Screenshots are in [`crm-setup-lists/`](./crm-setup-lists/).

Classes: **nothing** (the standard page does the job), **record.js / list.js** (with the
`page` verb, per `frontend/SCRIPTING.md`), **frappe record.js** (a script on a frappe
doctype that frappe itself should ship, for every app), **gap** (a frappe single issue).

## Summary

| List | Needs nothing | record.js / list.js (CRM) | Frappe issues |
| --- | --- | --- | --- |
| Email Account (S11) | Create, edit, `create_lead_from_incoming_email`, tabs, Password | none | Email Account record.js (service presets, INBOX row, Pull Emails); Button gap (OAuth); rename #45898 |
| Email Template (S12) | Create, edit, `enabled`, `reference_doctype`, Jinja Code editor with Preview, Text Editor | none | Duplicate gap; rename #45898 |
| Assignment Rule (S13) | Users (Table MultiSelect), rule, days grid, priority, save | `custom/assignment_rule/record.js`: condition builder | Assignment Rule record.js (`field` and `due_date_based_on` options, day presets); Duplicate gap; rename #45898 |
| SLA Policies (S14) | Priorities grid (Link, Duration), working hours grid (Select, Time), holiday list link | `record.js`: condition builder, one default priority; `list.js` columns. CRM Holiday List `record.js`: two Button jobs as header acts | Duplicate gap; grid column gap (label); Button gap; rename #45898 (SLA is named by `sla_name`) |
| Lead Syncing (S20) | Source create (prompt name, token, frequency), log read (JSON and traceback in Code) | Lead Sync Source `record.js`: link filter, new-record hides, Sync now, Failure logs tab; Failed Lead Sync Log `record.js`: Retry sync; both `list.js` columns | Grid column gap (field mapping options); Duplicate gap |

Every page loaded and drew with no console error. No list or record page failed.

## Framework facts the findings rest on

- **No Duplicate, no Rename.** The record header menu holds Add to favourites, Assign to,
  Copy record URL, Copy record ID and Delete (`frontend/src/pages/record/builtinActions.ts`,
  lines 58–80). No "Duplicate" exists anywhere in `frontend/src` or the issue tracker.
  Rename is [#45898](https://github.com/frappe/frappe/issues/45898).
- **A Button field is inert.** `ui/src/components/Fields/ButtonField.vue` takes its click
  from a `ui.on.click` overlay supplied by a `decorate` hook. `createRecordPage` accepts
  `host.decorate` (`frontend/src/recordPage/createRecordPage.ts:237`), but no page passes
  one. `page.fields.update` takes no click key (`SCRIPTING.md`, "What `update` takes").
  Clicking "Add to Holidays" and "Clear Table" on a CRM Holiday List sent no request and
  left the record clean ([screenshot](./crm-setup-lists/holiday-list-record.png)).
  Button fields exist in 16 frappe, 50 erpnext and 2 crm doctypes.
- **A script cannot reach a grid column.** `page.fields` patches top-level fieldnames only
  (`frontend/src/recordPage/fields.ts`). Handlers reach child fields (`products.qty`), but
  `update` cannot set a column's `options` or `label`. v1 does this with
  `grid.update_docfield_property`.
- **`list.js` has columns only.** `ListHandlers` is `{ columns? }`
  (`frontend/src/contributions/types.ts:10`, read in `frontend/src/list/defaults.ts`). The
  list's acts are fixed: create, favourite, customize quick filter, delete
  (`frontend/src/pages/list/listActs.ts`). A foreign doctype has no list kind (only
  `custom/<x>/record.js`), so CRM cannot add columns to Email Account, Email Template or
  Assignment Rule. Ruling 6 sends those lists as they are, so this blocks nothing here.
- **What a record.js has.** `page.fields.update(f, { hidden, reqd, options, link_filters,
  component, props, … })`, field handlers, `beforeSave`, `page.header.add({ run })`,
  `page.tabs`, `page.isNew`, `page.call(method)` (method only; a document method needs
  `runDocumentMethod` from `@framework/ui`'s `api`, which the import list allows).
- **The condition builder exists.** `@framework/ui`'s `ConditionBuilder` reads and writes
  "the interleaved array Assignment Rule and SLA persist" and compiles the `safe_eval`
  expression (`ui/src/components/ConditionBuilder/adapters.ts`: `fromFrappeConditions`,
  `toFrappeConditions`, `toConditionExpression`). CRM v1 stores the same shape
  (`[field, operator, value]` with `"and"`/`"or"` between, nested arrays for groups;
  `crm/frontend/src/utils/index.js` `convertToConditions`). An app file may import it.
- **Field descriptions show raw HTML** (`<code class="language-python">…`). Already
  [#45535](https://github.com/frappe/frappe/issues/45535).

## Email Account (S11)

CRM v1 job (`EmailConfig.vue`, `EmailAdd.vue`, `EmailEdit.vue`, `emailConfig.js`): pick a
provider card, enter name, email and password (or Frappe Mail site, key, secret), set
incoming, outgoing, defaults and "Create lead from incoming emails", then
`crm.api.settings.create_email_account`. That endpoint fills the provider's IMAP and SMTP
servers, `use_imap`, `use_tls`, port 587, sync option ALL, 100 initial mails,
`create_contact`, `track_email_status`, an INBOX `imap_folder` row with append to
`CRM Lead`, and tests the login before save. Edit renames through
`frappe.client.rename_doc` and saves with `frappe.client.set_value`. The list shows cards
with the provider icon and filters out `%example%` addresses.

| Step | Class | Notes |
| --- | --- | --- |
| Create, name, email, password, enable incoming/outgoing, defaults | nothing | All fields draw on three tabs. Depends-on works (Domain hides once a service is set). |
| "Create Lead from Incoming Emails" | nothing | CRM's custom field draws on the Incoming tab. |
| Provider preset (servers, SSL, ports) | **frappe record.js** | Picking GMail fills nothing: Incoming Server empty, Use IMAP and Use SSL off ([screenshot](./crm-setup-lists/email-account-gmail-incoming.png)). v1's `email_account.js` does this on `service` change. It is frappe's job for every app, a `service` field handler with `page.doc` writes. |
| INBOX folder row, attachment limit default | **frappe record.js** | v1 `onload` adds the INBOX row and reads the max file size. Without the row, a save with incoming and Use IMAP on is refused ("You need to set one IMAP folder"). `onOpen` with `page.isNew`. Append to `CRM Lead` stays a manual pick. |
| Credential check before save | nothing | Frappe's `EmailAccount.validate` logs in to IMAP and SMTP when a password is set. |
| Pull Emails | **frappe record.js** | v1 custom button; `page.header.add` calling the document method. |
| OAuth (Authorize API Access), Validate Frappe Mail | **gap** | Both are Button fields: inert. Without them OAuth accounts cannot be connected on v2. |
| Provider sign-in from the list's Add (v1 list, Frappe Cloud) | **gap**, low | `email_account_list.js` replaces the primary action; `list.js` cannot. Fold into the list.js issue or #43265. |
| Rename | **gap** | #45898. Named by `email_account_name`; editing that field after save does not rename. |
| Provider icons on the list | drop | Columns Name, Email Address, Domain. |

`crm.api.settings.create_email_account` does nothing the standard page cannot, once
frappe's record.js sets the presets. The extra defaults it sets (port 587, 100 mails,
`track_email_status`) are preferences, not needs. Aside: v1 sends `service` "Outlook",
"Yahoo" and "Yandex", which frappe's Select refuses ("Service cannot be "Outlook""), so v1's
create works today only for GMail, Sendgrid, SparkPost and Frappe Mail.

## Email Template (S12)

CRM v1 job (`EmailTemplate/`): list of CRM templates (`reference_doctype in [CRM Lead,
CRM Deal]`) with a For filter and an Enabled switch per row; create with name, For,
subject, content type (Rich Text or HTML) and content; duplicate (the create form
prefilled); edit with rename (`frappe.client.rename_doc`).

| Step | Class | Notes |
| --- | --- | --- |
| Create, name (prompt field), subject, `enabled`, `reference_doctype` | nothing | CRM's custom fields draw. |
| Rich Text or HTML content | nothing | `use_html` switches Text Editor and a Jinja Code editor with Preview. |
| Enable from the list | nothing | Open the record. No inline toggle on v2 lists. |
| Filter to CRM templates | nothing now; U3 | Filter by Reference DocType works by hand; a saved filtered row waits on U3 (ruling 6). |
| Duplicate | **gap** | No Duplicate. |
| Rename | **gap** | #45898. |
| List columns | nothing | Default columns are Name, Subject, Response, and Response shows raw HTML ([screenshot](./crm-setup-lists/email-template-list.png)). Frappe's `in_list_view`; the reader can change Columns. |

## Assignment Rule (S13)

CRM v1 job (`AssignmentRules/`, `crm.api.assignment_rule`): list of rules for CRM Lead and
Deal (`get_assignment_rules_list`, with a "no users" flag), enable switch, priority; a rule
page with name, description, priority, document type, assign and unassign condition
builders (writing `assign_condition_json` and the compiled `assign_condition`), schedule
by day, rule type (Round Robin, Load Balancing) and users; duplicate
(`duplicate_assignment_rule`); rename.

| Step | Class | Notes |
| --- | --- | --- |
| Name, description, document type, priority, disabled | nothing | |
| Users, rule | nothing | Table MultiSelect draws and saves. |
| Assignment days | nothing | Grid of days. v1's "Weekdays / Weekends / All Days" grid buttons are frappe's (below). |
| Condition builder | **record.js** (`custom/assignment_rule/record.js`) | With JSON set, the page shows the raw JSON in a Code editor labelled "Assign Condition JSON" and hides the Python condition ([screenshot](./crm-setup-lists/assignment-rule-record.png)). Editing the JSON does not update `assign_condition`, so the rule silently keeps the old condition. A record.js: `page.fields.update('assign_condition_json', { component, props: { doctype } })` with `ConditionBuilder`, the same for unassign, a handler that writes `assign_condition` from `toConditionExpression`, and `hidden` on the Python fields while JSON is used. The custom fields are CRM's, so the script is CRM's. |
| `field` and `due_date_based_on` options, rule description, day presets | **frappe record.js** | v1 `assignment_rule.js` fills both Selects from the document type's fields. On v2, "Due Date Based On" shows "Select option" with no options, and "Based on Field" has no field to pick. `document_type` handler, `page.fields.update(..., { options })`. |
| Duplicate | **gap** | `crm.api.assignment_rule.duplicate_assignment_rule` is only a copy and insert. |
| Rename | **gap** | #45898. |
| "Rules for CRM only" list | U3 | Ruling 6. |
| `get_assignment_rules_list` | drop | Its "no users" flag is moot: `users` is mandatory for Round Robin and Load Balancing. |

## CRM Service Level Agreement (S14)

CRM v1 job (`Sla/`): list with enable, default, duplicate (`frappe.client.get` then
`insert`) and delete; a policy page with name, apply on, rolling responses, default,
condition builder (`condition_json` and compiled `condition`), validity dates, priorities
with first response time and one default priority, working days and hours, holiday list
(create and edit open v1 desk at `/app/crm-holiday-list`); rename on name change.

| Step | Class | Notes |
| --- | --- | --- |
| Name, apply on, enabled, default, rolling, dates | nothing | |
| Priorities (Link, Duration, default check) | nothing | Duration draws "1h" ([screenshot](./crm-setup-lists/sla-record.png)). |
| Working hours (Select, Time) | nothing | |
| Holiday list | nothing | Link to `CRM Holiday List`; its standard page replaces v1's jump to `/app`. |
| Condition builder | **record.js** (`crm_service_level_agreement/frontend/record.js`) | Same as Assignment Rule: the page shows raw `condition_json` and hides `condition`. |
| One default priority | **record.js** | v1 `validate` in the form script; `beforeSave` throw with `setError`. Better moved to the controller. |
| "Rolling Response Time" column label | **gap** | v1 relabels the grid column. Grid column gap. Cosmetic. |
| Holiday list "Add to Holidays", "Clear Table" | **record.js** (CRM Holiday List) until the Button gap | Header acts. `get_weekly_off_dates` is a document method on an unsaved record, so the act computes the dates in the script or saves first. |
| Duplicate | **gap** | |
| Rename | **gap**, blocks | Named `field:sla_name`. Editing SLA Name after save changes the field, not the name. v1 renames. Until #45898, the record.js should make `sla_name` read-only after the first save. |
| List | **list.js** | Columns today: Name and SLA Name (the same value twice). `columns`: `sla_name`, `apply_on`, `enabled`, `default`. |

## Lead Sync Source and Failed Lead Sync Log (S20)

CRM v1 job (`LeadSyncing/`): pick Facebook, enter a name and an access token, create
(`before_insert` fetches the pages from Facebook); then pick a Facebook Page, a Lead Form
filtered by that page, map each form question to a CRM Lead field in a grid of the
**Facebook Lead Form** record (Autocomplete options are CRM Lead's fields), enable, set the
frequency, Sync Now (`sync_leads`); a Failure Logs tab on the source lists its logs, each
with lead data, traceback and Retry Sync (`retry_sync`); duplicate a source.

| Step | Class | Notes |
| --- | --- | --- |
| Name, type, token, frequency, enabled | nothing | Not saved for real: insert calls Facebook and needs a live token. |
| Hide page and form until saved | **record.js** | `page.isNew` with `page.fields.hide`. |
| Lead Form filtered by page; clear it when the page changes | **record.js** | `link_filters` on `facebook_lead_form`, a `facebook_page` handler. |
| Sync now | **record.js** | `page.header.add` running `sync_leads` through `runDocumentMethod`. |
| Failure logs of this source | **record.js** | `page.tabs` with a component listing `Failed Lead Sync Log` by `source`, or a link to the filtered list. |
| Field mapping | **gap** | Lives on Facebook Lead Form's `questions` grid. `mapped_to_crm_field` is Autocomplete with no options in its JSON, so the v2 cell offers nothing. A script cannot set a column's options. Fallback: a Facebook Lead Form record.js replacing the `questions` field with its own `Grid` through `component`. |
| Read a failed log | nothing | Type, source, lead data (JSON) and traceback draw in Code editors ([screenshot](./crm-setup-lists/failed-log-record.png)). |
| Retry sync | **record.js** (Failed Lead Sync Log) | Header act, hidden when `type` is Synced. |
| Duplicate a source | **gap** | |
| Lists | **list.js** | Lead Sync Source shows Name, Type: add `enabled`, `facebook_page`, `last_synced_at`. Failed Lead Sync Log shows Name, Type, Source: add `creation`. |

## Permissions

On this site Sales Manager has no DocPerm on Assignment Rule, Email Account, or write on
Email Template (System Manager only; Desk User reads templates). CRM v1 shows those panes
to a Sales Manager, but its writes go through `frappe.client` and meet the same DocPerms.
Not walked as a Sales Manager. The map's walk is by an admin; the role-gating ticket should
decide whether CRM grants these.

## Proposed follow-ups

CRM tickets (crm `desk-v2`):

1. Assignment Rule: `crm/fcrm/custom/assignment_rule/record.js` with the condition builder.
2. SLA: `crm_service_level_agreement/frontend/record.js` (condition builder, one default
   priority, `sla_name` read-only after save) and `list.js` columns.
3. CRM Holiday List: `record.js` header acts for the two Button jobs (drop once the Button
   gap lands).
4. Lead Syncing: Lead Sync Source `record.js` (new-record hides, link filter, Sync now,
   Failure logs tab), Failed Lead Sync Log `record.js` (Retry sync), and both `list.js`.
   Field mapping waits on the grid column issue.
5. Email Account and Email Template: no CRM ticket. They wait on frappe's issues.

Frappe single issues (`Desk v2: ` prefix, on `desk-v2`):

- **Desk v2: duplicate a record from its record page.** Missing in
  `frontend/src/pages/record/builtinActions.ts`. Template, rule, SLA, source.
- **Desk v2: a Button field runs its script handler on the record page.** No `decorate`
  passed into `createRecordPage`; `ButtonField.vue` inert. OAuth on Email Account; 68
  doctypes across frappe, erpnext and crm.
- **Desk v2: a script updates a child table column (options, label).**
  `frontend/src/recordPage/fields.ts` patches top-level fields only. Lead form mapping, SLA
  column label.
- **Desk v2: Email Account's record page does what its v1 form script does.** Service
  presets, INBOX row, attachment limit, Pull Emails (frappe's own record.js).
- **Desk v2: Assignment Rule's record page does what its v1 form script does.** `field` and
  `due_date_based_on` options, rule description, day presets.
- Low, not needed by this map's walk: **Desk v2: a list.js adds list acts** (beyond
  `columns`), for Email Account's provider Add. Check against #43265 first.

Rename (#45898) is needed by the SLA job (named by a field), and by v1's rename of Email
Account, Email Template and Assignment Rule.

## Not checked

- crm.localhost does not exist; desk.localhost runs the main checkout's last build.
- A real Email Account save (needs real credentials) and a real Lead Sync Source insert
  (needs a Facebook token).
- Any page as a Sales Manager or Sales User.
- Duplicate map: [#45946](https://github.com/frappe/frappe/issues/45946) is also titled
  "Desk v2 — CRM settings", and its research ticket
  [#45949](https://github.com/frappe/frappe/issues/45949) asks the same question.
