# The list script API, checked against record-page scripting

Research for [#47053](https://github.com/frappe/frappe/issues/47053), a child of the map
[Desk v2 — bulk actions and list scripts](https://github.com/frappe/frappe/issues/47051).
The owner asked (2026-11-12): "check how record scripting is built for consistency and also
better API".

Facts are read from code at `upstream/desk-v2` `29eb229ba8`, CRM `e9c29fc27` and ERPNext as
installed on the bench. Nothing here was run in a browser. A claim that comes from code names
its file. A claim that comes from a ruling names its ticket.

Each API is judged by the script an author writes. Section 4 shows each example three ways:
desk v1, the proposal, and the same task on the record page today.

## 1. How record-page scripting is built

These are the facts the comparison needs. `frontend/SCRIPTING.md` has the rest.

- **One file shape in two tiers.** A record script is an ES module whose default export is an
  object of handlers. An app ships it as `<doctype>/frontend/record.js` (or
  `custom/<doctype>/record.js` for another app's doctype). A site writes the same text as a
  `Client Script` row with `view = Record`. File scripts run first, then Client Scripts, in
  `run_order` (`SCRIPTING.md:93-110`, `CONTEXT.md` "Tier").
- **`record.js` loads lazily.** It is fetched when the doctype's record page opens
  (`frontend/plugin/contributions.js:301`, commit `bfc43e550c`).
- **Handlers get `page`, and verbs record ops.** `onRefresh(page)` is a replay: every list is
  cleared to its built-ins and every source runs again, so a condition is a plain `if` with no
  `else` (`CONTEXT.md` "Replay"). Every other handler runs in a hold and paints once.
  `onOpen` runs once per visit.
- **Every place is a named list.** A list speaks `add`, `hide`, `show`, `update`, `move`,
  `has`, `order`, `clear`, and `before` / `after` names a neighbour
  (`pageEngine/types.ts:94-104`).
- **An item with `run` is an act.** `{ name, label, icon, run(page, value), right, when(page),
  key, palette, argument }` on `header`, `quickActions` and a tab's `create`. Its full name is
  `<list>.<item>` (`header.delete`), and `page.run(name, value)` runs it, or a shell act
  (`shell.crm.make_a_call`) (`SCRIPTING.md:290-312`, `recordPage/pageActs.ts:20-36`).
- **One engine.** `createPageEngine` (`pageEngine/createPageEngine.ts`) holds the verbs, the
  commit, the paint gate, held acts and dialogs. The base `page` has `doctype`, `meta`,
  `perms`, `roles`, `frame`, `header`, `body`, `refresh()`, `toast`, `dialog`, `call`, `cached`
  and `router` (`pageEngine/types.ts:139-157`). `run`, `open`, `create`, `reload` and `save`
  are record-page members, not base members.

## 2. Where the record page and the ruled list page differ

The list page as ruled is the sum of [#43267](https://github.com/frappe/frappe/issues/43267)
(seven lists and the list `page`), [#43268](https://github.com/frappe/frappe/issues/43268)
(`List Page` Client Scripts with `onRefresh` and `onOpen`),
[#46276](https://github.com/frappe/frappe/issues/46276) (act-based `rowActions`),
[#46431](https://github.com/frappe/frappe/issues/46431) (the `list` act context) and charter
ruling 8 on #47051 (`list.js` `bulkActions: [{ act, label?, icon?, when?(list) }]`, a Client
Script item with inline `run`).

| Aspect | Record page | List page, as ruled or built | Has a reason? |
|---|---|---|---|
| File script shape | A handler file: `onRefresh(page)` with verbs. | `list.js` is data: `columns`, `cells`, `rowActions`, and `bulkActions` by ruling 8 (`contributions/types.ts:48-54`). | Partly. See "Why `list.js` is data" below. |
| Client Script shape | The same text as the file script. | A handler file with verbs (#43268). So a list has two shapes, one per tier. | No. #43268 point 4 ruled that `list.js` "becomes an ordinary list handlers object". Ruling 8 and #46276 went the other way. The rulings disagree. |
| Item | The item is the act: `{ name, label, icon, run, ... }`. | `list.js`: the item points at an act, `{ act, label?, icon?, value?, when?, fields }`. Client Script: `{ name, label, icon, run }`. One `bulkActions` list holds both shapes. | Only the eager load (below). |
| Item address | `name`, chosen by the author. | A `list.js` row action is named `row_<act>` (`pages/list/rowActions.ts:44`). Two row actions that run one act with two values get one name. | No. |
| Callback arguments | `run(page, value)`, `when(page)`. Page first. | `value(row, list)`, `when(row, list)`: row first. A list act: `run(list, value)`. The target shell act: `run(shell, value)`. | No. They grew one ticket at a time. |
| Context object | `page`. | Two: the `list` context (`doctype`, `view`, `selection`, `row`, `reload`, #46431) and the ruled list `page` (#43267). | Yes, for a time: `list` came first as the smallest thing list acts needed ([#46420](https://github.com/frappe/frappe/issues/46420)). Once the list `page` exists, two objects for one page have no reason. |
| Arrangement | Verbs: a later script can hide, move or update any item by name. | `list.js` keys are concatenated. A second app cannot hide the first app's row action. For `cells`, the first app wins. | No. |
| Act names | `<list>.<item>`: `header.delete`, `quickActions.email`. | `list.<item>`: `list.create`, `list.delete`, `list.row_<act>`. | Yes. The dispatcher gives a surface name to the last scope that registers it, and a scope's release deletes it without giving it back (`acts/dispatcher.ts:109-116`). A record dialog over a list runs `createRecordPage` and registers `header` (`recordPage/createRecordPage.ts:428`). If list acts were `header.*`, they would go away when the dialog closes. Read from code, not run. |
| Data a script reads | `page.doc`, the whole document. | A row holds only the fields the list fetched, so an item names the `fields` it reads. | Yes. |
| `page.rows` | Child-table row handles. | The fetched rows. | Yes, ruled on #43267 with the collision noted. |
| Events | Eleven events plus field handlers. | `onRefresh` and `onOpen`. No per-row events. | Yes, #43268. |
| Translation | Labels are built in each replay, so `__('Close')` works as written. | `list.js` is evaluated once at import, so a label must be a getter (`get label() { return __('Close') }`), as in `acts.js`. | Follows from the data shape. |
| Load | Lazy, when the page opens. | Eager: every `list.js` of every app, and what it imports, is in the shell's entry (`plugin/contributions.js:301-305`). | None recorded. `bfc43e550c` made `record.js` lazy and says only "List scripts stay eager". Only the list page and Cards read list handlers (`list/useListView.ts:86`, `pages/cards/useCardsView.ts:60`). |

**Why `list.js` is data.** `list.js` ships in the shell's entry. Code in it costs every page.
So code went to `acts.js`, which loads at idle, and `list.js` points at it by name. That
reason holds only while `list.js` is eager. If `list.js` loads like `record.js`, when its
list opens, the reason goes away.

**What the act pointer costs.** A bulk action as ruling 8 writes it needs two files and a
shell act that only the list can use:

- The shell act must be `palette: false`, because it is useless away from the list.
- It does not get the selection. A shell act's `run` gets `(shell, value)`, so `list.js`
  must pass the selection and `reload` through `value`. Ruling 8's item lists no `value`.
  Mirroring `rowActions` implies one.
- `shell.dialog` has `open`, `confirm` and `danger`, but no `form` (`shell/dialog.ts:17-23`).
  User's "Add Roles" asks for roles in a form dialog. In an act it needs a Vue component, or
  a new `shell.dialog.form`.

## 3. Friction on the record page today

Each item has a count from real scripts. Section 5 says which to change.

1. **A field change does not replay.** An author who draws by a field's value must add a
   handler that only calls `page.refresh()`. frappe's two record scripts have six such
   handlers, and a seventh that ends with the call: `assignment_rule/frontend/record.js:16-17`
   and `email_account/frontend/record.js:35,45-48`. The replay runs on a load, after a save, on a
   return visit and on `page.refresh()` (`pages/Record.vue:765,821,1018`).
2. **`page.save()` throws, but `page.rename()` and `page.create()` resolve `null`.** An act
   that saves first must catch. CRM wrote `saveRecord(page)` (`crm/fcrm/frontend/saveRecord.js`)
   for this and uses it in six files.
3. **Argument order changes by surface.** `when(page)` on the record page. `when(row, list)`
   on a list row. `value(row, list)` on a list row. An author who learns one gets the other
   wrong.
4. **Three names for the first argument.** `run(page, value)`, `run(list, value)`,
   `run(shell, value)`. Only `shell` has a reason: a shell act outlives the page.
5. **Labels as getters** in data files: six `get label()` in CRM, one in frappe's `acts.js`.
   A handler file builds labels in the replay and needs none.
6. **Routes pushed by hand.** CRM still writes `page.router.push(routeFor(...))` in two places,
   where `page.open()` exists. This is a docs and port matter, not an API gap.

The v1 list scripts to port show what the list `page` must cover. frappe has 41 `*_list.js`
files: `onload` in 23, `add_fields` in 18, `get_indicator` in 15, `refresh` in 9,
`hide_name_column` in 7, `primary_action` in 7, bulk action items in 4, `button` in 4, header
menu items in 3, `filters` in 3, `formatters` in 2. ERPNext adds 28 `add_action_item` calls,
most of them `listview.call_for_selected_items(method, args)` (`base_list.js:634`), which
sends the checked names as `names`, freezes the page and refreshes the list.

## 4. The proposed list script API

### 4.1 One file shape

`list.js` becomes a handler file, the same shape as `record.js`. A `List Page` Client Script
is the same text. `custom/<doctype>/list.js` (charter ruling 9) is the same text too.
`list.js` loads when its doctype's list opens, beside the meta, as `record.js` does. This is
what #43268 point 4 ruled.

```js
// <app>/<module>/doctype/<doctype>/frontend/list.js
// or a Client Script with view = List Page and dt = <doctype>: the same text
export default {
  onRefresh(page) { /* verbs on page.columns, page.bulkActions, page.rowActions, page.header, ... */ },
  onOpen(page) { /* one-time moves, once per visit */ },
}
```

Data that every reader starts with goes in a declarative file, not a script. The record page
already does this: an app ships `frontend/layouts/<type>.json` for its Form Layout rows. The
list's equivalent is the plain List view's app tier. Today that is the `columns` key of
`list.js` (#42657 merges app default, then site row, then user row). The proposal moves it,
with `sort` and `filters`, to `frontend/views/list.json`, in the same shape as a view file's
`settings`. `list` is a view type's name, so no saved view can have that key
(`SCRIPTING.md:625`). A script that sets columns in `onRefresh` would instead override the
reader's own column choice on every replay.

### 4.2 The list `page`

The base members, as #43267 ruled, plus `run`, `open` and `create`. These three are sugar over
shell acts and do not depend on the page, so they move from the record page to the base.

| Member | What it is |
|---|---|
| `doctype`, `meta`, `perms`, `roles`, `toast`, `dialog`, `call`, `cached`, `router`, `refresh()` | As on the record page. |
| `run`, `open`, `create` | As on the record page, now on the base page. |
| `frame`, `header`, `body`, `controls`, `columns`, `bulkActions`, `rowActions` | The seven lists (#43267). |
| `rows`, `filters`, `sort`, `selection`, `reload()` | As #43267 ruled. |
| `view` | `{ key, type }`, kept so the `list` context's keys stay (`COMPATIBILITY.md:250-253`). |
| `callSelected(method, args)` | New. The one server path for a bulk action. See below. |

The `list` act context becomes this `page`. `list.create` and `list.delete` get `page` as
their first argument. `doctype`, `view`, `selection` and `reload` keep working. `row` moves to
the second argument.

**`page.callSelected(method, args)`** calls a whitelisted method with the selected names as
`names`, as v1's `call_for_selected_items` does. It does what charter rulings 4, 5 and 7 ask of
every bulk action, so a script cannot skip them:

- It checks the User `bulk_actions` gate and the cap.
- When the reader chose "all N matching", it sends the filter and the server finds the names,
  within the cap.
- Above the threshold, it runs as a background job with progress.
- It shows the result panel. A method that returns `{ done, failed }` gets a row per record
  and "Retry failed". Any other return shows as done.
- It reloads the rows and clears the selection.

The server bulk contract ticket fixes the endpoint and the `{ done, failed }` shape. A script
that needs only the names, with no server call, reads `page.selection`, which holds the names
of the selected rows on screen.

### 4.3 Items

An act item has the record page's shape on every list that holds acts:

```ts
{ name, label, icon, right, when(page, value), key, palette, argument, run(page, value) }
```

- A bulk action's `run(page)` gets no value.
- A row action's `run(page, row)` and `when(page, row)` get the row. A row action also names
  the `fields` it reads, as today. Its act name is `list.row_<name>`.
- To run an act from another app, call it: `run: (page, row) => page.run('shell.crm.make_a_call', row.phone)`.
  There is no `act` key. One way, on both pages.

A column item:

```ts
{ name, label, width, fields, component, badge, icons, icon, format, switch }
```

- `name` is a fieldname, or any name for a column that no field backs.
- `fields` are fetched with the rows, also while the column is hidden (#43268 point 2).
- `badge` takes a value-to-theme map, as `cells` does today, or a function
  `(row) => ({ label, theme, filters }) | null`. `filters` is optional: a click on the badge
  adds it to the list's filters, as v1's third `get_indicator` element does.
- `icons`, `icon`, `format` and `switch` are today's `cells` keys, now on the column item.
- `component` stays for anything a badge cannot draw.

### 4.4 The examples, side by side

#### Sales Order: "Close" and "Re-open" bulk actions

Desk v1 (`sales_order_list.js`):

```js
onload(listview) {
  const method = 'erpnext.selling.doctype.sales_order.sales_order.close_or_unclose_sales_orders'
  listview.page.add_action_item(__('Close'), () => listview.call_for_selected_items(method, { status: 'Closed' }))
  listview.page.add_action_item(__('Re-open'), () => listview.call_for_selected_items(method, { status: 'Submitted' }))
}
```

Proposed `sales_order/frontend/list.js`:

```js
import { __ } from 'frappe/i18n'

const CLOSE = 'erpnext.selling.doctype.sales_order.sales_order.close_or_unclose_sales_orders'

export default {
  onRefresh(page) {
    page.bulkActions.add([
      { name: 'close', label: __('Close'), icon: 'lucide-lock', run: (page) => page.callSelected(CLOSE, { status: 'Closed' }) },
      { name: 're_open', label: __('Re-open'), icon: 'lucide-lock-open', run: (page) => page.callSelected(CLOSE, { status: 'Submitted' }) },
    ])
  },
}
```

As ruled (charter ruling 8), the same action takes two files:

```js
// sales_order/frontend/list.js
export default {
  bulkActions: [{ act: 'shell.erpnext.close_sales_orders', value: (list) => ({ names: list.selection, reload: list.reload }) }],
}

// selling/frontend/acts.js
export default [{
  name: 'close_sales_orders',
  get label() { return __('Close') },
  palette: false,
  run: async (shell, { names, reload }) => {
    await shell.call(CLOSE, { names, status: 'Closed' })
    reload()
  },
}]
```

The same task on the record page today, on one Sales Order:

```js
export default {
  onRefresh(page) {
    if (page.doc.docstatus === 1 && page.doc.status !== 'Closed')
      page.header.add({
        name: 'close',
        label: __('Close'),
        run: async (page) => {
          await page.call(CLOSE, { names: [page.docname], status: 'Closed' })
          await page.reload()
        },
      })
  },
}
```

The proposal and the record page read the same: a verb on a named list, an item with `run`.

#### User: "Add Roles"

Desk v1 (`user_list.js`) builds a `frappe.ui.Dialog` with a Table MultiSelect of roles, then
calls `bulk_add_roles(users, roles)`, clears the selection and refreshes: about 40 lines for
two actions.

Proposed `user/frontend/list.js`:

```js
import { __ } from 'frappe/i18n'

const USER = 'frappe.core.doctype.user.user'

export default {
  onRefresh(page) {
    page.bulkActions.add([
      { name: 'add_roles', label: __('Add Roles'), icon: 'lucide-shield-plus', right: 'write', run: (page) => changeRoles(page, 'bulk_add_roles', __('Add Roles')) },
      { name: 'remove_roles', label: __('Remove Roles'), icon: 'lucide-shield-minus', right: 'write', run: (page) => changeRoles(page, 'bulk_remove_roles', __('Remove Roles')) },
    ])
  },
}

async function changeRoles(page, method, title) {
  const values = await page.dialog.form({
    title,
    fields: [{ fieldname: 'roles', fieldtype: 'Table MultiSelect', options: 'Has Role', label: __('Roles'), reqd: 1 }],
    submitLabel: title,
  })
  if (!values) return
  await page.callSelected(`${USER}.${method}`, { roles: values.roles.map((row) => row.role) })
}
```

`bulk_add_roles` takes `users`, and v1 still calls it so. The port adds a `names` parameter
beside `users`.

The same task on the record page today, on one User:

```js
page.header.add({
  name: 'add_roles',
  label: __('Add Roles'),
  right: 'write',
  run: async (page) => {
    const values = await page.dialog.form({ title: __('Add Roles'), fields: [/* the same field */] })
    if (!values) return
    await page.call(`${USER}.bulk_add_roles`, { users: [page.docname], roles: values.roles.map((row) => row.role) })
    await page.reload()
  },
})
```

As ruled, this action is an `acts.js` act, and it needs `shell.dialog.form`, which does not
exist.

#### An indicator column, with `add_fields`

Desk v1 (`sales_order_list.js`): `add_fields` names 11 fields, and `get_indicator(doc)`
returns `[label, color, filter]` from them.

Proposed, in the same `list.js`:

```js
export default {
  onRefresh(page) {
    page.columns.add(
      {
        name: 'indicator',
        label: __('Status'),
        fields: ['status', 'advance_payment_status', 'per_delivered', 'per_billed', 'delivery_date', 'grand_total', 'skip_delivery_note'],
        badge: indicator,
      },
      { after: 'name' },
    )
  },
}

function indicator(row) {
  if (row.status === 'Closed') return { label: __('Closed'), theme: 'green', filters: [['status', '=', 'Closed']] }
  if (row.status === 'On Hold') return { label: __('On Hold'), theme: 'orange', filters: [['status', '=', 'On Hold']] }
  // ... the other branches of v1's get_indicator, one line each
  return null
}
```

`add_fields` has no page-level key. Each field belongs to the item that reads it: a column's
`fields`, a row action's `fields`. A bulk action reads no row fields: it gets names, and the
server reads the records.

The record page today has no short form for a computed badge. A script adds a header
`component` with a template. Desk v2 already themes a plain `status` column from the
doctype's states (`statusTheme.ts:62`), so a `badge` function is needed only where the label
is computed, as Sales Order's "Overdue" is.

#### Default filters

Desk v1 (`user_list.js`): `filters: [['enabled', '=', 1]]`. It applies when the reader has
saved no filters of their own.

Proposed `user/frontend/views/list.json`, the plain List view's app tier:

```json
{
 "settings": {
  "filters": [["enabled", "=", 1]]
 }
}
```

The site's and the reader's own settings come over it, as for columns. This needs the List
type to apply `filters` from settings, which it does not do yet (`SCRIPTING.md:619`).

#43268 ruled `page.filters` set in `onOpen`. `onOpen` runs on every visit, so it would put the
filter back after the reader removes it. `page.filters` in `onOpen` stays right for a
condition, such as a filter from the URL.

The same task on the record page today: a field's default lives in the DocType, and a script
sets a value in `onOpen` only under a condition (`if (page.isNew) page.doc.priority = 'High'`).
The split is the same: data in a record, conditions in a script.

#### A row action: CRM "Make a call"

Today (`crm/fcrm/frontend/telephony/callRowAction.js`, in two `list.js` files):

```js
export const callRowAction = {
  act: 'shell.crm.make_a_call',
  fields: ['mobile_no', 'phone'],
  value: (row) => row.mobile_no || row.phone,
  when: (row) => Boolean(row.mobile_no || row.phone),
}
```

Proposed:

```js
export function addCallRowAction(page) {
  page.rowActions.add({
    name: 'make_a_call',
    label: __('Make a call'),
    icon: 'lucide-phone',
    fields: ['mobile_no', 'phone'],
    when: (page, row) => Boolean(row.mobile_no || row.phone),
    run: (page, row) => page.run('shell.crm.make_a_call', row.mobile_no || row.phone),
  })
}

// crm_lead/frontend/list.js and crm_deal/frontend/list.js
export default { onRefresh: addCallRowAction }
```

This is two keys longer than today, because the item names its own label and icon. In
exchange, the row action has the record page's shape, a second app can hide it by name
(`page.rowActions.hide('make_a_call')`), and two row actions can run one act.

The same task on the record page today, a quick action on one Lead:

```js
page.quickActions.add({
  name: 'make_a_call',
  label: __('Make a call'),
  icon: 'lucide-phone',
  run: (page) => page.run('shell.crm.make_a_call', page.doc.mobile_no || page.doc.phone),
})
```

#### A Client Script that adds a bulk action

A site's script on ToDo. The method is an API Server Script.

```js
// Client Script: view = List Page, dt = ToDo
export default {
  onRefresh(page) {
    page.bulkActions.add({
      name: 'close',
      label: 'Close',
      icon: 'lucide-check',
      right: 'write',
      run: (page) => page.callSelected('close_todos'),
    })
  },
}
```

The same site's script on one ToDo:

```js
// Client Script: view = Record, dt = ToDo
export default {
  onRefresh(page) {
    page.header.add({
      name: 'close',
      label: 'Close',
      right: 'write',
      run: async (page) => {
        await page.call('close_todos', { names: [page.docname] })
        await page.reload()
      },
    })
  },
}
```

The text is the same as an app's `list.js`. As ruled, the Client Script would be the only
place where a bulk action is written this way, and `list.js` would use another shape.

### 4.5 The v1 keys, for the port

| v1 | Proposed |
|---|---|
| `onload(listview)` | `onRefresh(page)` for items, `onOpen(page)` for one-time moves. |
| `add_action_item`, `add_actions_menu_item` | `page.bulkActions.add`. |
| `call_for_selected_items(method, args)` | `page.callSelected(method, args)`. |
| `get_checked_items(true)` | `page.selection`. |
| `listview.refresh()` | `page.reload()`. |
| `get_indicator` | A column item with `badge(row)`. |
| `add_fields` | `fields` on the column or row action that reads them. |
| `filters`, default columns and sort | `frontend/views/list.json`. |
| `hide_name_column` | `page.columns.hide('name')`. |
| `button` | `page.rowActions.add`. |
| `page.add_menu_item` | `page.header.add`: an entry in the header's `⋯`. |
| `primary_action` | `page.header.update('new', { run })`. |
| `formatters` | A column item's `badge`, `icons`, `format` or `component`. |
| `refresh(listview)` | A component that reads `page.rows`. Row loads do not replay (#43268 point 3). |

## 5. What changes on the record page

The record page already has the shape the list takes. Four changes make the two read the same
and remove the friction in section 3:

1. **The base page gets `run`, `open` and `create`.** They are shell-act sugar, so both pages
   need them.
2. **Page first, value second, on every surface.** `when(page, value)` on every act item. The
   record page already does this. The list row action changes.
3. **A field commit replays.** After a field handler's hold, the page runs `onRefresh` once,
   in the same commit. The six `(page) => page.refresh()` handlers in frappe go away. A
   replay is a full pass over every source, so the build measures it on a large document
   (Sales Invoice with 100 rows) before it lands.
4. **`page.save()` resolves `true` or `false`.** It shows the reason itself, as
   `page.rename()` does before it resolves `null`. `if (!(await page.save())) return` replaces
   CRM's `saveRecord` wrapper. `beforeSave` still vetoes by throwing. Only the caller of
   `page.save()` changes.

## Open decisions for the grilling

1. **`list.js` is a handler file.** It exports `{ onRefresh, onOpen }` and uses verbs on
   `page`. It is the same text as a `List Page` Client Script and as `custom/<doctype>/list.js`.
   It loads when its list opens, beside the meta.
   - Options: (a) a handler file, lazy. (b) Keep data keys as charter ruling 8 and #46276 say,
     eager, with a shell act in `acts.js` for each bulk action, and add `shell.dialog.form`.
     (c) Both: data keys and handlers in one file.
   - Recommendation: (a). It reopens the `bulkActions` key of charter ruling 8 and the
     `rowActions` key shape of #46276, not their acts. It is what #43268 point 4 already ruled.
     The five `list.js` files that exist (one in frappe, four in CRM) are ported in the build.
     Cost: one lazy chunk request on a list's cold load, only for a doctype that has a
     `list.js`, fetched in parallel with the meta.

2. **The plain List view's app defaults go to `frontend/views/list.json`.** The file holds
   `columns`, `sort` and `filters`, in the shape of a view file's `settings`. It replaces the
   `columns` key of `list.js` and v1's `filters`.
   - Options: (a) the JSON file. (b) A `columns` / `filters` data key kept in the handler file.
     (c) Verbs in `onRefresh` and `page.filters` in `onOpen`.
   - Recommendation: (a). It is the record page's `layouts/<type>.json` split: data in a
     record, conditions in a script. (c) overrides the reader's own columns and filters on
     every visit. The List type must first apply `filters` from settings.

3. **One act item shape on both pages.** `{ name, label, icon, right, when, key, palette,
   argument, run(page, value) }` on `bulkActions` and `rowActions`, plus `fields` on a row
   action. No `act` key. A row action that runs another app's act calls `page.run`.
   - Options: (a) one shape, no `act` key. (b) Add an optional `act` key on every act item of
     both pages, as sugar for `run: (page, value) => page.run(act, value)`.
   - Recommendation: (a). One way to write an item. (b) saves two keys on a pure delegation
     and is a second way.

4. **Page first, value second, and the `list` context becomes the list `page`.** `run(page,
   row)` and `when(page, row)` on a row action. `list.create` and `list.delete` get `page`,
   which keeps `doctype`, `view`, `selection` and `reload`. The base page gains `run`, `open`
   and `create`.
   - Options: (a) yes. (b) Keep `list` as a separate context beside `page`.
   - Recommendation: (a). It changes a `COMPATIBILITY.md` promise (`row` moves to the second
     argument). That is cheap before desk v2 merges to `develop`, and the document changes in
     the same build.

5. **`page.callSelected(method, args)` is the one server path for a script's bulk action.** It
   sends `names`, or the filter for "all N matching". It applies the gate and the cap, runs in
   the background above the threshold, and shows progress and the result panel. Then it
   reloads and clears the selection.
   - Options: (a) one helper. (b) A `method` key on a bulk action item in place of `run`.
     (c) No helper: scripts call `page.call` with `page.selection`.
   - Recommendation: (a). (c) skips charter rulings 4, 5 and 7(a)-(b) for every script's action.
     (b) cannot ask for input first, as "Add Roles" does.

6. **A column item takes the cell keys, and `badge` takes a map or a function.** `badge`,
   `icons`, `icon`, `format` and `switch` move from `cells` onto the column item, reached with
   `page.columns.add` or `update`. `badge(row)` returns `{ label, theme, filters }` or `null`.
   - Options: (a) yes. (b) Only a `component`, as #43268 point 2 ruled for `get_indicator`.
   - Recommendation: (a). 15 frappe and 65 ERPNext list scripts use `get_indicator`. A function
     is one line per branch. A component is a template per doctype. `component` stays for the
     rest.

7. **List-page acts keep the `list.` prefix.** Bulk and header acts are `list.<name>`, row acts
   `list.row_<name>`.
   - Options: (a) keep `list.`. (b) Name them by their list, as the record page does:
     `bulkActions.close`, `rowActions.make_a_call`, `header.new`.
   - Recommendation: (a). A record dialog over a list registers `header` and takes the name
     from the list, and on close nothing gives it back (`acts/dispatcher.ts:109-116`). The cost:
     a bulk action and a header item cannot share a name.

8. **A field commit replays the record page.** `onRefresh` runs once after a field handler's
   hold, in the same commit.
   - Options: (a) yes, measured on a 100-row Sales Invoice first. (b) No: keep
     `page.refresh()` in the field handler.
   - Recommendation: (a). Six of frappe's record handlers exist only to call `page.refresh()`.

9. **`page.save()` resolves `true` or `false`.** It shows the reason before it resolves
   `false`, as `page.rename()` does.
   - Options: (a) yes. (b) Keep the throw.
   - Recommendation: (a). It matches `page.rename()` and `page.create()`, and CRM's
     `saveRecord` wrapper goes away.

## Sources

- Rulings: [#43265](https://github.com/frappe/frappe/issues/43265),
  [#43267](https://github.com/frappe/frappe/issues/43267),
  [#43268](https://github.com/frappe/frappe/issues/43268),
  [#46276](https://github.com/frappe/frappe/issues/46276),
  [#46417](https://github.com/frappe/frappe/issues/46417),
  [#46431](https://github.com/frappe/frappe/issues/46431), the charter rulings on
  [#47051](https://github.com/frappe/frappe/issues/47051), and the shell API research
  [`research/shell-api-surfaces.md`](https://github.com/shariquerik/frappe/blob/6b69e94dd2320b7a140713e444eea1beec9154f3/research/shell-api-surfaces.md).
- Docs: `frontend/SCRIPTING.md` (`:93-110` handlers, `:290-360` acts, `:382-450` list acts,
  `:585-640` view files), `frontend/CONTEXT.md` (Kind, Replay, Hold, Act, Saved view, Plain
  view), `frontend/COMPATIBILITY.md:250-253`.
- Code: `frontend/src/contributions/types.ts:11-54`, `contributions/registry.ts:29,159`,
  `plugin/contributions.js:301-335`, `pages/list/listActs.ts`, `pages/list/rowActions.ts`,
  `pages/list/ListView.vue:236-260`, `list/defaults.ts`, `acts/dispatcher.ts:109-116`,
  `recordPage/pageActs.ts`, `recordPage/createRecordPage.ts:428`,
  `pageEngine/createPageEngine.ts`, `pageEngine/types.ts`, `shell/dialog.ts:17-23`,
  `shell/shellActs.ts:28-51`, `statusTheme.ts:62`, `pages/Record.vue:1013-1019`,
  `frappe/custom/doctype/client_script/client_script.py:16,202`.
- Scripts: frappe `automation_flow/frontend/list.js`, `assignment_rule/frontend/record.js`,
  `email_account/frontend/record.js`, `automation/frontend/acts.js`; CRM `crm_lead` and
  `crm_deal` `list.js` and `record.js`, `frontend/telephony/callRowAction.js`,
  `frontend/saveRecord.js`, `frontend/acts.js`.
- v1: frappe `user_list.js`, `deleted_document_list.js`, `base_list.js:634`, the 41
  `*_list.js` files; ERPNext `sales_order_list.js`, `issue_list.js`.
