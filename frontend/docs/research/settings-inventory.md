# Settings today: an inventory

Research for the map "Desk v2 — settings in one dialog" (frappe/frappe#45148), ticket
frappe/frappe#45149. It records what exists today. It makes no decision.

The note uses the map's words. A **settings dialog** has **panes**. A pane is a list of
**blocks**. Each block has one **binding**: a Single, a Record (one named record, such as
the session `User`), or none (a component that handles its own data).

## Sources

| App | Branch | Commit |
|---|---|---|
| frappe | `desk-v2` | `f53bed6a7f` |
| crm | `desk-v2` | `70d47a2973` |
| erpnext | `desk-v2` | `d8aeb8b0ed` |

Every fact below was read from that code. The Single counts come from a script that reads
each `doctype/<name>/<name>.json` with `"issingle": 1`. A read-only query on
`desk.localhost` gives the same counts (frappe 36 = 34 shipped + 2 custom test doctypes,
crm 5, erpnext 31).

Short names used in citations:

| Short name | Path |
|---|---|
| `U` | `frappe/public/js/frappe/ui/user_settings_dialog.js` |
| `S` | `frappe/public/js/frappe/ui/settings_dialog.js` |
| `D` | `frappe/public/js/frappe/form/doctype_settings/doctype_settings.js` |
| `R` | `frappe/public/js/frappe/form/doctype_settings/registry.js` |
| `SM` | `frappe/desk/doctype_settings/settings_map.py` |
| `UJ` | `frappe/core/doctype/user/user.json` |
| `UP` | `frappe/core/doctype/user/user.py` |
| `CS/` | `crm/frontend/src/components/Settings/` |
| `CF/` | `crm/frontend/src/` |

## 1. Desk v1's user settings dialog

**Shape.** One group, nine tabs (`U:30-49`). The sidebar's user menu loads the bundle and
opens the Profile tab (`frappe/public/js/frappe/ui/sidebar/sidebar.js:399-401`). The phone
Profile page reuses the same load and save functions (`U:57-68`,
`frappe/desk/page/profile/profile.vue:56`).

**Load.** One `frappe.db.get_value` reads 26 fields of the session `User` (`U:78-105`).

**Save.** Every save is `frappe.db.set_value("User", session user, ...)`. Each save shows a
"Refresh to see changes" toast with a reload button (`U:111-147`). Eight fields are also
patched into `frappe.boot.user` (`U:3-12`, `U:124-139`).

| # | Tab | `User` fields written | Other data | How it saves | Citation |
|---|---|---|---|---|---|
| 1 | Profile | `first_name`, `middle_name`, `last_name`, `username`, `user_image` | Password, through the change-password dialog | Save button for the 4 name fields; `user_image` on upload | `U:304-431` |
| 2 | Email | `thread_notify`, `send_me_a_copy`, `send_read_receipt`, `email_signature` | — | 3 switches on change; Save button for the signature | `U:161-180`, `U:435-464` |
| 3 | Appearance | `desk_theme`, `dock_mode` | Full width in `localStorage.container_fullwidth` | Theme through `switch_theme` (`UP:1650-1652`); dock on click; full width in the browser only | `U:468-587`, `frappe/public/js/frappe/ui/theme_switcher.js:147-155`, `frappe/public/js/frappe/ui/toolbar/toolbar.js:233-239` |
| 4 | Preferences | `notifications`, `search_bar`, `show_my_space`, `mute_sounds`, `language`, `time_zone` | Time zone list (`get_timezones`); language name lookup | 4 switches on change; language and time zone in a small dialog | `U:181-206`, `U:634-758` |
| 5 | Lists | `list_sidebar`, `bulk_actions`, `view_switcher` | — | On change | `U:207-227`, `U:762-774` |
| 6 | Forms | `form_sidebar`, `timeline`, `dashboard`, `show_absolute_datetime_in_timeline`, `form_navigation_buttons` | — | On change | `U:228-264`, `U:778-790` |
| 7 | Reports | `report_split_view` | — | On change | `U:265-273`, `U:794-806` |
| 8 | Session Defaults | none | Field list from the Single `Session Default Settings`; values are user defaults | Save button calls `set_session_default_values`, which writes `frappe.defaults.set_user_default` | `U:810-879`, `frappe/core/doctype/session_default_settings/session_default_settings.py:30-56` |
| 9 | Keyboard Shortcuts | none | `frappe.ui.keys` registry, read-only | Nothing to save | `U:883-902` |

**Counts.**

- 9 tabs. 7 tabs write `User` fields. 2 tabs hold no `User` field: Session Defaults and
  Keyboard Shortcuts.
- 26 `User` fields are written. That is 26 of the 112 fields in `User` (6 tabs). Most sit
  in the `User` form's *Settings* tab.
- 3 save styles for the 26 `User` fields: 18 save on change (16 switches, `dock_mode`,
  `desk_theme`), 5 save with a button (4 name fields, `email_signature`) and 2 save in a
  small dialog (`language`, `time_zone`). `user_image` saves on upload. The session
  defaults form also saves with a button.
- 2 tabs mix sources. Profile mixes `User` with the password API. Appearance mixes `User`
  with browser storage.

**Facts that bear on a Record binding.**

- A user can write their own `User` only through a DocShare. `share_with_self` adds it on
  insert (`UP:493-499`). The DocType gives *Desk User* only `select` (`UJ:980-983`).
- `bulk_actions` is at permlevel 1 (`UJ:828-834`). For a user without permlevel 1,
  `validate_higher_perm_levels` resets it to the old value without an error
  (`frappe/model/document.py:1622-1634`). The dialog still shows "Saved".
- The theme lives in three places. Desk v1 writes `User.desk_theme`. Desk v2's rail and
  CRM write `localStorage.theme` through frappe-ui (`useColorScheme`, `useTheme`;
  `frontend/src/shell/RailColumn.vue:180`, `CS/ThemeSwitcher.vue:186`).
- The desk v2 rail menu's *My settings* opens desk v1's `User` form as a workaround
  (`frontend/src/shell/RailColumn.vue:189`).

## 2. Single doctypes in frappe, CRM and ERPNext

**Method.** A *value field* is any field except Section Break, Column Break, Tab Break,
HTML, Button, Heading, Fold and Image. *Tables* counts Table and Table MultiSelect
fields. A *tool* is a Single used as a one-shot form that runs an action, not as stored
configuration. The split is by reading the name, the fields and the controller. The 20
tools are listed in the appendix.

### Per app

| App | Singles | Settings | Tools | Fields | Value fields (settings only) | Median value fields (settings) | Settings with tabs | Settings with tables |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| frappe | 34 | 25 | 9 | 599 | 279 | 5 | 4 | 12 |
| crm | 5 | 5 | 0 | 102 | 63 | 10 | 2 | 3 |
| erpnext | 31 | 20 | 11 | 622 | 298 | 8.5 | 5 | 9 |
| **Total** | **70** | **50** | **20** | **1323** | **640** | **6.5** | **11** | **24** |

### Per module

| App | Module | Singles | Value fields | Tabs | Singles |
|---|---|---:|---:|---:|---|
| frappe | Core | 13 | 133 | 10 | Audit Trail, Data Export, Document Naming Settings, Domain Settings, Installed Applications, Log Settings, Navbar Settings, Permission Inspector, Role Permission for Page and Report, SMS Settings, Security Settings, Session Default Settings, System Settings |
| frappe | Integrations | 6 | 53 | 2 | Geolocation Settings, Google Settings, LDAP Settings, OAuth Provider Settings, OAuth Settings, Push Notification Settings |
| frappe | Website | 5 | 73 | 6 | About Us Settings, Contact Us Settings, Portal Settings, Website Script, Website Settings |
| frappe | Desk | 5 | 47 | 1 | Bulk Update, Desktop Settings, Global Search Settings, System Console, System Health Report |
| frappe | Custom | 1 | 46 | 2 | Customize Form |
| frappe | Printing | 1 | 18 | 0 | Print Settings |
| frappe | Automation | 1 | 11 | 0 | Automation Settings |
| frappe | Flow | 1 | 5 | 0 | Flow Knowledge Settings |
| frappe | Studio | 1 | 1 | 0 | Studio Settings |
| crm | FCRM | 4 | 45 | 5 | CRM Exotel Settings, CRM Twilio Settings, ERPNext CRM Settings, FCRM Settings |
| crm | Domain Enrichment | 1 | 18 | 3 | CRM Enrichment Settings |
| erpnext | Accounts | 12 | 146 | 8 | Accounts Settings, Bank Clearance, Bank Reconciliation Tool, Bisect Accounting Statements, Chart of Accounts Importer, Currency Exchange Settings, Ledger Health Monitor, Opening Invoice Creation Tool, POS Settings, Payment Reconciliation, Pegged Currencies, Subscription Settings |
| erpnext | Stock | 5 | 76 | 8 | Delivery Settings, Item Variant Settings, Quick Stock Balance, Stock Reposting Settings, Stock Settings |
| erpnext | Selling | 2 | 45 | 6 | SMS Center, Selling Settings |
| erpnext | Buying | 1 | 29 | 6 | Buying Settings |
| erpnext | Manufacturing | 2 | 22 | 2 | BOM Update Tool, Manufacturing Settings |
| erpnext | CRM | 2 | 22 | 0 | Appointment Booking Settings, CRM Settings |
| erpnext | Support | 1 | 15 | 0 | Support Settings |
| erpnext | Setup | 2 | 9 | 0 | Authorization Control, Global Defaults |
| erpnext | ERPNext Integrations | 1 | 6 | 0 | Plaid Settings |
| erpnext | Utilities | 2 | 5 | 0 | Rename Tool, Video Settings |
| erpnext | Projects | 1 | 4 | 0 | Projects Settings |

### The largest settings Singles

| Single | App | Fields | Value fields | Tabs | Tabs and value fields per tab |
|---|---|---:|---:|---:|---|
| System Settings | frappe | 129 | 86 | 9 | (first, no label) 19; Login 18; Password 6; Email 8; Files 9; App 2; Display 5; Backups 2; Advanced 14; AI Agents 3 |
| Accounts Settings | erpnext | 113 | 66 | 8 | Invoice and Billing 34; Payments 7; Credit Limits 6; Assets 3; Accounts Closing 3; Reports 6; Others 7; Document Naming 0 |
| Stock Settings | erpnext | 80 | 49 | 8 | Defaults 12; Stock Validations 9; Serial & Batch Item 14; Stock Reservation 5; Quality 3; Stock Planning 2; Stock Closing 4; Document Naming 0 |
| Website Settings | frappe | 69 | 42 | 6 | Home 10; Navbar 12; Footer 8; Integrations 9; Header, Robots 3; Redirects 1 |
| Selling Settings | erpnext | 60 | 35 | 6 | Customer Defaults 4; Pricing 9; Transaction 16; Advanced Features 4; Subcontracting Inward 2; Document Naming 0 |
| Buying Settings | erpnext | 47 | 29 | 6 | Defaults 3; Pricing 5; Transaction Settings 15; Subcontracting Settings 5; Request for Quotation 1; Document Naming 0 |
| LDAP Settings | frappe | 43 | 28 | 0 | — |
| Manufacturing Settings | erpnext | 35 | 20 | 2 | BOM and Production 10; Job Card and Capacity Planning 10 |
| FCRM Settings | crm | 30 | 19 | 5 | Settings 8; Currency 3; Branding 3; Calendar 3; Dropdown items 2 |
| Print Settings | frappe | 27 | 18 | 0 | — |
| CRM Enrichment Settings | crm | 29 | 18 | 3 | General 5; Crawl 11; SSRF Guard 2 |

The two largest tools are Customize Form (46 value fields) and System Health Report (34).

### Size and shape of the 50 settings Singles

| Measure | Count |
|---|---:|
| 10 value fields or fewer | 33 |
| 11 to 30 value fields | 12 |
| More than 30 value fields | 5 |
| Has at least one Tab Break | 11 |
| Has at least one Table field | 24 |
| Has a Button field | 6 |
| Has an HTML field | 9 |
| Has a client script with more than 15 non-blank lines | 22 |
| Permission rows only for System Manager or Administrator | 26 |
| Has a field at permlevel > 0 | 3 (CRM Twilio Settings, ERPNext CRM Settings, Appointment Booking Settings) |

### Prior art: the DocType Settings Map

Desk v1 already shows fields of Singles outside their own form. A `DocType Settings Map`
names a target doctype and rows of (Single, field). The DocType Settings dialog's *General*
tab shows them, grouped by Single (`SM:1-14`).

- 31 shipped maps, all in ERPNext, with 163 rows over 10 Singles: Stock Settings 37,
  Selling Settings 33, Buying Settings 32, Manufacturing Settings 21, Accounts Settings 20,
  Stock Reposting Settings 8, Delivery Settings 4, Item Variant Settings 3, Projects
  Settings 3, Subscription Settings 2 (`erpnext/*/doctype_settings_map/*.json`).
- The server drops a Single the user cannot read. It drops a field above the user's read
  permlevel, and sends `can_write` per field (`SM:70-105`). It sends a `doc` context for
  `depends_on` (`SM:110-121`).
- The client saves each field on change with `frappe.db.set_value`
  (`frappe/public/js/frappe/form/doctype_settings/tabs/settings_map.js:160-166`).

## 3. CRM's settings modal

**Shape.** 20 panes in 7 groups (`CS/Settings.vue:100-253`). Every pane is one Vue
component. The modal keeps no binding model. Each component loads and saves its own data.

**Address.** A pane is found by its translated label (`CS/Settings.vue:31`,
`CS/Settings.vue:269-276`). The modal opens from the user menu
(`CF/components/UserDropdown.vue:141`), from the sidebar
(`CF/components/Layouts/AppSidebar.vue:477-478`), from the email template picker
(`CF/components/Modals/EmailTemplateSelectorModal.vue:106-107`) and from Form Scripts
through `crm.openSettings(page)` (`CF/data/document.js:207-211`). The callers pass the
English label, so in another language the lookup falls back to the first pane
(`CS/Settings.vue:270-276`).

**Visibility.** Groups and panes are gated by role (`isManager()`, Sales Manager or admin;
`CF/stores/users.js:140-142`), not by doctype permission. A user who is not a manager sees
4 panes: Profile, Preferences, Templates and Telephony.

| Group | Pane | Binding | Data it reads and writes | Mixed | Citation |
|---|---|---|---|---|---|
| User Configuration | Profile | Record | `User` (session): `first_name`, `last_name`, `user_image`; a second screen for `user_emails` (child table, permlevel 1) and `email_signature`; `Email Account` list; password modal | yes (Record + list) | `CS/Profile/ProfileSettings.vue:154`, `CS/Profile/UserEmailSettings.vue:135-138`, `CS/Profile/UserEmailSettings.vue:178` |
| User Configuration | Preferences | Record | `User` (session): `language`, `time_zone`; theme in `localStorage`; reads FCRM brand for the theme preview | yes (Record + browser) | `CS/PreferencesSettings.vue:29`, `CS/PreferencesSettings.vue:105-106` |
| System Configuration | General | Single | FCRM Settings, 5 fields | no | `CS/GeneralSettings.vue:136` |
| System Configuration | Dashboard | Single | FCRM Settings, 5 fields | no | `CS/DashboardSettings.vue:181` |
| System Configuration | Defaults | Single | frappe's System Settings, 6 fields | no | `CS/DefaultsSettings.vue:154-157` |
| System Configuration | Brand | Single | FCRM Settings, 3 fields | no | `CS/BrandSettings.vue:126` |
| System Configuration | Calendar | Single | FCRM Settings, 3 fields (2 child tables) | no | `CS/CalendarSettings.vue:265` |
| User Management | Users | none | `crm.api.session.get_users`, `crm.api.user.update_user_role`, `remove_crm_roles_from_user` | no | `CF/stores/users.js:18`, `CS/Users.vue:268`, `CS/Users.vue:287` |
| User Management | Invite User | none | `crm.api.invite_by_email`; `CRM Invitation` list | no | `CS/InviteUserPage.vue:175`, `CS/InviteUserPage.vue:197-199` |
| User Management | Sales Hierarchy | Single + none | FCRM Settings `enable_sales_hierarchy`; `CRM Sales Hierarchy` tree | yes | `CS/Hierarchy/Hierarchy.vue:269`, `CS/Hierarchy/Hierarchy.vue:284-299` |
| Email | Accounts | none | `Email Account` list; `crm.api.settings.create_email_account` | no | `CS/EmailAccountList.vue:65`, `CS/EmailAdd.vue:138` |
| Email | Templates | none | `Email Template` list | no | `CS/EmailTemplate/EmailTemplatePage.vue:31-33` |
| Automation & Rules | Assignment Rules | none | `crm.api.assignment_rule.*`; `Assignment Rule` records | no | `CS/AssignmentRules/AssignmentRules.vue:42` |
| Automation & Rules | SLA Policies | none | `CRM Service Level Agreement`, `CRM Holiday List`, `CRM Communication Status` | no | `CS/Sla/SlaConfig.vue:15-16` |
| Automation & Rules | Forms | none | `crm.api.form.*` | no | `CS/Forms/FormsList.vue:169` |
| Customization | Home Actions | Single | FCRM Settings `dropdown_items` (child table) | no | `CS/HomeActions.vue:45-48` |
| Integrations | Telephony | Record + Single | `CRM Telephony Agent` named by the session user, inserted on first save if missing; CRM Twilio Settings and CRM Exotel Settings on manager-only sub-screens | yes | `CS/Telephony/TelephonySettings.vue:241-252`, `CS/Telephony/TelephonySettings.vue:268-282`, `CS/Telephony/TwilioSettings.vue:146`, `CS/Telephony/ExotelSettings.vue:139` |
| Integrations | WhatsApp | Single | WhatsApp Settings (from the `frappe_whatsapp` app), drawn from meta by the generic `SettingsPage` | no | `CS/WhatsAppSettings.vue:2`, `CS/SettingsPage.vue:72-95` |
| Integrations | ERPNext | Single + none | ERPNext CRM Settings; product sync status API; Company and CRM Deal Status links | yes | `CS/ERPNextSettings.vue:481`, `CS/ERPNextSettings.vue:525` |
| Integrations | Lead Syncing | none | `Lead Sync Source` list and form; Facebook docs | no | `CS/LeadSyncing/LeadSyncSourcePage.vue:30-32` |

**Counts.**

| Binding | Panes |
|---|---:|
| Single only | 7 (General, Dashboard, Defaults, Brand, Calendar, Home Actions, WhatsApp) |
| Record only | 0 |
| Mixed sources | 5 (Profile, Preferences, Sales Hierarchy, Telephony, ERPNext) |
| None (collections and custom APIs) | 8 (Users, Invite User, Accounts, Templates, Assignment Rules, SLA Policies, Forms, Lead Syncing) |
| **Total** | **20** |

- FCRM Settings feeds 6 panes. They show 18 of its 19 value fields. The only one not shown
  is `persona_captured`. All 6 panes share one document resource
  (`CF/stores/settings.js:7-15`).
- 4 of 5 CRM Singles appear. CRM Enrichment Settings has no pane.
- 2 Singles from other apps appear: frappe's System Settings and frappe_whatsapp's
  WhatsApp Settings.
- 1 generic Single renderer exists (`CS/SettingsPage.vue`). It has 1 user (WhatsApp).
- Save styles differ by pane. General saves on each toggle (`CS/GeneralSettings.vue:147-164`).
  Defaults and Preferences use a Save button and a dirty check. Preferences reloads the
  page when language or time zone change (`CS/PreferencesSettings.vue:108-124`).

## 4. Desk v1's `frappe.ui.SettingsDialog`

`frappe.ui.SettingsDialog` extends `frappe.ui.Dialog` (`S:166-176`). It draws a grouped tab
rail on the left and one panel per tab on the right (`S:178-214`).

| Concern | How it works | Citation |
|---|---|---|
| Declare a tab | `tabs: [{ group, items: [{ id, label, icon \| icon_html, title, description, actions, fields, render, on_activate }] }]` | `S:136-165` |
| Group | A group has a heading and a list of items. Ids go in one flat lookup. There is no order key, no priority and no `condition`. | `S:223-246` |
| Render | A panel is built on first activation and kept on later switches. `fields` mounts a `FieldGroup`. `render(panel)` draws custom content. A tab can have both. | `S:81-103`, `S:278-302` |
| Panel API | `body`, `set_view`, `set_header`, `add_fields`, `refresh`, `get_values`, `get_value`, `set_values`, `get_field`, `dialog` | `S:5-124` |
| Act | Header buttons `{ label, icon, variant, theme, class, click(panel) }`. `click` gets the panel. | `S:47-79` |
| Save | None. The dialog holds no document, no draft and no dirty state. Each consumer saves on its own. | `S:1-326` |
| Open | `new frappe.ui.SettingsDialog({...}).show()`, `default_tab`, `activate(id)`. `reset(tabs, default_tab)` swaps all tabs. No URL or hash route. | `S:212-213`, `S:278-325` |
| Extend | No registry. The caller builds the whole tab list. | `S:166-214` |

**Users: 4, not 2.**

| User | Citation |
|---|---|
| User settings dialog | `U:30` |
| DocType Settings dialog | `D:85` |
| Workspace manager | `frappe/public/js/frappe/views/workspace/workspace.js:595` |
| Kanban board settings | `frappe/public/js/frappe/views/kanban_v2/kanban_settings.bundle.js:50` |

**The DocType Settings registry adds what the base dialog lacks.** A tab registers a
builder with `frappe.doctype_settings.register(id, builder)` (`R:19-23`). `groups` holds
the order (`R:180-249`). An item has an optional `condition()`. Most conditions are
`frappe.model.can_read(<doctype>)`; Roles and User Permissions check the System Manager
role (`R:16-17`, `R:180-249`). The dialog drops items without a builder or with a false
condition, and drops empty groups (`D:57-77`).

## For the grillings

**Contribution (#45152).**

- Desk v1 has one registry pattern: `register(id, builder)` plus an ordered `groups` list
  plus `condition()` (`R:19-23`, `D:57-77`). The base `SettingsDialog` has none.
- CRM addresses a pane by its translated label, and Form Scripts open it by that label.
  This breaks outside English.
- CRM gates panes by role. DocType Settings gates tabs by `can_read`. The map's rule is
  "cannot read the Single, does not see it".
- 8 of CRM's 20 panes are collection managers with their own APIs. They are blocks with no
  binding.
- 26 of the 50 settings Singles have permission rows only for System Manager or
  Administrator. A user without those roles sees few or no Single panes.

**Binding (#45153).**

- A Record binding must cover the session `User` (26 fields in desk v1, writable through a
  self DocShare) and a record that may not exist yet (CRM's `CRM Telephony Agent`, created
  on first save).
- One Single can feed many panes: FCRM Settings feeds 6. CRM shares one resource for all
  6.
- Fields above the user's permlevel are reset on save without an error (`User.bulk_actions`,
  `User.user_emails`). The DocType Settings Map already sends `can_write` per field.
- Some settings are neither Single nor Record: theme and full width in browser storage,
  session defaults in user defaults, keyboard shortcuts with no data.
- Two save styles exist side by side: save on change (most switches) and a Save button
  (names, signature, CRM Defaults). Language and time zone need a page reload.
- 24 of 50 settings Singles have a Table field, 11 have tabs and 22 have a client script
  over 15 lines. A generated block meets these.

## Appendix: every Single

Roles are the roles that have any permission row in the DocType JSON.

| App | Module | Single | Kind | Fields | Value fields | Tabs | Tables | Roles | File |
|---|---|---|---|---:|---:|---:|---:|---|---|
| crm | Domain Enrichment | CRM Enrichment Settings | settings | 29 | 18 | 3 | 4 | Sales Manager, System Manager | `crm/domain_enrichment/doctype/crm_enrichment_settings/crm_enrichment_settings.json` |
| crm | FCRM | CRM Exotel Settings | settings | 12 | 7 | 0 | 0 | Sales Manager, System Manager | `crm/fcrm/doctype/crm_exotel_settings/crm_exotel_settings.json` |
| crm | FCRM | CRM Twilio Settings | settings | 16 | 9 | 0 | 0 | Sales Manager, System Manager | `crm/fcrm/doctype/crm_twilio_settings/crm_twilio_settings.json` |
| crm | FCRM | ERPNext CRM Settings | settings | 15 | 10 | 0 | 1 | Sales Manager, Sales User, System Manager | `crm/fcrm/doctype/erpnext_crm_settings/erpnext_crm_settings.json` |
| crm | FCRM | FCRM Settings | settings | 30 | 19 | 5 | 3 | Sales Manager, Sales User, System Manager | `crm/fcrm/doctype/fcrm_settings/fcrm_settings.json` |
| erpnext | Accounts | Accounts Settings | settings | 113 | 66 | 8 | 1 | Accounts Manager, Purchase User, Sales User | `erpnext/accounts/doctype/accounts_settings/accounts_settings.json` |
| erpnext | Accounts | Bank Clearance | tool | 10 | 8 | 0 | 1 | Accounts User | `erpnext/accounts/doctype/bank_clearance/bank_clearance.json` |
| erpnext | Accounts | Bank Reconciliation Tool | tool | 16 | 10 | 0 | 0 | System Manager | `erpnext/accounts/doctype/bank_reconciliation_tool/bank_reconciliation_tool.json` |
| erpnext | Accounts | Bisect Accounting Statements | tool | 27 | 10 | 0 | 0 | Administrator | `erpnext/accounts/doctype/bisect_accounting_statements/bisect_accounting_statements.json` |
| erpnext | Accounts | Chart of Accounts Importer | tool | 5 | 2 | 0 | 0 | Accounts Manager | `erpnext/accounts/doctype/chart_of_accounts_importer/chart_of_accounts_importer.json` |
| erpnext | Accounts | Currency Exchange Settings | settings | 13 | 8 | 0 | 2 | Accounts User, System Manager | `erpnext/accounts/doctype/currency_exchange_settings/currency_exchange_settings.json` |
| erpnext | Accounts | Ledger Health Monitor | settings | 7 | 5 | 0 | 1 | Accounts Manager, Accounts User, System Manager | `erpnext/accounts/doctype/ledger_health_monitor/ledger_health_monitor.json` |
| erpnext | Accounts | Opening Invoice Creation Tool | tool | 11 | 6 | 0 | 1 | System Manager | `erpnext/accounts/doctype/opening_invoice_creation_tool/opening_invoice_creation_tool.json` |
| erpnext | Accounts | POS Settings | settings | 6 | 4 | 0 | 2 | Accounts User, Sales User, System Manager | `erpnext/accounts/doctype/pos_settings/pos_settings.json` |
| erpnext | Accounts | Payment Reconciliation | tool | 32 | 23 | 0 | 3 | Accounts Manager, Accounts User | `erpnext/accounts/doctype/payment_reconciliation/payment_reconciliation.json` |
| erpnext | Accounts | Pegged Currencies | settings | 2 | 1 | 0 | 1 | System Manager | `erpnext/accounts/doctype/pegged_currencies/pegged_currencies.json` |
| erpnext | Accounts | Subscription Settings | settings | 3 | 3 | 0 | 0 | Accounts Manager, Accounts User, System Manager | `erpnext/accounts/doctype/subscription_settings/subscription_settings.json` |
| erpnext | Buying | Buying Settings | settings | 47 | 29 | 6 | 0 | Accounts Manager, Accounts User, Purchase Manager, Purchase User, Stock Manager, Stock User, System Manager | `erpnext/buying/doctype/buying_settings/buying_settings.json` |
| erpnext | CRM | Appointment Booking Settings | settings | 20 | 12 | 0 | 2 | HR Manager, Sales Manager, System Manager | `erpnext/crm/doctype/appointment_booking_settings/appointment_booking_settings.json` |
| erpnext | CRM | CRM Settings | settings | 19 | 10 | 0 | 1 | Sales Manager, Sales Master Manager, System Manager | `erpnext/crm/doctype/crm_settings/crm_settings.json` |
| erpnext | ERPNext Integrations | Plaid Settings | settings | 9 | 6 | 0 | 0 | System Manager | `erpnext/erpnext_integrations/doctype/plaid_settings/plaid_settings.json` |
| erpnext | Manufacturing | BOM Update Tool | tool | 6 | 2 | 0 | 0 | Manufacturing Manager | `erpnext/manufacturing/doctype/bom_update_tool/bom_update_tool.json` |
| erpnext | Manufacturing | Manufacturing Settings | settings | 35 | 20 | 2 | 0 | Manufacturing Manager | `erpnext/manufacturing/doctype/manufacturing_settings/manufacturing_settings.json` |
| erpnext | Projects | Projects Settings | settings | 5 | 4 | 0 | 0 | System Manager | `erpnext/projects/doctype/projects_settings/projects_settings.json` |
| erpnext | Selling | SMS Center | tool | 13 | 10 | 0 | 0 | System Manager | `erpnext/selling/doctype/sms_center/sms_center.json` |
| erpnext | Selling | Selling Settings | settings | 60 | 35 | 6 | 0 | Sales Manager, System Manager | `erpnext/selling/doctype/selling_settings/selling_settings.json` |
| erpnext | Setup | Authorization Control | tool | 0 | 0 | 0 | 0 | (none) | `erpnext/setup/doctype/authorization_control/authorization_control.json` |
| erpnext | Setup | Global Defaults | settings | 13 | 9 | 0 | 0 | System Manager | `erpnext/setup/doctype/global_defaults/global_defaults.json` |
| erpnext | Stock | Delivery Settings | settings | 6 | 4 | 0 | 0 | Delivery Manager | `erpnext/stock/doctype/delivery_settings/delivery_settings.json` |
| erpnext | Stock | Item Variant Settings | settings | 6 | 4 | 0 | 1 | Item Manager, System Manager | `erpnext/stock/doctype/item_variant_settings/item_variant_settings.json` |
| erpnext | Stock | Quick Stock Balance | tool | 12 | 8 | 0 | 0 | Stock Manager, Stock User, System Manager | `erpnext/stock/doctype/quick_stock_balance/quick_stock_balance.json` |
| erpnext | Stock | Stock Reposting Settings | settings | 17 | 11 | 0 | 0 | System Manager | `erpnext/stock/doctype/stock_reposting_settings/stock_reposting_settings.json` |
| erpnext | Stock | Stock Settings | settings | 80 | 49 | 8 | 0 | Sales User, Stock Manager | `erpnext/stock/doctype/stock_settings/stock_settings.json` |
| erpnext | Support | Support Settings | settings | 23 | 15 | 0 | 1 | System Manager | `erpnext/support/doctype/support_settings/support_settings.json` |
| erpnext | Utilities | Rename Tool | tool | 3 | 2 | 0 | 0 | System Manager | `erpnext/utilities/doctype/rename_tool/rename_tool.json` |
| erpnext | Utilities | Video Settings | settings | 3 | 3 | 0 | 0 | System Manager | `erpnext/utilities/doctype/video_settings/video_settings.json` |
| frappe | Automation | Automation Settings | settings | 17 | 11 | 0 | 0 | System Manager | `frappe/automation/doctype/automation_settings/automation_settings.json` |
| frappe | Core | Audit Trail | tool | 13 | 4 | 0 | 0 | System Manager | `frappe/core/doctype/audit_trail/audit_trail.json` |
| frappe | Core | Data Export | tool | 7 | 3 | 0 | 0 | System Manager | `frappe/core/doctype/data_export/data_export.json` |
| frappe | Core | Document Naming Settings | settings | 18 | 9 | 1 | 1 | System Manager | `frappe/core/doctype/document_naming_settings/document_naming_settings.json` |
| frappe | Core | Domain Settings | settings | 3 | 1 | 0 | 1 | System Manager | `frappe/core/doctype/domain_settings/domain_settings.json` |
| frappe | Core | Installed Applications | tool | 1 | 1 | 0 | 1 | System Manager | `frappe/core/doctype/installed_applications/installed_applications.json` |
| frappe | Core | Log Settings | settings | 1 | 1 | 0 | 1 | System Manager | `frappe/core/doctype/log_settings/log_settings.json` |
| frappe | Core | Navbar Settings | settings | 9 | 6 | 0 | 2 | System Manager | `frappe/core/doctype/navbar_settings/navbar_settings.json` |
| frappe | Core | Permission Inspector | tool | 9 | 5 | 0 | 0 | System Manager | `frappe/core/doctype/permission_inspector/permission_inspector.json` |
| frappe | Core | Role Permission for Page and Report | tool | 8 | 5 | 0 | 1 | System Manager | `frappe/core/doctype/role_permission_for_page_and_report/role_permission_for_page_and_report.json` |
| frappe | Core | SMS Settings | settings | 8 | 6 | 0 | 2 | System Manager | `frappe/core/doctype/sms_settings/sms_settings.json` |
| frappe | Core | Security Settings | settings | 6 | 5 | 0 | 2 | System Manager | `frappe/core/doctype/security_settings/security_settings.json` |
| frappe | Core | Session Default Settings | settings | 1 | 1 | 0 | 1 | System Manager | `frappe/core/doctype/session_default_settings/session_default_settings.json` |
| frappe | Core | System Settings | settings | 129 | 86 | 9 | 0 | System Manager | `frappe/core/doctype/system_settings/system_settings.json` |
| frappe | Custom | Customize Form | tool | 64 | 46 | 2 | 4 | System Manager | `frappe/custom/doctype/customize_form/customize_form.json` |
| frappe | Desk | Bulk Update | tool | 5 | 5 | 0 | 0 | System Manager | `frappe/desk/doctype/bulk_update/bulk_update.json` |
| frappe | Desk | Desktop Settings | settings | 2 | 2 | 0 | 0 | System Manager | `frappe/desk/doctype/desktop_settings/desktop_settings.json` |
| frappe | Desk | Global Search Settings | settings | 1 | 1 | 0 | 1 | Desk User, System Manager | `frappe/desk/doctype/global_search_settings/global_search_settings.json` |
| frappe | Desk | System Console | tool | 9 | 5 | 0 | 0 | Administrator | `frappe/desk/doctype/system_console/system_console.json` |
| frappe | Desk | System Health Report | tool | 63 | 34 | 1 | 5 | System Manager | `frappe/desk/doctype/system_health_report/system_health_report.json` |
| frappe | Flow | Flow Knowledge Settings | settings | 8 | 5 | 0 | 0 | System Manager | `frappe/flow/doctype/flow_knowledge_settings/flow_knowledge_settings.json` |
| frappe | Integrations | Geolocation Settings | settings | 4 | 4 | 0 | 0 | System Manager | `frappe/integrations/doctype/geolocation_settings/geolocation_settings.json` |
| frappe | Integrations | Google Settings | settings | 9 | 6 | 0 | 0 | System Manager | `frappe/integrations/doctype/google_settings/google_settings.json` |
| frappe | Integrations | LDAP Settings | settings | 43 | 28 | 0 | 1 | System Manager | `frappe/integrations/doctype/ldap_settings/ldap_settings.json` |
| frappe | Integrations | OAuth Provider Settings | settings | 1 | 1 | 0 | 0 | System Manager | `frappe/integrations/doctype/oauth_provider_settings/oauth_provider_settings.json` |
| frappe | Integrations | OAuth Settings | settings | 19 | 11 | 2 | 0 | System Manager | `frappe/integrations/doctype/oauth_settings/oauth_settings.json` |
| frappe | Integrations | Push Notification Settings | settings | 5 | 3 | 0 | 0 | System Manager | `frappe/integrations/doctype/push_notification_settings/push_notification_settings.json` |
| frappe | Printing | Print Settings | settings | 27 | 18 | 0 | 0 | System Manager | `frappe/printing/doctype/print_settings/print_settings.json` |
| frappe | Studio | Studio Settings | settings | 2 | 1 | 0 | 0 | System Manager | `frappe/studio/doctype/studio_settings/studio_settings.json` |
| frappe | Website | About Us Settings | settings | 11 | 9 | 0 | 2 | Website Manager | `frappe/website/doctype/about_us_settings/about_us_settings.json` |
| frappe | Website | Contact Us Settings | settings | 19 | 16 | 0 | 0 | Website Manager | `frappe/website/doctype/contact_us_settings/contact_us_settings.json` |
| frappe | Website | Portal Settings | settings | 7 | 5 | 0 | 2 | Website Manager | `frappe/website/doctype/portal_settings/portal_settings.json` |
| frappe | Website | Website Script | settings | 1 | 1 | 0 | 0 | Website Manager | `frappe/website/doctype/website_script/website_script.json` |
| frappe | Website | Website Settings | settings | 69 | 42 | 6 | 3 | All, Website Manager | `frappe/website/doctype/website_settings/website_settings.json` |
