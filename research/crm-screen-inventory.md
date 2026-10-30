# CRM on desk v2: every CRM v1 screen against desk v2's contributions

Research for [#45835](https://github.com/frappe/frappe/issues/45835), on map
[#45834](https://github.com/frappe/frappe/issues/45834). This file is a table of facts. It
makes no rulings. The drop list and the area order are later grillings.

**Sources.** CRM v1 is `apps/crm/frontend/src` at crm `desk-v2` `79b98437`. The CRM backend is
`apps/crm/crm` at the same commit. Desk v2 is `apps/frappe/frontend` and `apps/frappe/ui` at
frappe `desk-v2` `c78f73ddf4`. The terms come from `frontend/CONTEXT.md`. The contribution
list is `frontend/src/contributions/types.ts`. The page API is `frontend/SCRIPTING.md`. The
ways to change the desk are in `frontend/ARCHITECTURE.md`, section "Ways to change the desk".
The root map areas are the numbered list in "Not yet specified" on
[#42061](https://github.com/frappe/frappe/issues/42061).

**How the lines are counted.** All counts come from `wc -l`, or from a script that does the
same count per file. CRM v1 has 59,366 lines in 400 `.vue`, `.js` and `.ts` files.

- **Own** is the lines of the part's own file.
- **With parts** is the own file plus each file that only this part imports. The walk follows
  `import` lines. It stops at another part in the table. It also stops at the shared
  run-time code (`stores/`, `composables/`, `utils/`, `data/`, `components/Icons/`, the
  router and `main.js`). A file that two or more parts import is not in either count. There
  are 39 such shared files with 5,026 lines (form controls, condition filter, list views
  used in more than one place). The shared run-time code is 5,076 lines. Icons are 2,296 lines.

**What the carrier column says.** It names the desk v2 contribution that can carry the job,
in the `types.ts` kinds: `record.js` (a surface and a verb), `custom` record.js for a foreign
doctype, `list.js`, a replacement page, an app page, a settings block (Single binding,
Record binding with the `session_user` resolver, or a component), an act in `acts.js`, or a
rail or sidebar row. When no contribution can carry the job, the column names a gap
(G1 to G15, in the gap list below) and its root map area. "Built-in" means desk v2 already
does the job with no contribution. "Unclear" means I could not tell from the code; the row
points to the code (U1 to U5, below the gap list).

**What the endpoint column says.** Each `crm.*` call is named without the `crm.` prefix.
`fcrm.<doctype>` is short for `crm.fcrm.doctype.<doctype>.<doctype>`. After each call:

- **v2** — a framework `/api/v2` route does the same job.
- **part** — a framework `/api/v2` route does a part of the job.
- **fw** — no `/api/v2` route, but desk v2 itself calls a framework method for this job.
- **no** — no framework route does the job.

Every whitelisted CRM method is also reachable at `/api/v2/method/<path>`
(`frappe/api/v2.py`, `handle_rpc_call`). That is transport only, so "no" ignores it. The full
list of calls is in the appendix. Many screens also read doctypes through frappe-ui's
`createListResource` and `createDocumentResource`, which call `frappe.client.*` on `/api/method`.
Those reads are not listed per row; `/api/v2/document` covers them.

## Main table

### Routes in `router.js` (desktop)

| # | Part of CRM v1 | User job | Desk v2 carrier, or gap (root area) | Endpoints (cover) | Lines own / with parts |
| --- | --- | --- | --- | --- | --- |
| R1 | `/` Home (router guard, no page) | Open the user's default view | Built-in: the landing is the first row of the arranged rail. A per-user default view: G5 (area 2) | `api.views.get_views` (no) | 0 (guard in `router.js`, 321 lines) |
| R2 | `/leads/view/:viewType?` `Leads.vue` | Find, filter and work through leads; switch list, Kanban and group-by views | Built-in list at `/apps/crm/crm-lead` (filter, sort, quick filter, columns, bulk delete); `list.js` adds columns only. Kanban: G1. Group by: G2. Saved views: G5. Cell renderers and bulk acts: G6. Import and export: G7 (all area 2) | via ViewControls (row K1) | 596 / 942 |
| R3 | `/leads/:leadId` `Lead.vue` | Work one lead: status, assign, edit fields, convert to deal, delete | `record.js` on CRM Lead: `header` (status dropdown, Convert, Enrich), `panelSections` (SLA, side panel fields), `people` built-in (assign), `tabs`, `dialog.open` (Convert, Lost reason). Delete with linked docs: hide `header.delete` and add an own header act | `fcrm.crm_fields_layout.get_sidepanel_sections` (fw: Form Layout) | 585 / 585 |
| R4 | `/deals/view/:viewType?` `Deals.vue` | Work through the pipeline of deals | As R2 on CRM Deal. Kanban by status: G1 | via ViewControls | 562 / 562 |
| R5 | `/deals/:dealId` `Deal.vue` | Work one deal: status, lost reason, organization, contacts, assign | `record.js` on CRM Deal: `header` (status dropdown), field handler on `status` with `dialog.open` (Lost reason), `panelSections` component (contacts with primary flag, SLA), `people`, `tabs`. ERPNext "customer created" listener: U1 | `fcrm.crm_deal.api.get_deal_contacts`, `add_contact`, `remove_contact`, `set_primary_contact` (part: PATCH the `contacts` child table); `get_sidepanel_sections` (fw) | 855 / 855 |
| R6 | `/notes/view/:viewType?` `Notes.vue` | Browse notes as cards; open and edit one | Built-in list at `/apps/crm/fcrm-note` (a table, not cards). Card grid: G4 (area 2). Edit in a dialog: the standard record page, or `page.create` for a new note | `frappe.client.delete` (v2) | 186 / 186 |
| R7 | `/tasks/view/:viewType?` `Tasks.vue` | Track tasks by status and owner; Kanban board | Built-in list at `/apps/crm/crm-task`. Kanban: G1 | via ViewControls | 414 / 693 |
| R8 | `/contacts/view/:viewType?` `Contacts.vue` | Find contacts | Built-in list at `/apps/crm/contact` | via ViewControls | 161 / 161 |
| R9 | `/contacts/:contactId` `Contact.vue` | See a contact's emails, phones, organization and linked deals | `custom` record.js on Contact (foreign doctype, `<module>/custom/contact/record.js`): `panelSections` component (emails and phones with primary flag), `tabs.add` with a component (linked deals) | `api.contact.get_linked_deals` (part: list CRM Deal); `api.contact.create_new`, `set_as_primary` via `useContactFields` (part); `get_sidepanel_sections` (fw) | 458 / 458 |
| R10 | `/organizations/view/:viewType?` `Organizations.vue` | Find organizations | Built-in list at `/apps/crm/crm-organization` | via ViewControls | 157 / 407 |
| R11 | `/organizations/:organizationId` `Organization.vue` | See an organization's deals and contacts; rename | `record.js` on CRM Organization: `tabs.add` (deals, contacts). Today a replacement page proof takes this address (see "What runs today"). Rename: no `/api/v2` route | `frappe.client.rename_doc` (no); `get_sidepanel_sections` (fw) | 602 / 602 |
| R12 | `/call-logs/view/:viewType?` `CallLogs.vue` | Review calls; open one call's detail, note and task | Built-in list at `/apps/crm/crm-call-log` (a sidebar row under Contacts today). Detail: standard record page, or `dialog.open` from a list act: G6 | `fcrm.crm_call_log.get_call_log` (part) | 160 / 429 |
| R13 | `/calendar` `Calendar.vue` | Plan and edit events by day, week and month | App page (`<module>/frontend/pages/<slug>.js`) as CRM-only code, or G3 Calendar view (area 2) | `frappe.client.insert` (v2); `frappe.desk.doctype.event.event.update_attending_status` (no) | 627 / 627 |
| R14 | `/dashboard` `Dashboard.vue` | See sales charts and number cards; add and arrange charts | App page as CRM-only code, or G8 dashboards (area 4) | `api.dashboard.get_dashboard`, `get_chart`, `reset_to_default` (no) | 312 / 473 |
| R15 | `/data-import`, `/data-import/doctype/:doctype`, `/data-import/:importName` `DataImport.vue` | Import leads, deals and contacts from a file | G7 import and export (no area names it). `@framework/ui` has a `DataImport` component (4,548 lines) that desk v2 does not use | frappe-ui's own data import calls | 52 / 52 |
| R16 | `/welcome` `Welcome.vue` | First run: add sample data, connect email, create a lead | App page as CRM-only code. The redirect to it: G14 | none | 54 / 54 |
| R17 | `/onboarding` `PersonaForm.vue` | Admin answers a persona questionnaire once (telemetry) | G14 first-run redirect (no area). `@framework/ui` has an `Onboarding` component that desk v2 does not use | `frappe.client.set_value` (v2); `frappe.client.get_single_value`, telemetry `boot_config` in the router (v2, fw) | 133 / 133 (+ Questionnaire 183) |
| R18 | `/:invalidpath` `InvalidPage.vue` | See a not-found state | Built-in shell chrome (`shell/NotFound.vue`); not contributable | none | 18 / 18 |
| R19 | `/not-permitted` `NotPermitted.vue` | See a no-access state | Built-in: `app_permission` hook and `shell/Unauthorized.vue` | none | 30 / 30 |
| R20 | `/notifications` `MobileNotification.vue` | Read notifications on a phone | G9 mobile shell (area 1), G11 notifications (area 7) | via `stores/notifications.js` | 110 / 110 |

### Routes in `router.js` (mobile, chosen when the window is under 768 px)

| # | Part of CRM v1 | User job | Desk v2 carrier, or gap (root area) | Endpoints (cover) | Lines own / with parts |
| --- | --- | --- | --- | --- | --- |
| M1 | `MobileLead.vue` | Work one lead on a phone | G9 mobile shell (area 1, leftover of #42569) | `get_sidepanel_sections` (fw) | 423 / 423 |
| M2 | `MobileDeal.vue` | Work one deal on a phone | G9 | as R5 | 680 / 680 |
| M3 | `MobileContact.vue` | See one contact on a phone | G9 | `api.contact.get_linked_deals` (part); `frappe.client.delete` (v2) | 428 / 428 |
| M4 | `MobileOrganization.vue` | See one organization on a phone | G9 | `frappe.client.delete`, `set_value` (v2) | 538 / 538 |
| M5 | `MobileLayout.vue`, `Mobile/MobileSidebar.vue`, `Mobile/MobileAppHeader.vue` | Move between screens on a phone | G9 | none | 15 / 36; 57 / 57; 21 |

### Dialogs in `components/Modals`

| # | Part of CRM v1 | User job | Desk v2 carrier, or gap (root area) | Endpoints (cover) | Lines own / with parts |
| --- | --- | --- | --- | --- | --- |
| D1 | `LeadModal.vue` | Create a lead in a dialog, with a website preview | Built-in Create (`shell.create`, `page.create`) with the Quick Entry Form Layout. The enrichment preview: U2 | `domain_enrichment.api.enrich_preview` (no); `frappe.client.insert` (v2); `get_fields_layout` (fw) | 250 / 250 |
| D2 | `DealModal.vue` | Create a deal and, in one step, a new or existing organization and contact | Built-in Create with Quick Entry. Choose-existing-or-new for organization and contact: U2 | `fcrm.crm_deal.create_deal` (part: POST one document); `enrich_preview` (no) | 301 / 301 |
| D3 | `ContactModal.vue` | Create a contact | Built-in Create. Contact's flat email and phone become primary rows on insert (#44894) | `frappe.client.insert` (v2) | 245 / 245 |
| D4 | `OrganizationModal.vue` | Create an organization, with a website preview | Built-in Create. Preview: U2 | `enrich_preview` (no); `insert` (v2) | 231 / 231 |
| D5 | `CreateDocumentModal.vue` | Create a linked record from a Link field | Built-in: a Link field's last dropdown row opens Create | `insert` (v2) | 188 / 188 |
| D6 | `DoctypeModal.vue`, `DoctypeModals.vue` | Create or edit a task, note or call log in a dialog | New: built-in Create (`page.create`). Edit in a dialog: `dialog.open` with a component on a record page | `insert` (v2) | 182 / 182; 18 / 18 |
| D7 | `ConvertToDealModal.vue` | Convert a lead to a deal, with an existing or new organization and contact | `record.js` on CRM Lead: header act with `dialog.open` (component) or `dialog.form`, then `page.call` | `fcrm.crm_lead.convert_to_deal` (no) | 313 / 313 |
| D8 | `LostReasonModal.vue` | Give a reason when a deal is lost | `record.js` on CRM Deal: `status` field handler with `dialog.form` | none | 103 / 103 |
| D9 | `AssignmentModal.vue` | Assign one or more users to one record or a selection | One record: the `people` built-in. A selection: G6 | `frappe.desk.form.assign_to.add` (v2), `add_multiple` (part); `api.doc.remove_assignments` (v2) | 184 / 184 |
| D10 | `EditValueModal.vue` | Set one field on many selected records | G6 bulk acts (area 2) | `api.doc.get_fields` (v2: meta); `bulk_update.submit_cancel_or_update_docs` (v2: `/document/<dt>/bulk_update`) | 280 / 280 |
| D11 | `ViewModal.vue` | Create or rename a saved view | G5 saved views (area 2) | `fcrm.crm_view_settings.create`, `update` (no) | 150 / 150 |
| D12 | `CallLogDetailModal.vue` | Read a call, play its recording, add a note or task, make a lead from it | Standard record page of CRM Call Log with `record.js`, or `dialog.open` from the Calls tab (row A7) | `fcrm.crm_call_log.create_lead_from_call_log` (no); `integrations.api.add_note_to_call_log`, `add_task_to_call_log` (no) | 443 / 443 |
| D13 | `EventModal.vue` | Create or edit an event with attendees and reminders | `dialog.open` with a component on a record page; the Calendar page: R13 | Event reads through frappe-ui (v2) | 498 / 498 |
| D14 | `EmailTemplateSelectorModal.vue` | Pick an email template while writing an email | `dialog.open`, then `page.composer.open('email', { draft })`: U5 | (template body via `get_email_template`, row C4) | 134 / 134 |
| D15 | `WhatsappTemplateSelectorModal.vue` | Pick a WhatsApp template to send | `dialog.open` from a script's own WhatsApp writer (row A10) | `api.whatsapp.send_whatsapp_template` (no) | 117 / 117 |
| D16 | `QuickEntryModal.vue` | Admin edits a doctype's Quick Entry layout | G12 layout editor UI (area 6) | `fcrm.crm_fields_layout.get_fields_layout`, `save_fields_layout` (fw: Form Layout rows) | 125 / 125 |
| D17 | `SidePanelModal.vue` | Admin edits the side panel layout | G12 (area 6) | as D16 | 147 / 147 |
| D18 | `DataFieldsModal.vue` | Admin edits the Data tab layout | G12 (area 6) | as D16 | 126 / 126 |
| D19 | `FieldLayoutDialog.vue`, `FieldLayoutDialogContainer.vue` | A Form Script opens a form dialog (`formDialog` helper in `data/script.js`) | `page.dialog.form` on a record page; `shell.dialog` has `confirm` and `danger` only | `get_fields_layout` (fw) | 302 / 302; 20 / 20 |
| D20 | `ChangePasswordModal.vue` | Change one's own password | A component block that `extends` desk's Profile pane, as CRM's Telephony block does. Desk's Profile pane has no password block (`frappe/settings_dialog/frappe/frappe.json`) | `api.user.change_password` (no) | 152 / 152 |
| D21 | `AddExistingUserModal.vue` | Admin adds existing site users to CRM | Inside the Users pane (row S8) | `api.user.add_existing_users` (no) | 114 / 114 |
| D22 | `AboutModal.vue` | See the app version | G13 app rows in the user menu (area 1) | none | 75 / 75 |
| D23 | `GlobalModals.vue` | Hosts D5, D16, D19, D20, D22 above every page | Not needed as a part; each dialog maps above. A dialog with no page under it: G10 | none | 39 / 39 |

### Settings panes in `components/Settings` (as `Settings.vue` lists them)

| # | Part of CRM v1 | User job | Desk v2 carrier, or gap (root area) | Endpoints (cover) | Lines own / with parts |
| --- | --- | --- | --- | --- | --- |
| S0 | `Settings.vue` | Open settings in one dialog, panes in groups | Built-in: the shell's settings dialog at `#settings/crm/<pane>` | none | 280 / 280 |
| S1 | Profile (`Profile/ProfilePage.vue`) | Edit name, photo, email signature and one's email accounts | Desk's Profile pane: `photo`, `details`, `email` (signature) blocks. The `user_emails` table: a generated block with Record binding on User (`session_user`) that `extends` desk's Profile pane | `frappe.client.*` on User (v2) | 21 / 440 |
| S2 | Preferences (`PreferencesSettings.vue`, `ThemeSwitcher.vue`) | Set language, time zone and theme | Built-in: desk's Profile pane, `locale` and `appearance` blocks | `frappe.core.doctype.user.user.get_timezones` (fw) | 153 / 351 |
| S3 | General (`GeneralSettings.vue`) | Set communication and timeline rules | Runs today: CRM's General pane, blocks `communication` and `activity-timeline` (Single, FCRM Settings) | none | 164 / 164 |
| S4 | Dashboard (`DashboardSettings.vue`) | Set forecasting, currency and the exchange rate provider | Partly runs today: General pane, `deals` block. `service_provider` and `access_key` are not in it; a Single-bound block can carry them | none | 259 / 259 |
| S5 | Defaults (`DefaultsSettings.vue`) | Set currency, number, date and time formats | Built-in: desk's System pane, `regional` block (System Settings) has all six fields | System Settings through frappe-ui (v2) | 181 / 181 |
| S6 | Brand (`BrandSettings.vue`) | Set the brand name, logo and favicon | Single-bound block on FCRM Settings saves the fields. The shell does not read them: the rail logo is the `add_to_apps_screen` hook's `logo` (`frappe/shell/boot.py:186`). G15 (area 1) | none | 136 / 173 |
| S7 | Calendar (`CalendarSettings.vue`) | Set the default calendar view and event reminders | Single-bound block on FCRM Settings (`default_calendar_view`, `event_notifications`, `all_day_event_notifications`; Table fields draw in a generated block, `pages/settings/settingsRows.ts`) | none | 284 / 284 |
| S8 | Users (`Users.vue`) | Admin lists CRM users and changes their CRM role | Component block (no binding) | `api.user.update_user_role`, `remove_crm_roles_from_user` (no) | 304 / 304 |
| S9 | Invite User (`InviteUserPage.vue`) | Admin invites people by email with a role | Component block. `@framework/ui` has an `InviteUser` component on `frappe.core.api.user_invitation`, not used by desk v2 | `api.invite_by_email` (part: fw method `frappe.core.api.user_invitation.invite_by_email`) | 213 / 213 |
| S10 | Sales Hierarchy (`Hierarchy/Hierarchy.vue`) | Admin arranges users in a reporting tree | Component block. A tree list view is absent too ("Tree", area 2) | `frappe.client.insert`, `set_value`, `delete` (v2) | 583 / 1,151 |
| S11 | Email Accounts (`EmailConfig.vue`) | Admin adds and edits incoming and outgoing email accounts | Component block, or the standard Email Account list and record pages with a sidebar row | `api.settings.create_email_account` (part: POST Email Account); `frappe.client.rename_doc` (no) | 27 / 757 |
| S12 | Email Templates (`EmailTemplate/EmailTemplatePage.vue`) | Create and edit email templates for leads and deals | Component block, or the standard Email Template list and record pages with a sidebar row | `frappe.client.rename_doc` (no) | 63 / 733 |
| S13 | Assignment Rules (`AssignmentRules/AssignmentRulePage.vue`) | Admin sets who gets new leads and deals, by condition and schedule | Component block, or the standard Assignment Rule pages with a `custom` record.js | `api.assignment_rule.get_assignment_rules_list` (part: list), `duplicate_assignment_rule` (part: `/document/<dt>/<name>/copy`); `frappe.client.*` (v2), `rename_doc` (no) | 19 / 1,660 |
| S14 | SLA Policies (`Sla/SlaConfig.vue`) | Admin sets response and resolution times, working days and holidays | Component block, or the standard CRM Service Level Agreement pages with `record.js` | `frappe.client.get`, `get_list`, `insert` (v2), `rename_doc` (no) | 38 / 2,253 |
| S15 | Forms (`Forms/FormsSettings.vue`) | Admin builds and publishes web forms that create leads | Component block as CRM-only code. A web form builder is absent (area 6, named in #42061) | `api.form.list_forms`, `get_form_config`, `get_form_fields`, `save_form`, `delete_form`, `set_published`, `get_hidden_seed`, `grant_guest_link_access`, `link_field_guest_access` (no) | 30 / 2,163 |
| S16 | Home Actions (`HomeActions.vue`) | Admin edits the rows of the user menu | Single-bound block saves `dropdown_items`. Nothing in the shell reads them: G13 (area 1) | none | 61 / 61 (+ Grid, row K9) |
| S17 | Telephony (`Telephony/TelephonyPage.vue`) | Set one's calling medium and device; admin sets Twilio and Exotel accounts | Agent part runs today: the Telephony block in desk's Profile pane. Twilio and Exotel: Single-bound blocks (CRM Twilio Settings, CRM Exotel Settings) | `frappe.client.insert` (v2) | 26 / 681 |
| S18 | WhatsApp (`WhatsAppSettings.vue` over `SettingsPage.vue`) | Admin sets the WhatsApp account | Single-bound block on WhatsApp Settings (doctype from the `frappe_whatsapp` app) | `api.doc.get_fields` (v2: meta) | 6 / 6 (+ 148) |
| S19 | ERPNext (`ERPNextSettings.vue`) | Admin connects ERPNext and syncs products | Single-bound block on ERPNext CRM Settings, plus a component block for the sync status and its socket event | `fcrm.erpnext_crm_settings.get_product_sync_status` (no) | 862 / 862 |
| S20 | Lead Syncing (`LeadSyncing/LeadSyncSourcePage.vue`) | Admin connects Facebook lead forms and reads failed syncs | Component block, or the standard Lead Sync Source and Failed Lead Sync Log pages | through frappe-ui (v2) | 46 / 816 |
| S21 | `SettingsPage.vue` | Draws any doctype's fields as a pane | Built-in: a generated block | `api.doc.get_fields` (v2: meta) | 148 / 148 |

### Tabs and timeline rows in `components/Activities`

The Lead and Deal pages show ten tabs: Activity, Emails, Comments, Data, Events, Calls, Tasks,
Notes, Attachments, WhatsApp (`pages/Deal.vue:579-625`). Desk v2's strip has Details,
Activity, Emails and Files, and a script adds more with `page.tabs.add`.

| # | Part of CRM v1 | User job | Desk v2 carrier, or gap (root area) | Endpoints (cover) | Lines own / with parts |
| --- | --- | --- | --- | --- | --- |
| A1 | `Activities.vue` | Show every tab's list for one record; listen for live changes | Built-in Activity tab plus `page.tabs`, `page.activity`, `page.composer` | `api.activities.get_activities` (part: `GET /document/<dt>/<name>/activity` gives comments, emails, versions and attachment logs; not CRM calls, notes and tasks, `crm/api/activities.py:379-500`); `api.whatsapp.get_whatsapp_messages` (no) | 874 / 874 |
| A2 | `ActivityHeader.vue` | The tab title and the "New" menu: email, comment, event, call, note, task, upload, WhatsApp | A tab's `create` entry (the composer's `+` menu), `quickActions`, `header` | none | 195 / 253 |
| A3 | Activity tab: version rows `creation`, `added`, `removed`, `changed`, grouped changes | Read who changed what | Built-in feed rows `version` | (A1) | in A1 |
| A4 | Emails tab, row `communication` (`EmailArea.vue`, `EmailContent.vue`) | Read and reply to emails | Built-in Emails tab and email writer (`pages/record/composer/EmailWriter.vue`) | none | 153; 138 |
| A5 | Comments tab, row `comment` (`CommentArea.vue`) | Read, edit and delete comments | Built-in rows `comment`; a Comments-only tab: `tabs.add`, or `activity.types(['comment'])` | `frappe.client.set_value`, `delete` (v2) | 147 / 147 |
| A6 | Data tab (`DataFields.vue`) | Edit the record's fields in tabs and sections | Built-in Details tab with the Details Form Layout | `get_fields_layout` (fw) | 163 / 163 |
| A7 | Calls tab and rows `incoming_call`, `outgoing_call` (`CallArea.vue`, `AudioPlayer.vue`, `PlaybackSpeedOption.vue`) | Read calls, play recordings | `tabs.add` with a component; feed rows with `page.activity.add` (component, `timestamp`), read with `page.cached` | `fcrm.crm_call_log.get_call_log` (part) | 123; 233; 21 |
| A8 | Tasks tab (`TaskArea.vue`) | See and add tasks for the record | `tabs.add` with a component and a `create` entry that calls `page.create('CRM Task', { values })` | through `AllModals.vue` | 111 / 111 |
| A9 | Notes tab (`NoteArea.vue`) | See and add notes | As A8 with FCRM Note | `frappe.client.delete` (v2) | 88 / 88 |
| A10 | WhatsApp tab (`WhatsAppArea.vue`, `WhatsAppBox.vue`) | Chat on WhatsApp with the lead or deal | `tabs.add` with `composer: true`, and a writer from `page.composer.add` | `api.whatsapp.create_whatsapp_message`, `react_on_whatsapp_message` (no) | 289; 185 |
| A11 | Events tab (`EventArea.vue`) | See and schedule events for the record | `tabs.add` with a component; D13 for the dialog | Event reads through frappe-ui (v2) | 103 / 103 |
| A12 | Attachments tab, row `attachment_log` (`AttachmentArea.vue`) | See files, change a file to private or public, delete files | Built-in Files tab and `attachment_log` rows | `frappe.client.set_value`, `delete` (v2) | 158 / 158 |
| A13 | `AllModals.vue` | Opens the task, note, call and event dialogs for the tabs | `page.create` and `dialog.open` | `frappe.client.set_value`, `delete` (v2) | 151 / 151 |
| A14 | `TimelineTimestamp.vue` | Relative or exact time on a row (FCRM Settings) | Built-in feed time; the CRM setting has no reader in desk v2 | none | 31 / 31 |

### Components that stay mounted across pages

| # | Part of CRM v1 | User job | Desk v2 carrier, or gap (root area) | Endpoints (cover) | Lines own / with parts |
| --- | --- | --- | --- | --- | --- |
| G-a | `Telephony/CallUI.vue` (with `TwilioCallUI.vue`, `ExotelCallUI.vue`, `TaskPanel.vue`), mounted in `AppHeader.vue` | Take an incoming call; make a call from any record; add a note or task while on the call | G10 component that stays mounted (area 1; CONTEXT.md: "There is no shell-level hook of any kind"). Logging a call after the fact runs today as the act `shell.crm.log_a_call` | `integrations.twilio.api.generate_access_token`, `integrations.exotel.handler.make_a_call`, `integrations.api.get_contact_by_phone_number`, `set_default_calling_medium`, `add_note_to_call_log`, `add_task_to_call_log` (no) | 134 / 1,463 |
| G-b | `EventNotificationsArea.vue` | See upcoming event reminders in the notifications panel | G11 notifications (area 7) | via `data/notifications` | 217 / 217 |
| G-c | `Notifications.vue` (in `AppSidebar.vue`) | Read mentions and assignments; mark read; open the record | G11 (area 7). `@framework/ui` has `NotificationPanel` for `Notification Log`, not used by desk v2. CRM writes `CRM Notification`, not `Notification Log` | `api.notifications.get_notifications`, `mark_as_read` (part: list and update CRM Notification) | 170 / 170 |
| G-d | `EventNotificationPopup.vue` (in `App.vue`) | See a reminder pop up on any page before an event | G10 (area 1) | fed by the `event_notification` listener in `Notifications.vue` | 154 |
| G-e | `GlobalModals.vue` (in `DesktopLayout.vue`) | See row D23 | see D23 | none | 39 |
| G-f | `socket.js` | Reload a cached resource on `refetch_resource` | Desk v2's own record and list updates (`@framework/ui/socket`, `pages/record/liveDocinfo.ts`). No Python in crm or frappe publishes `refetch_resource` | none | 27 |
| G-g | Socket listeners in components | Live updates: `crm_notification`, `event_notification` (Notifications), `exotel_call` (ExotelCallUI), `whatsapp_message` and `docinfo_update` (Activities), `crm_customer_created` (Deal), the enrichment progress event (EnrichFromWebsite), `crm_product_sync_complete` (ERPNextSettings) | On a page: a component that imports `@framework/ui/socket` (U1). On every page: G10 | none | in the parts above |

### Shared kits (not routes, but large)

| # | Part of CRM v1 | User job | Desk v2 carrier, or gap (root area) | Endpoints (cover) | Lines own / with parts |
| --- | --- | --- | --- | --- | --- |
| K1 | `ViewControls.vue` (with `Filter.vue`, `SortBy.vue`, `ColumnSettings.vue`, `QuickFilterField.vue`, `ViewBreadcrumbs.vue`) | Filter, sort, choose columns, quick filters, switch and manage views, import, export | Built-in list controls (filter, sort, columns, quick filter, `customize_quick_filter`). Views: G1, G2, G5. Import, export: G7. Likes on rows: no `/api/v2` part (v2 has favourites) | `api.doc.get_data` (part: `/document/<dt>` with `group_by` and `include=count`; no Kanban columns); `api.doc.get_filterable_fields`, `sort_options` (v2: meta); `api.doc.get_quick_filters`, `update_quick_filters` (fw: Doctype View); `fcrm.crm_view_settings.*` 7 calls (no); `frappe.desk.like.toggle_like` (no); `frappe.model.utils.user_settings.*` (no; desk v2 uses Doctype View) | 1,426 / 3,083 |
| K2 | `Kanban/KanbanView.vue`, `KanbanSettings.vue` | Drag cards across status columns | G1 Kanban (area 2) | `fcrm.crm_view_settings.fetch_and_update_kanban_columns` (no) | 277 / 277 |
| K3 | `GroupBy.vue` | Group rows by a field | G2 (area 2). `@framework/ui` has `GroupBy` (1,231 lines), not used by desk v2 | `api.doc.get_group_by_fields` (v2: meta) | 74 / 74 |
| K4 | `ListBulkActions.vue`, `BulkDeleteLinkedDocModal.vue` | Act on a selection: edit, assign, clear assignment, convert to deal, delete with linked docs, Form Script actions | Built-in bulk delete only (`pages/list/listActs.ts`). The rest: G6 (area 2) | `frappe.desk.form.assign_to.remove_multiple` (part); `convert_to_deal` (no); `api.doc.delete_bulk_docs` (part: `/document/<dt>/bulk_delete`, no linked docs) | 252 / 252; 146 / 146 |
| K5 | `ListViews/` (10 files, 2,097 lines: seven `*ListView.vue`, `ListRows.vue`, `EmptyState.vue`, `WebsiteLink.vue`) | Draw cells: status dot, avatars, time ago, SLA badge, click a cell to filter | `list.js` takes `columns` only (`contributions/types.ts`, `list/defaults.ts:53`). Cell renderers: G6 | none | shared |
| K6 | `FieldLayout/` (4 files) | Draw a layout's tabs, sections and fields | Built-in: `@framework/ui` FormLayout | none | 148 / 1,048 |
| K7 | `SidePanelLayout.vue` | Draw the side panel sections, click to edit | Built-in panel with the Side Panel Form Layout | none | 740 / 1,040 |
| K8 | `FieldLayoutEditor.vue`, `SidePanelLayoutEditor.vue` | Drag fields between sections | G12 (area 6) | none | 677; 187 |
| K9 | `Controls/Grid.vue` (with its 3 modals) | Edit child tables, and their columns | Built-in child table control (`@framework/ui` Grid). The column editor: G12 | `get_fields_layout`, `save_fields_layout` (fw) | 850 / 1,269 |
| K10 | `CommunicationArea.vue`, `EmailEditor.vue`, `CommentBox.vue` | Write an email or a comment | Built-in composer writers `comment` and `email`. Templates: U5 | `api.comment.add_comment` (v2: POST `comments`); `api.get_user_signature` (v2: read User); `frappe.core.doctype.communication.email.make` (fw); `get_email_template` (no) | 333; 348; 153 |
| K11 | `FilesUploader/` | Upload files to a record | Built-in Files tab upload | `api.get_file_uploader_defaults` (no); `api.delete_attachment` (v2: DELETE `attachments`) | 225 / 757 |
| K12 | `AssignTo.vue` | Assign the record | Built-in `people` | `assign_to.add` (v2), `remove_assignments` (v2) | 99 / 302 |
| K13 | `CustomActions.vue` | Draw buttons that CRM Form Scripts add | `header` items from `record.js` or a Client Script. Form Scripts break at the cutover (map ruling 4) | none | 105 / 105 |
| K14 | `EnrichFromWebsite.vue` | Fill organization fields from its website | `header` act with `page.call`; its progress event: U1 | `domain_enrichment.api.enrich` (no) | 104 / 104 |
| K15 | `SLASection.vue` | See response due and SLA status | `panelSections` component | none | 126 / 126 |
| K16 | `DeleteLinkedDocModal.vue` | Delete a record after unlinking or deleting its linked records | Hide `header.delete`; add an own header act with `dialog.open` | `api.doc.get_linked_docs_of_document`, `remove_linked_doc_reference` (no); `frappe.client.delete` (v2) | 280 / 280 |
| K17 | `Layouts/AppSidebar.vue` | Move between views; pinned and public views; notifications count; trial and help banners; clear demo data | Built-in rail and sidebars (Rail and Sidebar records). Pinned and public views: G5. A row with a query: U3. Banners: `@framework/ui` has `TrialBanner` and `SignupBanner`, not used by desk v2 | `api.onboarding.get_first_lead`, `get_first_deal` (no); `demo.api.clear_demo_data` (no) | 736 / 736 |
| K18 | `UserDropdown.vue` | Apps, Settings, Frappe Cloud login, About, Log out, and admin-defined rows | Built-in avatar menu (`shell.all_apps`, `shell.my_settings`, `shell.log_out`). Admin rows and About: G13 | `frappe.apps.get_apps` (not needed: the `/apps` index) | 195 / 207 |
| K19 | `Calendar/CalendarEventPanel.vue` | Edit an event beside the calendar | Part of R13 | `update_attending_status` (no) | 1,035 / 1,035 |
| K20 | `Dashboard/DashboardGrid.vue`, `AddChartModal.vue` | Lay out and add charts | Part of R14 | none | 62; 161 |

## What runs on `/apps/crm` today

| Contribution | File | Lines | What it does |
| --- | --- | --- | --- |
| `add_to_apps_screen` hook | `crm/hooks.py:15-23` | 9 | The tile on `/apps`. Its `route` is still `/crm`. |
| `import_map` hook | `crm/hooks.py:369`, `crm/frontend/lib/index.js` | 20 | Publishes `crm/lib` (`formatDeal`, `DealBadge`) to stored Client Scripts. A demo, not a CRM job. |
| Tailwind preset | `crm/frontend/tailwind.preset.js` | 9 | CRM's brand colour. |
| Rail | `crm/rail/crm/crm.json` | 94 | Leads, Deals, Contacts and Organizations open sidebars; Tasks (CRM Task) and Notes (FCRM Note) open lists. |
| Four sidebars | `crm/sidebar/*/` | 277 | Deals: All Deals, then Configure (Statuses, Products, Territories). Leads: All Leads, then Configure (Statuses, Sources, Lost Reasons). Contacts: All Contacts, Call Logs. Organizations: All Organizations, then Configure (Industries, Territories). |
| `record.js` on CRM Deal and CRM Lead | `crm/fcrm/doctype/crm_deal/frontend/record.js`, `crm_lead/...` | 5 + 5 | `page.tabs.order(['activity', 'emails'])` only. |
| Proof: replacement record page | `crm/fcrm/doctype/crm_organization/frontend/pages.json`, `pages/organization_proof.{js,vue}` | 3 + 4 + 22 | Replaces CRM Organization's record page. The entry names no `apps`, so it applies in every app. The page shows the doctype, the name and a link to the standard page. |
| Proof: replacement list page | `crm/fcrm/custom/note/pages.json`, `pages/notes_proof.{js,vue}` | 8 + 4 + 22 | Replaces the list of frappe's `Note` doctype, in the `crm` app only. The rail's Notes row opens `FCRM Note`, so the proof is not on CRM's notes. |
| Settings: General pane | `crm/settings_dialog/crm/crm.json` | 51 | One pane, three blocks bound to the FCRM Settings Single: `deals` (button save), `communication`, `activity-timeline` (auto save). |
| Settings: Telephony block | `crm/settings_dialog/crm-frappe/crm-frappe.json`, `crm/fcrm/frontend/settings/telephony.vue`, `telephonyRows.js` | 27 + 106 + 14 | `extends: frappe`; a component block in desk's Profile pane, Record binding on CRM Telephony Agent with `session_user`. |
| After-save hook | `crm/fcrm/frontend/afterSave.js` | 7 | Asks to reload after FCRM Settings saves `enable_forecasting` or `currency`. |
| Act "Log a call" | `crm/fcrm/frontend/acts.js` | 16 | `shell.crm.log_a_call` runs `shell.create('CRM Call Log')`. The file also imports `afterSave.js`, for its side effect. |

In total, 703 lines of CRM run on desk v2 (the hook block counted as 9 lines). The CRM v1 frontend is 59,366 lines.

## Candidate areas for build maps

Each area groups screens that belong together. Lines are the sum of "with parts" from the
main table, so shared files are not in them.

| Area | Screens | Contribution kinds | Blockers | Lines |
| --- | --- | --- | --- | --- |
| 1. Lead and Deal record pages | R3, R5, D7, D8, D9 (one record), K12 to K16 | `record.js` (`header`, `panelSections`, `people`, `fields` handlers, `dialog.open`, `dialog.form`), acts | CRM Fields Layout to Form Layout data move (map "Not yet specified"); the Form Script guide (ruling 4); G10 for "Make a call" from the header; U1 (live ERPNext and enrichment events) | 2,957 |
| 2. Contact and Organization record pages | R9, R11 | `custom` record.js on Contact; `record.js` on CRM Organization (`tabs.add`, `panelSections`) | The Organization proof holds the record address in every app (ruling 8); rename has no `/api/v2` route | 1,060 |
| 3. The activity column | A1 to A14, D12 to D15, K10, K11 | `page.tabs.add` (with `create` and `composer`), `page.activity.add`, `page.activity.types`, `page.composer.add`, `dialog.open`, `page.create`, `page.cached` | `get_activities` is only part covered by the v2 feed (calls, notes, tasks); U5 (templates in the email writer); WhatsApp is a separate app | 6,130 |
| 4. Lists and views | R1, R2, R4, R6, R7, R8, R10, R12, D10, D11, K1 to K5 | Built-in list, `list.js` (`columns`), Rail and Sidebar rows, Doctype View | G1, G2, G4, G5, G6, G7; U3 | 7,642 |
| 5. Create dialogs | D1 to D6, D19 | Built-in Create with Quick Entry Form Layout; `page.create`; `page.dialog.form`; the new-record page's `record.js` with `page.isNew` | U2 (enrichment preview, choose-existing-or-new); the layout data move | 1,737 |
| 6. Settings | S0 to S21, D20, D21 | Settings blocks: Single binding, Record binding (`session_user`), component; `extends` desk's Profile and System panes; `registerAfterSave` | G13 (Home Actions has no reader), G15 (Brand has no reader); S15 needs a web form builder (area 6) or CRM-only code; record-list panes (S8 to S14, S20) need a ruling: component block or standard pages | 14,206 |
| 7. Telephony, realtime and notifications | G-a to G-g, R20 | acts in `acts.js` (one runs today), settings blocks (one runs today) | G10, G11 | 1,850 (+154) |
| 8. Calendar, dashboard, import, first run | R13 to R17, K19, K20 | App page (`<module>/frontend/pages/<slug>.js`) as CRM-only code; or framework views | G3, G7, G8, G14 | 2,619 |
| 9. Layout editors | D16 to D18, K8 | none in `types.ts` | G12 | 1,136 |
| 10. Mobile | M1 to M5 | none in `types.ts` | G9 | 2,272 |

Not in an area: the shell parts R18, R19, D22, D23, K17 and K18 (1,132 lines). Desk v2 has
built-ins for most of them, and G5, G13 and U3 for the rest. The shared form kit K6, K7 and
K9 (3,357 lines) has desk v2 built-ins.

## Gap list

A gap is a job that no contribution in `types.ts` can carry, or that needs framework work.

| Gap | Root area | What is missing, in the code | CRM parts it blocks |
| --- | --- | --- | --- |
| G1. List view types: Kanban | 2 | The list page draws one table (`pages/list/DoctypeList.vue`); `list/useListSettings.ts` stores `type: "List"` only | R2, R4, R7, K2 |
| G2. List view types: group by | 2 | No group-by on the list page; `@framework/ui` `GroupBy` is not used | R2, R4, R6, R7, R8, R10, R12, K3 |
| G3. List view types: calendar | 2 | No calendar view | R13, K19 (or an app page) |
| G4. List view types: cards (#42061 says "Image") | 2 | No card or image view | R6 |
| G5. Saved views: create, rename, share, pin, set as default | 2 | The `saved-view` route exists (`router/generated.ts:26`). The list page reads the view name only for the favourite star (`pages/list/DoctypeList.vue:192`). No control creates or edits a view | R1, R2 to R12 (lists), D11, K1, K17 |
| G6. The list beyond columns: cell renderers, row acts and bulk acts | 2 (and #43265: "a Client Script can change the list page") | `ListHandlers` has `columns` only (`contributions/types.ts`); the list acts are `create`, `favourite`, `customize_quick_filter`, `delete` (`pages/list/listActs.ts`) | R2 to R12 (lists), D9 (selection), D10, K4, K5 |
| G7. Import and export from a list | none names it (closest: 2) | No import or export act on the list; `@framework/ui` `DataImport` is not used | R15, K1 |
| G8. Dashboards and charts | 4 | No dashboard or chart page | R14, K20 |
| G9. The mobile shell | 1 (leftover of #42569) | No mobile layout or mobile record page | M1 to M5, R20 |
| G10. A component that stays mounted across pages | 1 (CONTEXT.md: "There is no shell-level hook of any kind") | `acts.js` runs code at idle on every page (`shell/appActs.ts`), but it has no place to draw a component | G-a, G-d, G-g (global listeners), D23, "Make a call" in area 1 |
| G11. The notifications panel and its bell | 7 | No bell or panel in the shell; `@framework/ui` `NotificationPanel` reads `Notification Log`, CRM writes `CRM Notification` | G-b, G-c, R20 |
| G12. The layout editor UI | 6 ("the layout editor UI stays in area 6", #44894) | `Form Layout` rows exist (`frappe/desk/doctype/form_layout`); no editor in desk v2 | D16, D17, D18, K8, the column editor in K9 |
| G13. App rows in the user menu | 1 (leftover of #42569: "app-contributed user-menu rows") | "Not contributable: ... shell chrome" (`contributions/types.ts`) | S16, K18, D22 |
| G14. A first-run redirect and onboarding | none names it | "Not contributable: a route table" (`contributions/types.ts`); `@framework/ui` `Onboarding` is not used | R16, R17, the onboarding banners in K17 |
| G15. An app logo from a site setting | 1 | The rail logo is the hook's `logo` (`frappe/shell/boot.py:186`) | S6 |

### Unclear: the code does not settle these

| Id | Question | Where to look |
| --- | --- | --- |
| U1 | Can a record script listen to a socket event? `page` has no socket member (SCRIPTING.md, "The page engine"). An app file can import `@framework/ui/socket` (`ui/package.json` exports `./socket`). A stored Client Script imports only the `import_map` names, and frappe's map has `@framework/ui`, not its subpaths (`frappe/hooks.py:21-27`). | R5, K14, A1, S19 |
| U2 | Can CRM change the Create dialog? `page.create` takes `values` only, and no script runs in the dialog (SCRIPTING.md, `page.create`). The full-page new record runs record scripts with `page.isNew` (SCRIPTING.md, "A new record"). | D1, D2, D4 |
| U3 | Can a sidebar row open a saved view or a filtered list? A Navigation Item "carries no query of its own" (CONTEXT.md). The `Link` type's renderer is `frappe/desk/navigation_item_type/link/frontend/item.js`. | K17, R1 |
| U4 | Does a CRM timeline setting (`crm_timeline_timestamp_format`, `crm_timeline_sort_order`) change desk v2's feed? The General pane saves them; I found no reader in `frontend/src`. | S3, A14 |
| U5 | Can a script put a template into the email writer? `page.composer.open('email', { draft })` seeds the draft, but "a draft already in memory for this record wins" (SCRIPTING.md, composer acts). `EmailWriter.vue` has no template picker. SCRIPTING.md lists `comment` as the only built-in writer, but the email writer is in the code (`pages/record/composer/emailDraft.ts`, `EMAIL_WRITER = "email"`). | D14, K10 |

## Appendix: every endpoint CRM v1 calls

Calls found as string literals in `frontend/src` (111 names). "Called from" names the part
or the shared file.

| Endpoint | Called from | Cover | Framework route or method |
| --- | --- | --- | --- |
| `crm.api.activities.get_activities` | A1 | part | `GET /api/v2/document/<dt>/<name>/activity` |
| `crm.api.assignment_rule.get_assignment_rules_list` | S13 | part | `GET /api/v2/document/Assignment Rule` |
| `crm.api.assignment_rule.duplicate_assignment_rule` | S13 | part | `GET /api/v2/document/<dt>/<name>/copy` |
| `crm.api.comment.add_comment` | K10 | v2 | `POST /api/v2/document/<dt>/<name>/comments` |
| `crm.api.contact.create_new`, `set_as_primary` | `composables/useContactFields.ts` | part | `PATCH /api/v2/document/Contact/<name>` |
| `crm.api.contact.get_linked_deals` | R9, M3 | part | `GET /api/v2/document/CRM Deal` |
| `crm.api.dashboard.get_dashboard`, `get_chart`, `reset_to_default` | R14 | no | |
| `crm.api.delete_attachment` | `composables/useAttachments.js` | v2 | `DELETE /api/v2/document/<dt>/<name>/attachments/<file>` |
| `crm.api.doc.add_seen` | `composables/useVisitedRecords.ts` | v2 | `include=seen` on a document read |
| `crm.api.doc.delete_bulk_docs` | K4 | part | `POST /api/v2/document/<dt>/bulk_delete` |
| `crm.api.doc.get_assigned_users` | `data/document.js` | v2 | `include=assignments` |
| `crm.api.doc.get_data` | K1 | part | `GET /api/v2/document/<dt>` with `group_by`, `include=count` |
| `crm.api.doc.get_fields`, `get_filterable_fields`, `get_group_by_fields`, `sort_options` | D10, S21, K1, K3 | v2 | `GET /api/v2/doctype/<dt>/meta` |
| `crm.api.doc.get_linked_docs_of_document`, `remove_linked_doc_reference` | K16 | no | |
| `crm.api.doc.get_quick_filters`, `update_quick_filters` | K1 | fw | `frappe.desk.doctype.doctype_view.api` |
| `crm.api.doc.remove_assignments` | K12, D9 | v2 | `DELETE /api/v2/document/<dt>/<name>/assignments/<key>` |
| `crm.api.form.*` (9 calls) | S15 | no | |
| `crm.api.get_file_uploader_defaults` | K11 | no | |
| `crm.api.get_user_signature` | K10 | v2 | `GET /api/v2/document/User/<name>` |
| `crm.api.invite_by_email` | S9 | part | `frappe.core.api.user_invitation.invite_by_email` |
| `crm.api.notifications.get_notifications`, `mark_as_read` | `stores/notifications.js` | part | `/api/v2/document/CRM Notification` |
| `crm.api.onboarding.get_first_lead`, `get_first_deal` | K17 | no | |
| `crm.api.session.get_organizations`, `get_user_info` | `stores/` | v2 | `/api/v2/document/...`, `/api/v2/session` |
| `crm.api.session.get_users` | `stores/users.js` | part | `GET /api/v2/document/User` (no CRM roles) |
| `crm.api.settings.create_email_account` | S11 | part | `POST /api/v2/document/Email Account` |
| `crm.api.user.add_existing_users`, `update_user_role`, `remove_crm_roles_from_user`, `change_password` | D21, S8, D20 | no | |
| `crm.api.views.get_views` | `stores/views.js` | no | (desk v2 Doctype View is a different model) |
| `crm.api.whatsapp.*` (6 calls) | A1, A10, D15, `composables/whatsapp.js` | no | |
| `crm.demo.api.clear_demo_data` | K17 | no | |
| `crm.domain_enrichment.api.enrich`, `enrich_preview` | K14, D1, D2, D4 | no | |
| `fcrm.crm_call_log.get_call_log` | A7, R12 | part | `GET /api/v2/document/CRM Call Log/<name>` |
| `fcrm.crm_call_log.create_lead_from_call_log` | D12 | no | |
| `fcrm.crm_deal.add_contact`, `remove_contact`, `set_primary_contact`, `crm.fcrm.doctype.crm_deal.api.get_deal_contacts` | R5, M2 | part | `PATCH /api/v2/document/CRM Deal/<name>` (`contacts` table) |
| `fcrm.crm_deal.create_deal` | D2 | part | `POST /api/v2/document/CRM Deal` |
| `fcrm.crm_fields_layout.get_fields_layout`, `get_sidepanel_sections`, `save_fields_layout` | D1 to D7, D16 to D19, A6, K9; R3, R5, R9, R11, M1 to M4 | fw | `frappe.desk.doctype.form_layout.form_layout.get_form_layouts` |
| `fcrm.crm_lead.convert_to_deal` | D7, K4 | no | |
| `fcrm.crm_view_settings.*` (8 calls) | K1, D11 | no | |
| `fcrm.erpnext_crm_settings.get_product_sync_status` | S19 | no | |
| `crm.integrations.*` (7 calls) | G-a, D12, `composables/telephony.js` | no | |
| `frappe.client.get`, `get_list`, `get_value`, `get_single_value`, `insert`, `set_value`, `delete` | many | v2 | `/api/v2/document/...` |
| `frappe.client.get_doc_permissions` | `data/document.js` | v2 | `include=permissions` |
| `frappe.client.rename_doc` | R11, S11 to S14 | no | |
| `frappe.core.doctype.communication.email.make` | K10 | fw | desk v2's email writer calls it |
| `frappe.core.doctype.user.user.get_timezones` | S2 | fw | desk's `locale` block calls it |
| `frappe.desk.doctype.bulk_update.bulk_update.submit_cancel_or_update_docs` | D10 | v2 | `POST /api/v2/document/<dt>/bulk_update` |
| `frappe.desk.doctype.event.event.update_attending_status` | K19 | no | |
| `frappe.desk.form.assign_to.add` | K12, D9 | v2 | `POST /api/v2/document/<dt>/<name>/assignments` |
| `frappe.desk.form.assign_to.add_multiple`, `remove_multiple` | D9, K4 | part | one `assignments` call per record |
| `frappe.desk.form.load.getdoctype` | `stores/meta.js` | v2 | `GET /api/v2/doctype/<dt>/meta` |
| `frappe.desk.like.toggle_like` | K1 | no | (v2 has `favourites`, a different row) |
| `frappe.email.doctype.email_template.email_template.get_email_template` | K10 | no | |
| `frappe.model.utils.user_settings.get`, `save` | `data/userSettings.ts`, `stores/meta.js` | no | (desk v2 uses Doctype View) |
| `frappe.apps.get_apps` | K18 | not needed | the `/apps` index |
| `frappe.integrations.frappe_providers.frappecloud_billing.current_site_info`, `frappe.utils.telemetry.pulse.client.boot_config` | `composables/frappecloud.js`, `router.js` | fw | `@framework/ui` calls them |
