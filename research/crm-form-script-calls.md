# CRM on desk v2: which v1 calls real CRM Form Scripts use

Research for frappe/frappe#45965, on map frappe/frappe#45963. This file states facts. It makes no rulings.

The catalog of v1 calls is the data formats findings for #45836, section "Form Script: v1 helper or handler to `page` verb" ([findings](https://github.com/shariquerik/frappe/blob/research/crm-data-formats/research/crm-data-formats.md)). This file uses the catalog's names for the calls.

Code read at these commits:

- `crm:` is `frappe/crm`, branch `desk-v2`, at `9009971464`.
- `crm@develop:` is `frappe/crm`, branch `develop`, at `55c61880e`.
- `frappe:` is `frappe/frappe`, branch `desk-v2`, at `56b30a3164`.

All sources are public. Searches ran on 2026-10-31.

## Answer

- I found **43 independent scripts by 17 authors**. 35 come from 11 public GitHub repositories. 8 come from 6 threads on discuss.frappe.io.
- Shapes: 22 legacy `setupForm`, 19 class-based, 1 `setupList`, 1 Unknown (a desk `frappe.ui.form.on` script).
- The calls in the most scripts: `call` (26 scripts, 9 authors), legacy `doc` (18, 10), header actions (17, 10), `toast.error` (13, 4), `toast.success` (11, 3).
- DOM access that is not a v1 call is the second most common item (21 scripts, 4 authors). The catalog has no row for it.
- Two **No counterpart** calls show up in more than one independent script: `toast.info` (7 scripts, 3 authors) and `createToast` (4 scripts, 3 authors). Both are gaps in `page.toast`, which has `success` and `error` only (`frappe:frontend/src/pageEngine/types.ts:112-115`).
- No script uses `this.statuses`, `onCreateLead`, `convertToDeal`, `socket`, `crm.makePhoneCall`, `getMeta`, `getField` or a `Button` field method. Only the CRM docs use `this.statuses`.

## How representative this is

The sample is small and skewed. Use it to rank the common calls. Do not use it to prove that a call is unused.

- Two authors wrote 23 of the 43 scripts: rtCamp 11, DHSPL-Tatvacare 12. The ranking table gives the author count next to the script count for this reason.
- A CRM Form Script is a row in a site database. GitHub shows only the scripts that an app ships as a fixture or writes from Python. The forum shows mostly drafts that do not work yet.
- GitHub code search indexes only default branches. The REST search returns at most 1,000 results for each query. The search is token-based, so phrase queries return much noise.
- 15 of the 43 scripts are retired or disabled in their source. 12 Tatvacare scripts moved into a CRM fork. 2 rtCamp fixtures are disabled. giabuh turns its script off on migrate.
- CRM reports counts of `CRM Form Script` rows from customer sites through `get_site_info` (`crm:crm/activation.py:3-33`). This research did not see that data.

## Method

1. Read the CRM docs on docs.frappe.io/crm: Custom Actions, Custom List Actions, Custom Statuses, Custom Script, ERPNext. Read the blog post [Class-Based Client Scripts for Frappe CRM](https://frappe.io/blog/engineering/class-based-client-scripts-for-frappe-crm) (22 May 2025).
2. Read the frappe/crm guide `.pi/feats/form-scripting/guide.md` on `develop`.
3. Ran about 60 GitHub code searches through the REST API. The queries included `"class CRMDeal {"`, `"class CRMLead {"`, `"function setupForm"`, `"function setupList"`, `"this.doc.trigger"`, `"this.setFieldProperty"`, `"this.actions.push"`, `"CRM Form Script"`, `filename:crm_form_script.json`, `"onCreateLead"`, `"convertToDeal"`, `"setFieldHtml"` and `"crm.makePhoneCall"`. Some queries ran once for each language (JSON, Python, JavaScript, Markdown).
4. Downloaded about 3,000 result files. Kept a file only if it holds a `class CRM...` with `this.doc`, a `setupForm({ doc ...` or `setupList({ list` signature, or the name `CRM Form Script`. Then read each kept file.
5. Searched discuss.frappe.io through its search API with 24 queries and read 35 threads.
6. Read the git history of the repositories where scripts were moved or removed (DHSPL-Tatvacare, giabuh).
7. Listed the calls of each script with a token scan (comments removed), then checked each hit by hand.
8. Confirmed that every cited repository is public.

## Scripts found

"Calls" lists each catalog call once for each script. Items that are not catalog rows are named in [Calls the catalog misses](#calls-the-catalog-misses).

| # | Script | Author | Doctype | Shape | Calls |
| --- | --- | --- | --- | --- | --- |
| 1 | [Create Project-Full and Msa from Won Deal](https://github.com/rtCamp/frappe-crm-xt/blob/7f22d59f3c3ac0ed8753bcc4ed7ea3e311972ca2/frappe_crm_xt/fixtures/crm_form_script.json) | rtCamp | CRM Deal | class | `onLoad`, field method, actions, action group, `call`, `toast.success`, `toast.error`, `toast.info`, `formDialog`, `__()`, `this.<method>()` |
| 2 | [CRM Deal Probability Validation](https://github.com/rtCamp/frappe-crm-xt/blob/7f22d59f3c3ac0ed8753bcc4ed7ea3e311972ca2/frappe_crm_xt/fixtures/crm_form_script.json) | rtCamp | CRM Deal | class | `onValidate`, field method, `this.value`, `this.oldValue`, `throwError` |
| 3 | [CRM Deal Addresses](https://github.com/rtCamp/frappe-crm-xt/blob/7f22d59f3c3ac0ed8753bcc4ed7ea3e311972ca2/frappe_crm_xt/fixtures/crm_form_script.json) | rtCamp | CRM Deal | class | `onRender` (`refresh`), `setFieldHtml`, `call`, `toast.success`, `toast.error`, `formDialog`, `__()`, `this.<method>()`, DOM access |
| 4 | [CRM Lead Addresses](https://github.com/rtCamp/frappe-crm-xt/blob/7f22d59f3c3ac0ed8753bcc4ed7ea3e311972ca2/frappe_crm_xt/fixtures/crm_form_script.json) (disabled, a copy of 3) | rtCamp | CRM Lead | class | as 3 |
| 5 | [CRM Lead Contacts](https://github.com/rtCamp/frappe-crm-xt/blob/7f22d59f3c3ac0ed8753bcc4ed7ea3e311972ca2/frappe_crm_xt/fixtures/crm_form_script.json) (disabled) | rtCamp | CRM Lead | class | `onRender` (`refresh`), `setFieldHtml`, `call`, `toast.success`, `toast.error`, `formDialog`, `__()`, `this.<method>()`, DOM access |
| 6 | [CRM Lead Linked Deals](https://github.com/rtCamp/frappe-crm-xt/blob/7f22d59f3c3ac0ed8753bcc4ed7ea3e311972ca2/frappe_crm_xt/fixtures/crm_form_script.json) | rtCamp | CRM Lead | `setupForm` | legacy `doc`, actions, action group, `call`, `toast.info`, `createDialog` (`$dialog`, `html`), `__()` |
| 7 | [Add Customer in Organization](https://github.com/rtCamp/frappe-crm-xt/blob/7f22d59f3c3ac0ed8753bcc4ed7ea3e311972ca2/frappe_crm_xt/fixtures/crm_form_script.json) | rtCamp | CRM Organization | `setupForm` | legacy `doc`, actions, `call`, `toast.success`, `toast.error`, `createDialog` (`$dialog`, `html`), DOM access |
| 8 | [FCRM Note Defaults](https://github.com/rtCamp/frappe-crm-xt/blob/7f22d59f3c3ac0ed8753bcc4ed7ea3e311972ca2/frappe_crm_xt/fixtures/crm_form_script.json) | rtCamp | FCRM Note | class | `onRender` |
| 9 | [CRM Task Calendar Participants](https://github.com/rtCamp/frappe-crm-xt/blob/7f22d59f3c3ac0ed8753bcc4ed7ea3e311972ca2/frappe_crm_xt/fixtures/crm_form_script.json) | rtCamp | CRM Task | class | `onRender`, `onValidate` (`validate`), field method, `setFieldProperty` (`link_filters`), `throwError`, `this.<method>()` |
| 10 | [Gmail Thread Linker — Lead](https://github.com/rtCamp/frappe-crm-xt/blob/7f22d59f3c3ac0ed8753bcc4ed7ea3e311972ca2/frappe_crm_xt/fixtures/crm_form_script.json) | rtCamp | CRM Lead | class | `onLoad`, actions, `this.doc.trigger`, `call`, `toast.success`, `toast.error`, `toast.info`, `createDialog` (`html`), DOM access |
| 11 | [Gmail Thread Linker — Deal](https://github.com/rtCamp/frappe-crm-xt/blob/7f22d59f3c3ac0ed8753bcc4ed7ea3e311972ca2/frappe_crm_xt/fixtures/crm_form_script.json) | rtCamp | CRM Deal | class | as 10 |
| 12 | [NDIS CRM Deal Actions](https://github.com/rapidlodge/Ndis-CRM/blob/1baa62dd15f7224db2f038534022a2de68eba6cc/ndis_crm/fixtures/crm_form_script.json) | rapidlodge | CRM Deal | `setupForm` | legacy `doc`, actions, `call`, `createToast` |
| 13 | [Generate Service Quote from CRM Deal](https://github.com/ivmiterpnext/Erpnext-InternalIVM/blob/25f7d301cc24cbe68771633cb558816c59494e4f/ivm/fixtures/crm_form_script.json) | ivmiterpnext | CRM Deal | class | `onLoad`, `onRender`, actions, `setFieldHtml`, `call`, `toast.error`, `__()`, `this.<method>()`, `this.doc.__newDocument` |
| 14 | [Merge CRM Lead Script](https://github.com/jsupa/frappe-setup/blob/b219a05e9e9f470864ae9033785676a61aabf7b5/scripts/sync_registeruz.py) | jsupa | CRM Lead | class | `onLoad`, actions, `call`, `toast.success`, `toast.error`, `toast.info`, `toast.warning`, `formDialog`, `router`, helpers on `this`, `this.<method>()` |
| 15 | [Sync RÚZ Organization Script](https://github.com/jsupa/frappe-setup/blob/b219a05e9e9f470864ae9033785676a61aabf7b5/scripts/sync_registeruz.py) | jsupa | CRM Organization | class | `onLoad`, actions, `call`, `toast.success`, `toast.error`, `toast.info`, `toast.warning`, helpers on `this`, `this.<method>()` |
| 16 | [QS Open Quote](https://github.com/abhijeet-shakya/quoteshop/blob/07e1fbe68e54d9c28720d6758f48700079d1ed4d/quoteshop/patches/v1_0/seed_desk.py) | abhijeet-shakya | CRM Deal | `setupForm` | legacy `doc`, actions, `__()` |
| 17 | [Delete Modal Fit](https://github.com/DHSPL-Tatvacare/frappe_tatva_connect/blob/6f4cbb617a6ed25f217a19242352dba29c4d21be/archive/lead-form-scripts-native/delete_modal_fit.js) (retired) | DHSPL-Tatvacare | CRM Lead | `setupForm` | DOM access only |
| 18 | [Email Attach](https://github.com/DHSPL-Tatvacare/frappe_tatva_connect/blob/6f4cbb617a6ed25f217a19242352dba29c4d21be/archive/lead-form-scripts-native/email_attach.js) (retired) | DHSPL-Tatvacare | CRM Lead | `setupForm` | legacy `doc`, `call`, `createToast`, `createDialog` (`$dialog`, `html`), DOM access |
| 19 | [Log Activity](https://github.com/DHSPL-Tatvacare/frappe_tatva_connect/blob/9e0fec0dfefedd0238be181ddcb59aa9a0b0e9c4/tatva_connect/lead/form_scripts/activity_log.js) (retired) | DHSPL-Tatvacare | CRM Lead | class | `onRender`, `call`, `toast.success`, `toast.error`, `createDialog` (`html`), `formDialog`, helpers on `this`, DOM access |
| 20 | [Data Tab Program Gate](https://github.com/DHSPL-Tatvacare/frappe_tatva_connect/blob/c33c4d28097fc0eefa7bc53af9e09ea1818d26bb/tatva_connect/lead/form_scripts/data_tab_gate.js) (retired) | DHSPL-Tatvacare | CRM Lead | `setupForm` | legacy `doc`, `call`, DOM access |
| 21 | [Hide Status Pill](https://github.com/DHSPL-Tatvacare/frappe_tatva_connect/blob/c33c4d28097fc0eefa7bc53af9e09ea1818d26bb/tatva_connect/lead/form_scripts/hide_status_pill.js) (retired) | DHSPL-Tatvacare | CRM Lead | `setupForm` | DOM access only |
| 22 | [Near Me](https://github.com/DHSPL-Tatvacare/frappe_tatva_connect/blob/b7fb7d0eb2a3fade736e27fa2e712e4c18a89659/tatva_connect/lead/form_scripts/near_me.js) (retired) | DHSPL-Tatvacare | CRM Lead | class | `onRender`, `call`, `toast.error`, `createDialog` (`html`), helpers on `this`, `this.<method>()`, DOM access |
| 23 | [Activity Complete](https://github.com/DHSPL-Tatvacare/frappe_tatva_connect/blob/b7fb7d0eb2a3fade736e27fa2e712e4c18a89659/tatva_connect/tasks/form_scripts/task_activity.js) (retired) | DHSPL-Tatvacare | CRM Task | class | `onBeforeCreate`, `onValidate`, `call`, `toast.success`, `toast.error`, `createDialog` (`html`), `formDialog`, helpers on `this` |
| 24 | [Task Modal Fit](https://github.com/DHSPL-Tatvacare/frappe_tatva_connect/blob/c33c4d28097fc0eefa7bc53af9e09ea1818d26bb/tatva_connect/tasks/form_scripts/task_modal_fit.js) (retired) | DHSPL-Tatvacare | CRM Task | `setupForm` | DOM access only |
| 25 | [WATI Failed Reason](https://github.com/DHSPL-Tatvacare/frappe_tatva_connect/blob/554415fa6409be472d2ae41872ee55461e98b097/tatva_connect/whatsapp/form_scripts/whatsapp_failed_reason.js) (retired) | DHSPL-Tatvacare | CRM Lead | `setupForm` | legacy `doc`, `call`, DOM access |
| 26 | [WATI WhatsApp Gate](https://github.com/DHSPL-Tatvacare/frappe_tatva_connect/blob/c33c4d28097fc0eefa7bc53af9e09ea1818d26bb/tatva_connect/whatsapp/form_scripts/whatsapp_gate.js) (retired) | DHSPL-Tatvacare | CRM Lead | `setupForm` | legacy `doc`, `call`, DOM access |
| 27 | [WATI Send Template](https://github.com/DHSPL-Tatvacare/frappe_tatva_connect/blob/a45a8dfe368a27f9c2826bd987818d3974e1c32c/tatva_connect/whatsapp/form_scripts/whatsapp_template.js) (retired) | DHSPL-Tatvacare | CRM Lead | `setupForm` | legacy `doc`, actions, `call`, `createToast`, `createDialog` (`$dialog`, `html`), DOM access |
| 28 | [WATI WhatsApp Window](https://github.com/DHSPL-Tatvacare/frappe_tatva_connect/blob/c33c4d28097fc0eefa7bc53af9e09ea1818d26bb/tatva_connect/whatsapp/form_scripts/whatsapp_window.js) (retired) | DHSPL-Tatvacare | CRM Lead | `setupForm` | legacy `doc`, `call`, DOM access |
| 29 | [classification from response](https://discuss.frappe.io/t/134972/3) | Deepika_S | not stated | `setupForm` | legacy `doc`, `updateField` |
| 30 | [Update Probability Value](https://discuss.frappe.io/t/140851/1) (an earlier draft is in [140805](https://discuss.frappe.io/t/140805/1)) | jevht | CRM Deal | `setupForm` | legacy `doc`, actions, `updateField` |
| 31 | [Update Probability Value, list](https://discuss.frappe.io/t/140851/1) | jevht | CRM Deal | `setupList` | list `actions`, `bulk_actions`, `call` |
| 32 | [redirect after save](https://discuss.frappe.io/t/150799/1) | Talita.Mangolin | CRM Deal | `setupForm` | legacy `doc`, `router`, a name v1 never calls (`afterSubmit`) |
| 33 | [hide Convert to Deal button](https://discuss.frappe.io/t/161202/6) | marc_centura | CRM Lead | `setupForm` | DOM access only |
| 34 | [status() test](https://discuss.frappe.io/t/147696/3) | felixlu07 | CRM Deal | class | field method |
| 35 | [follow-up child to parent](https://discuss.frappe.io/t/147696/8) | Kaajal-Chhattani | CRM Deal | class + child class | field method, child class method, `this.doc.trigger` |
| 36 | [deal value from items and probability](https://discuss.frappe.io/t/159731/1) | jevht | CRM Deal | class + child class | `onRender` (`refresh`), field method, child class method, `<table>_add`, `<table>_remove`, `getRow`, `this.doc.trigger`, `call`, `frappe.*`, a name v1 never calls (`after_load`) |
| 37 | [CRM Lead Visit Integration](https://github.com/promise4all/visit_management_old/blob/bd39c0f183b5142cc55d1b1566baa3aa60b0159c/visit_management/setup_crm_form_scripts.py) | promise4all | CRM Lead | `setupForm` | legacy `doc`, actions, `frappe.*`, DOM access, names v1 never reads (`sections`, `$h`) |
| 38 | [CRM Contacts Visit Integration](https://github.com/promise4all/visit_management_old/blob/bd39c0f183b5142cc55d1b1566baa3aa60b0159c/visit_management/setup_crm_form_scripts.py) | promise4all | CRM Contacts (not a CRM doctype) | `setupForm` | as 37 |
| 39 | [CRM Organization Visit Integration](https://github.com/promise4all/visit_management_old/blob/bd39c0f183b5142cc55d1b1566baa3aa60b0159c/visit_management/setup_crm_form_scripts.py) | promise4all | CRM Organization | `setupForm` | as 37 |
| 40 | [investigation case button](https://github.com/michelemilazzo/thanatos_intel/blob/9a0a5df4b2930e987b8a918b34b5843f485f086d/thanatos_intel/billing/crm_pipeline.py) | michelemilazzo | CRM Deal | `setupForm` | legacy `doc`, actions, `call`, `createToast` |
| 41 | [Project Details Script for \<doctype\>](https://github.com/alriwaq/crm/blob/8f383bda0865c2657bd14068397b691ae6bdf295/crm/fcrm/doctype/crm_projects/crm_projects.py) (adapted from the standard Product Details script) | alriwaq | CRM Deal, CRM Lead | class + child class | child class method, `<table>_add`, `<table>_remove`, `getRow`, `row.trigger`, `this.doc.trigger`, `call` |
| 42 | [DocuSign buttons](https://github.com/sabitsky/artbot-frappe_docusign/blob/d01c303d4d97286ade3b025905d8db454c274d78/frappe_docusign/public/js/crm_deal_docusign.js) | sabitsky | CRM Deal | Unknown (`frappe.ui.form.on`) | `frappe.*` |
| 43 | [Mở cuộc chat](https://github.com/giabuh/dx-osd/blob/c418c7962a6938e38fc9cbf6b7182f074dc035ea/frappe-custom/mmm_custom/mmm_custom/crm_links.py) (now disabled) | giabuh | CRM Lead | `setupForm` | legacy `doc`, actions, `call`, `toast.info` |

## Calls ranked by use

"Scripts" counts the independent scripts that use the call. "Authors" counts their distinct authors. The last column is the catalog's desk v2 entry. An item marked "not in catalog" is described in the next section.

| Rank | v1 call | Scripts | Authors | Desk v2 (catalog) |
| --- | --- | --- | --- | --- |
| 1 | `call(method, params)` | 26 | 9 | `page.call` |
| 2 | DOM access (`document.querySelector`, `MutationObserver`) | 21 | 4 | not in catalog. No counterpart |
| 3 | legacy `doc` | 18 | 10 | `page.doc` |
| 4 | header actions: `this.actions = [...]`, `this.actions.push`, legacy `return { actions }` | 17 | 10 | `page.header.add` |
| 5 | `toast.error` | 13 | 4 | `page.toast.error` |
| 6 | `toast.success` | 11 | 3 | `page.toast.success` |
| 7 | `onRender` (4 of 9 through the alias `refresh`) | 9 | 4 | `onRefresh` |
| 7 | `this.<method>()`, a direct call to the class's own method | 9 | 4 | not in catalog. A plain function in the module |
| 7 | `createDialog` (4 of 9 as legacy `$dialog`) | 9 | 2 | `page.dialog.confirm`, `danger`, `open(component)` |
| 7 | `createDialog` with an `html` body | 9 | 2 | not in catalog. `page.dialog.open(component)` |
| 11 | `__()` | 7 | 3 | `import { __ } from 'frappe/i18n'` |
| 11 | `formDialog` | 7 | 3 | `page.dialog.form` |
| 11 | `toast.info` | 7 | 3 | **No counterpart** |
| 14 | a method named like a field | 6 | 4 | a key named like the field |
| 15 | `onLoad` | 6 | 3 | `onOpen` |
| 16 | `this.doc.trigger` | 5 | 4 | none. Call a plain function in the module |
| 17 | `frappe.*` desk globals | 5 | 3 | not in catalog. Not a v1 call |
| 17 | a name CRM v1 never calls or reads | 5 | 3 | not in catalog. Not a v1 call |
| 19 | helpers on `this` (`this.call`, `this.toast`, `this.createDialog`, `this.formDialog`, `this.router`) | 5 | 2 | not in catalog. The same `page` verbs |
| 20 | `createToast` (legacy, the same function as `toast.create`) | 4 | 3 | **No counterpart** |
| 21 | `setFieldHtml` | 4 | 2 | `page.fields.update(field, { component, props })` |
| 22 | child class | 3 | 3 | `<table>: { ... }` under the parent's export |
| 22 | child class method | 3 | 3 | `<table>: { field(page, row) {} }` |
| 24 | `onValidate` (1 of 3 through the alias `validate`) | 3 | 2 | `beforeSave` |
| 25 | `getRow` | 2 | 2 | `page.rows(table)` |
| 25 | `router` | 2 | 2 | `page.router` |
| 25 | `<table>_add` | 2 | 2 | `<table>: { onAdd(page, row) {} }` |
| 25 | `<table>_remove` | 2 | 2 | `<table>: { onRemove(page) {} }` |
| 25 | legacy `updateField` | 2 | 2 | `page.doc.<field> = value`, then `page.save()` |
| 30 | action group (`group`, `hideLabel`) | 2 | 1 | `page.header.add({ display: 'dropdown' })`, then members with `group` |
| 30 | `throwError` | 2 | 1 | `throw new Error(message)` in `beforeSave` |
| 30 | `toast.warning` | 2 | 1 | not in catalog. No counterpart |
| 33 | `setupList` list `actions` and `bulk_actions` | 1 | 1 | none. G6, map 4 |
| 33 | `this.doc.__newDocument` | 1 | 1 | not in catalog. `page.isNew` |
| 33 | `onBeforeCreate` (on CRM Task, in its create modal) | 1 | 1 | none in the create dialog |
| 33 | `row.trigger` | 1 | 1 | `row.trigger` |
| 33 | `setFieldProperty` (`link_filters` on a parent field) | 1 | 1 | `page.fields.update(field, { link_filters })` |
| 33 | `this.oldValue` | 1 | 1 | none |
| 33 | `this.value` | 1 | 1 | `page.doc.<field>` |

No script uses these catalog rows: `onSave`, `onError`, `onCreateLead`, `convertToDeal`, `this.currentRowIdx`, a `Button` field method, `this.statuses`, `setFieldProperties`, `removeFieldProperty`, `getField`, `getMeta`, `socket`, `router.previousRoute`, `crm.makePhoneCall`, `crm.openSettings`, legacy `deleteDoc`, and `setFieldProperty` on a section, a tab, a child column or one row.

## No counterpart calls in more than one script

These are the candidates for a `Desk v2: ` single issue (map ruling 6).

| v1 call | Scripts | Authors | Scripts by number |
| --- | --- | --- | --- |
| `toast.info` | 7 | 3 | 1, 6, 10, 11, 14, 15, 43 |
| `createToast` (`toast.create`) | 4 | 3 | 12, 18, 27, 40 |

- Both calls fall in the same gap: `page.toast` has only `success` and `error` (`frappe:frontend/src/pageEngine/types.ts:112-115`).
- `toast.warning` (2 scripts, 1 author) is the same gap. The catalog does not list it.
- The scripts call `createToast` with an object: `{ title, icon, iconClasses }`. CRM v1 passes `createToast: toast.create` to the legacy shape (`crm:frontend/src/pages/Deal.vue:480`, `crm:frontend/src/pages/Lead.vue:372`).
- On CRM `develop`, the injected `toast` also accepts this object (`crm@develop:frontend/src/utils/scriptToast.js`).

Three other catalog rows say "none", but they are not candidates:

- `this.doc.trigger` (5 scripts, 4 authors) has a full workaround: call a plain function in the module. It needs no framework change.
- `this.oldValue` (1 script) and `onBeforeCreate` in the create dialog (1 script) show up in one script only.

## Calls the catalog misses

1. **A direct call to the class's own method, `this.<method>()`.** 9 scripts, 4 authors. CRM v1 runs each handler as a method of the class instance (`crm:frontend/src/data/document.js:386`), so `this.helper()` works. The CRM docs use it too: `this._updateActions()` on Custom Actions and `this._updateStatuses()` on Custom Statuses. The frappe/crm guide says direct calls "do not work" (`crm@develop:.pi/feats/form-scripting/guide.md:350`). The desk v2 rewrite is the same as for `this.doc.trigger`: a plain function in the module.
2. **Helpers read from `this`.** 5 scripts, 2 authors. CRM v1 copies every injected helper onto the class instance (`crm:frontend/src/data/script.js:192-194`). Scripts call `this.call`, `this.toast.error`, `this.createDialog`, `this.formDialog` and `this.router.push`. Two Tatvacare scripts pass `this` to a function and call `ctl.call`. A token scan that looks only for a bare `call(` misses these.
3. **`createDialog` with an `html` body.** 9 scripts, 2 authors. CRM v1 renders `dialog.html` with `v-html` (`crm:frontend/src/utils/dialogs.jsx:29`). `page.dialog.confirm` drops a key that it does not name (`frappe:frontend/src/narrowedDialog.ts:23-37`). The counterpart is `page.dialog.open(component)`, with a component that draws the body.
4. **`toast.warning`.** 2 scripts, 1 author. No counterpart.
5. **The legacy shape's own members.** CRM v1 passes `doc`, `$dialog`, `$socket`, `router`, `toast`, `updateField`, `createToast`, `deleteDoc` and `call` to `setupForm` (`crm:frontend/src/pages/Deal.vue:473-483`). It reads only `actions` and `statuses` from the returned object (`crm:frontend/src/utils/index.js:362-381`). The catalog lists only `updateField`, `deleteDoc` and `doc`. `$dialog` is in 4 scripts by 2 authors. The returned `actions` key is in 11 scripts.
6. **`this.doc.__newDocument`.** 1 script. The counterpart is `page.isNew`.
7. **DOM access.** 21 scripts, 4 authors. These scripts query CRM v1's markup and change it. They hide buttons and sections, add buttons to the header, and resize modals. 8 scripts do little else (17, 20, 21, 24, 25, 26, 28, 33). The rewrite cannot map these lines to a verb, because desk v2 draws different markup. A scan can flag `document.`, `querySelector` and `MutationObserver` lines as calls with no counterpart.
8. **Names that CRM v1 never calls or reads.** These scripts do nothing on CRM v1 now:
   - `frappe.*` desk globals: 5 scripts, 3 authors. CRM v1 has no `frappe` global. Forum threads [143351](https://discuss.frappe.io/t/143351) and [143931](https://discuss.frappe.io/t/143931) report `frappe is not defined`.
   - The handlers `afterSubmit` and `after_load`, a returned `sections` key, and a `$h` helper: 5 scripts, 3 authors.
9. **A desk script stored as a CRM Form Script.** 1 script (42) is a `frappe.ui.form.on` script. It matches no v1 shape. The report shows it as Unknown.
10. **On CRM `develop` only.** These exist on `develop` but not on `desk-v2`: `this.tabs` (`crm@develop:frontend/src/data/script.js:351-381`), the `h` helper (`:77`), and a `toast` that is also callable (`crm@develop:frontend/src/utils/scriptToast.js`). No found script uses them. The frappe/crm guide documents them.

## Not counted

- **CRM's standard scripts:** Product Details (CRM Lead and CRM Deal), Forecasting, and Create Quotation. Many copies of the frappe/crm app on GitHub hold them. This research did not count those copies.
- **A former standard script:** "Helpdesk CRM Settings" added a "Create customer in Helpdesk" action group. frappe/crm removed it in `a7f3c13a0`. Three app copies still hold it (Caxtiq/frappe-crm-f0rk, NailaFatima/Crm, PRSMTECH/crm).
- **Documentation examples:** the CRM docs pages Custom Actions, Custom Statuses and Custom List Actions, the blog post, the frappe/crm guide, and three third-party guides ([ptrmtb/frappe-ui-customization-patterns](https://github.com/ptrmtb/frappe-ui-customization-patterns/blob/d268c800f52e90180c97c1f0fd310aa4aaea56a1/pattern-01-crm-form-scripts/README.md), [lmnaslimited/lens-docs](https://github.com/lmnaslimited/lens-docs/blob/b9aa3aba81c8b4c10988a1a8f20f294ee9dcbea5/src/content/docs/04-developer-cheat-sheet/02-prism/04-script.md), [BoonLabs/ak_automation_frappe](https://github.com/BoonLabs/ak_automation_frappe/blob/185b295e2425ec28a4ecc784d08488bbe15c30a7/CLAUDE.md)). The CRM docs use `this.actions`, action groups with `buttonLabel` and `hideLabel`, `call`, `createDialog`, `formDialog`, `toast.success`, `toast.error`, `toast.info`, `router.push`, `throwError`, `this.statuses` and `this.<method>()`. They are the only public source for `this.statuses`.
- **Helpdesk scripts:** `HD Form Script` rows also use the `setupForm` shape. The scripts in access-hub, TicketBrain, frappe-fab-msp and forum thread 164439 are Helpdesk scripts.
- **Empty stubs:** 2 disabled scripts with an empty `onLoad` ([shivanandbanahatti/cost_estimate](https://github.com/shivanandbanahatti/cost_estimate/blob/256ce00fb482c324a5c80125a02c40b2ad1278b9/cost_estimate/estimation/setup/crm_form_script.py)).
- **A rewritten copy of a standard script:** promise4all's `fix_duplicate_script.py` writes a made-up "original" Product Details script.
- **Not read:** a Medium article by Kaajal Chhattani, "Frappe CRM Customization: What Works, What Doesn't, and Why". Medium returned HTTP 403. Frappe School has no Frappe CRM course. Its only CRM course covers ERPNext.
