# A survey of act shapes, and the acts desk v2 already names

Research for [Research: a survey of act shapes, and the acts desk v2 already names](https://github.com/frappe/frappe/issues/45258),
on the map [Desk v2 — the command palette: acts, places and records from one key](https://github.com/frappe/frappe/issues/45257).
It feeds the act-model grilling. It makes no recommendation.

An **act** is something the desk does when asked by name: by the palette, a script, a key
or an LLM. A **row** is one line in the palette. Both words come from the map's Notes.

## Sources

| Source | Version read |
| --- | --- |
| `frappe` (desk v2 code, desk v1 code, `frappe/desk/search.py`) | `desk-v2` at `c3eb3c40e7`. `upstream/desk-v2` is at `78da6b2663`; its one extra commit changes no file under `frontend/` |
| `gameplan` (`frontend/src/components/CommandPalette/`) | `develop` at `c643ae8f73` |
| `frappe-ui` (`experimental/CommandPalette/`, `src/composables/useKeyboardShortcut.ts`) | `1.0.2`, the copy in `frappe/frontend/node_modules` |
| `crm` (for the "Convert to Deal" example) | `desk-v2` at `70d47a2973` |
| VS Code | [Commands guide](https://code.visualstudio.com/api/extension-guides/command), [contribution points](https://code.visualstudio.com/api/references/contribution-points), [when clauses](https://code.visualstudio.com/api/references/when-clause-contexts), [keybindings](https://code.visualstudio.com/docs/configure/keybindings), [workspace trust](https://code.visualstudio.com/api/extension-guides/workspace-trust), [language model tools](https://code.visualstudio.com/api/extension-guides/ai/tools), [command line](https://code.visualstudio.com/docs/configure/command-line) |
| Raycast | [Manifest](https://developers.raycast.com/information/manifest), [Actions](https://developers.raycast.com/api-reference/user-interface/actions), [Keyboard](https://developers.raycast.com/api-reference/keyboard), [Command API](https://developers.raycast.com/api-reference/command), [Deeplinks](https://developers.raycast.com/information/lifecycle/deeplinks), [AI extensions](https://developers.raycast.com/ai/learn-core-concepts-of-ai-extensions), [hotkeys manual](https://manual.raycast.com/command-aliases-and-hotkeys) |
| Linear | [Developers](https://linear.app/developers), [Select issues](https://linear.app/docs/select-issues), [Assigning issues](https://linear.app/docs/assigning-issues), [MCP](https://linear.app/docs/mcp) |
| Obsidian | [`obsidian.d.ts`](https://github.com/obsidianmd/obsidian-api/blob/master/obsidian.d.ts), [Commands](https://docs.obsidian.md/Plugins/User+interface/Commands), [Plugin guidelines](https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines), [Plugin security](https://obsidian.md/help/plugin-security), [CLI](https://obsidian.md/help/cli), [Obsidian URI](https://obsidian.md/help/Extending+Obsidian/Obsidian+URI) |

## 1. Prior art

Each table answers the same eight questions. "Server" means the server checks the right
when the act's request reaches it; that is true of every Frappe system here.

### VS Code

| Question | Answer |
| --- | --- |
| What an act is | A **command**. In the manifest, `contributes.commands[]` has `command` (the id), `title`, `category`, `icon` and `enablement`. At runtime `commands.registerCommand(id, handler)` binds the id to a function. The manifest entry and the handler are two declarations. |
| Name | A dotted id by convention (`myExt.sayHello`). The palette shows `category: title`. |
| Available in a context | A `when` clause on each menu entry, `menus.commandPalette` included, hides it. `enablement` disables the command in every menu and key. An extension sets its own context keys with `executeCommand('setContext', key, value)`. |
| Argument | `executeCommand(id, ...args)` passes positional arguments; a keybinding's `args` arrives as one argument; a menu passes its context (for example a file URI). The palette passes none. A handler that needs a value asks for it with `window.showQuickPick` or `showInputBox`. |
| Key | `contributes.keybindings[]`: `command`, `key`, `mac`, `when`, and `args` in the user's `keybindings.json`. A `-command` rule removes a binding. |
| Plugin adds one | Declare it in `contributes.commands`, then `registerCommand` on activation. |
| Permission | No check per command. Trust is per workspace (`capabilities.untrustedWorkspaces`, Restricted Mode). The docs say a command can still be called when no menu shows it, so the handler checks for itself. |
| Described to a machine | Commands have no machine description. No CLI flag or URL that runs a command is documented. LLM tools are a separate declaration: `contributes.languageModelTools` (`name`, `modelDescription`, `inputSchema` as JSON Schema, `when`), and VS Code asks the user to confirm before an extension tool runs. |

### Raycast

| Question | Answer |
| --- | --- |
| What an act is | Two kinds. A root **command** in `package.json` `commands[]`: `name`, `title`, `subtitle`, `description`, `icon`, `mode` (`view`, `no-view`, `menu-bar`), `keywords`, `arguments`, `preferences`. Inside a view, an **`Action`** in an `ActionPanel`: `title`, `icon`, `shortcut`, `onAction`, `style`. |
| Name | `name` is a unique id that maps to `src/<name>.tsx`. The full address is owner, extension and command name. `title` is the display name. |
| Available in a context | A root command is always listed when enabled; there is no `when`. A view's `Action`s are available while that view is on screen. |
| Argument | Manifest `arguments[]` (`name`, `type` text, password or dropdown, `placeholder`, `required`), typed inline in root search. Also `launchCommand({ arguments, context })` and deeplink query parameters. |
| Key | An `Action` has `shortcut={{ modifiers, key }}`. A global hotkey for a root command is set by the user only; the manifest has no hotkey field. |
| Plugin adds one | A `commands` entry plus its `src/<name>.tsx` file. |
| Permission | The user confirms a command that a deeplink launches, and `launchCommand` into another extension shows an alert. An AI tool can export a `confirmation` function. |
| Described to a machine | Deeplinks: `raycast://extensions/<owner>/<ext>/<cmd>?arguments=<json>`. AI tools are declared in `tools[]` with a typed `Input` whose JSDoc the model reads. |

### Linear

Linear has **no public command API**. Its developer docs list GraphQL, the SDK, webhooks,
OAuth, agents and an MCP server; none adds a row to Cmd+K.

| Question | Answer |
| --- | --- |
| What an act is | Not documented. |
| Name | Not documented. A person types words such as "Assign to" or "Share issue". |
| Available in a context | The selection: "Once an issue or set of issues are selected, use Cmd/Ctrl K to open the command bar and select the preferred action." In Settings, Cmd+K moves between settings pages. |
| Argument | Not documented. "Assign to" seems to open a second picker; this is an inference, not a documented fact. |
| Key | Fixed single keys and sequences (`I` assigns to me, `O` then `S` opens Settings). `?` lists them. No documented rebinding. |
| Plugin adds one | Not possible. |
| Permission | Not documented for the menu. The API uses OAuth scopes; MCP has a read-only scope. |
| Described to a machine | The MCP server describes data operations (find, create, update issues), not palette acts. |

### Obsidian

| Question | Answer |
| --- | --- |
| What an act is | A `Command`: `id`, `name`, `icon?`, `mobileOnly?`, `repeatable?`, `hotkeys?`, and one of `callback`, `checkCallback(checking)`, `editorCallback(editor, ctx)`, `editorCheckCallback(checking, editor, ctx)`. One declaration holds the name, the key and the code. |
| Name | `addCommand` prefixes the id and name with the plugin's: the id becomes `<plugin-id>:<id>`, the palette shows "Plugin name: Name". |
| Available in a context | `checkCallback` runs with `checking = true` first; `true` means available. Editor callbacks show only while an editor is active. |
| Argument | None. The plugin opens a `SuggestModal` or `FuzzySuggestModal` as a second step. |
| Key | `hotkeys: [{ modifiers: ['Mod', 'Shift'], key: 'L' }]`. The guidelines advise against default hotkeys; the user's own hotkeys win. |
| Plugin adds one | `this.addCommand({...})` in `Plugin.onload`. |
| Permission | None per command and no sandbox. Restricted Mode blocks all third-party code until the user turns it off. |
| Described to a machine | The CLI lists and runs commands by id (`obsidian commands`, `obsidian command id=<id>`). No built-in `obsidian://` action runs a command. `app.commands.executeCommandById` is not in `obsidian.d.ts`, so it is not public API. |

### Gameplan (`frontend/src/components/CommandPalette/`)

| Question | Answer |
| --- | --- |
| What an act is | A `CommandPaletteItem` (`registry.ts:5`): `title`, `name`, `search`, `aliases`, `subtitle`, `suffix`, `doctype`, `route`, `isActive`, `group`, `cluster`, `type`, `icon`, `onClick`, `condition`, `disabled`, `defaultScore`, `scoreScale`, `modified`, `hideCommunity`. An item runs `route` or `onClick` (`CommandPalette.vue:623`). |
| Name | `name` is a free string the caller makes up (`page-save`, `discussion-<slugged title>`). `group` is the heading; an item with no group goes under "Actions". |
| Available in a context | A component calls `useCommandPaletteCommands(items)` (`registry.ts:68`). The items live in a module-level map under a fresh `Symbol` and leave on `onBeforeUnmount`. So an item is available while its component is mounted. `condition()` filters again when the palette builds its groups. |
| Argument | None. An `onClick` may open a dialog. |
| Key | One key: Ctrl/Cmd+K opens the palette, through a raw `keydown` listener (`CommandPalette.vue:681`). No per-item key. `Page.vue` binds Mod+S by hand, apart from its palette item. |
| Plugin adds one | No plugin model. Callers are Gameplan's own components (`Page.vue`, `DiscussionView.vue`, `TaskDetail.vue`, `SpaceOptions.vue`, `CommunityDropdown.vue`). |
| Permission | `condition` callbacks (for example `canDeleteContent`), then the server. |
| Described to a machine | None. |

`DiscussionView.vue:1003` maps the same `actions` list that draws the discussion's dropdown
into palette items. That is one declaration feeding two surfaces, done by the caller.

### Desk v1: `frappe.ui.keys` and the awesomebar

| Question | Answer |
| --- | --- |
| What an act is | Three unrelated things. A **shortcut**: `add_shortcut({ shortcut, action, description, page, target, condition, ignore_inputs })` (`ui/keyboard.js:32`). A **menu item or button**: `page.add_menu_item(label, click, standard, shortcut)`, `add_inner_button`, `add_action_item`, `frm.add_custom_button` (`ui/page.js`). An **awesomebar option**: `{ type, value, label, route, onclick, index, description, route_options }`. |
| Name | A shortcut is named by its combo (`"ctrl+s"`); `description` labels it in the shortcuts dialog. Menu items and buttons are named by their label. An option is named by its label. |
| Available in a context | A shortcut with `page` runs only while that page's wrapper is visible, and only if `condition()` is true. The awesomebar builds options from fixed sources on each keystroke (`awesome_bar.js:306`): search in list, doctypes, doctype layouts, reports, pages, workspaces, dashboards, recent pages, executables, then the calculator and global search. Form menu items and buttons are **not** awesomebar options. |
| Argument | None. The awesomebar's "specifics" read a trailing word as a type filter (`awesome_bar.js:289`), not as an argument. |
| Key | `add_shortcut`. `add_menu_item(..., shortcut)` binds the key and shows it on the row (`ui/page.js:553`). `alt_keyboard_shortcuts.js` gives buttons and menu rows Alt+letter keys. Standard keys: Ctrl+S primary action, Ctrl+K awesomebar, Ctrl+G global search, Shift+/ the shortcuts dialog. |
| Plugin adds one | In JS: `frappe.ui.keys.add_shortcut` and `frappe.search.utils.make_function_searchable(fn, label, args)` (`search_utils.js:711`), a global list used twice in the framework ("Generate Tracking URL", "Background Jobs", `ui/page.js:82`). On the server: the `awesomebar_search` hook (`frappe/desk/search.py:653`); each method gets `txt` and returns up to 20 rows of `label`, `description`, `route`, `index`, `route_options`. A hook row can only route; it cannot run code. |
| Permission | At registration on the client (`frappe.model.can_read("RQ Job")` before `make_function_searchable`), inside each hook method, then the server. |
| Described to a machine | None. The shortcuts dialog lists descriptions for people. |

### `frappe-ui/experimental` `CommandPalette*` (1.0.2)

| Question | Answer |
| --- | --- |
| What an act is | The family has no act. A `CommandPaletteItem` has `value` (any value; "most apps pass their own command object"), `label`, `keywords`, `disabled`, `as` (`types.ts`). `CommandPaletteGroup` has `label`. The palette owns the dialog, the query, the keyboard and the client filter; the app writes the rows. |
| Name | None of its own. |
| Available in a context | The app decides which items it renders. A group hides when the filter empties it. |
| Argument | `select(value, event)`: `event.preventDefault()` keeps the palette open, "for a row that switches the palette into a mode". That is the hook for a second step. `filterable: false` plus `update:query` is for server search. |
| Key | The palette registers no shortcut. The docs show `useKeyboardShortcut({ combo: 'Mod+K', allowInInput: true, handler })`. `useKeyboardShortcut` takes `combo`, `description`, `group`, `enabled`, `preventDefault`, `allowInInput`, `allowInDialog`, and `handler` or `onHold`/`onRelease`; it must run in component setup and unregisters on unmount. `<KeyboardShortcut combo>` draws a key chip in a row's `#suffix`. |
| Plugin adds one | Not applicable. |
| Permission | None (`disabled` only). |
| Described to a machine | None. Every `useKeyboardShortcut` registration lists itself in `KeyboardShortcutsDialog` by `group` and `description`. |

## 2. The acts desk v2 already names

Read at `c3eb3c40e7`. "Script runs it" means a record script can make the act happen
today through the `page` object. No row has a machine description.

### The record page header (`page.header`)

Seeded by `headerBuiltins()` in `pages/Record.vue:371` and `headerMenuBuiltins()` in
`pages/record/builtinActions.ts:48`. A `HeaderItem` (`recordPage/types.ts:44`) has `name`,
`label`, `icon`, `zone` (`left`, `right`), `display` (`button`, `dropdown`, `section`,
`crumb`), `group`, `href`, `run(page)`, `component`, `props`. A `dropdown` or `section`
is a container; members point at it with `group`, two deep. An entry with no declared
group lands in a band named `actions` (`recordPage/headerRenderings.ts:345`).

| Name | Zone, display, group | Gate | Script runs it |
| --- | --- | --- | --- |
| `doctype` | left, crumb, `href` to the list | none | Not by name. `page.router.push(...)` reaches the same place |
| `record` | left, crumb | not on a single | No (no act) |
| `favourite` | left, button | none | No |
| `save` | right, button, pinned | none | Not by name. `page.save()` |
| `favourite_row` | `⋯`, group `favourite_band` | none | No |
| `follow_row` | `⋯`, group `favourite_band` | follow is on | No |
| `copy_url` | `⋯`, group `copies` | none | No |
| `copy_id` | `⋯`, group `copies` | none | No |
| `delete` | `⋯`, group `danger` | `perms.delete`, not a single | No `page.delete()` |

The new-record page (`pages/record/UnsavedRecord.vue:280`) seeds `doctype`, `record` and
`save` only. A script reaches every header item through the eight verbs (`add`, `hide`,
`show`, `update`, `move`, `has`, `order`, `clear`). None of them runs an item. The page's
own `runAction` (`pages/Record.vue:867`) runs a click: it calls `run(page)` inside a hold,
toasts a failure, and reloads the record unless the error is a save veto. It checks no
right; built-ins are gated when they are declared, and the server checks the request.

### Quick actions, tab create entries and writers

| Surface and name | Declared in | Gate | Script runs it |
| --- | --- | --- | --- |
| `page.quickActions` `email` | `builtinActions.ts:15` | `perms.email` | Indirectly: `page.composer.open('email')` |
| `comment` | same | none | Indirectly: `page.composer.open('comment')` |
| `attach` | same, from the Files tab's `create` | write, Files tab drawn | No |
| `print` | same | `perms.print` | No |
| `copy_link` | same | none | No |
| `follow` | same | follow is on | No |
| `tags` | same, `tagging: true`, no `run` | write, no tag yet | No |
| `page.tabs` `files`, `create` "Attach a file" | `pages/record/tabs/recordTabs.ts:47` | write | No |
| `page.composer` writers `comment`, `email` | `pages/record/composer/composerHost.ts:41` | `email` needs `perms.email` | Yes: `page.composer.open(name)` |

A `QuickAction` has `name`, `label`, `icon`, `description`, `run(page)`. A
`TabCreateAction` has `label`, `icon`, `run(page)` and no name of its own.

### Held acts (`recordPage/heldActs.ts`)

`createHeldActs` holds an act a script makes during a replay or a hold, keyed by
`kind:target` (the last one wins), and lands it after the commit in a fixed order. In the
replay after a background read it drops the act.

| Kind | Script call | Script runs it |
| --- | --- | --- |
| `activate` | `page.tabs.activate(name)`, `page.form.tabs.activate(identity)` | Yes |
| `disclose` | `page.panelSections.open(name)`, `.close(name)` | Yes |
| `focus` | `page.fields.focus(fieldname)` | Yes |
| `scrollTo` | `page.activity.scrollTo(key)` | Yes |
| `open` | `page.composer.open(name, options)` | Yes |

### Page acts and shell acts

| Act | Declared in | Script runs it |
| --- | --- | --- |
| `page.save()`, `page.reload()`, `page.refresh()`, `page.call()`, `page.toast.*`, `page.dialog.*`, `page.router` | `recordPage/types.ts:552` | Yes |
| `page.create(doctype, { values })` | `recordPage/createRecordPage.ts:414`, reaching the shell's `openCreate` (`shell/create.ts`). `main.ts:90` provides it to components as `CreateRecordKey` | Yes |
| `page.openSettings(prefix, pane, block)` | Ruled in [Grilling: the settings address and opening a pane by name](https://github.com/frappe/frappe/issues/45151), as a held shell act by injection key | **No. It is not built at this commit**; no file names it |

### A contribution's `actions`

`RecordHandlers.actions` is typed in `contributions/types.ts:6` as
`{ name, label, icon?, run(page) }[]`. **Nothing reads it.** `flattenHandlers` sees an array,
which is neither a function nor a block of functions, and drops it with the dev warning
"is neither a handler nor a block of them — ignored" (`recordPage/flattenHandlers.ts:35`,
`:64`). Script runs it: no.

### The list page (`pages/list/DoctypeList.vue`)

| Act | How it is declared | Script runs it |
| --- | --- | --- |
| Create | A `Button` in the template, `openCreate(doctype, { values })` | No list script API |
| Customize Quick Filter | `menuOptions`, a label and `onClick`, in the `More` menu | No |
| Delete (bulk) | `bulkActions`, a label and `onClick`, in `ListBulkBar` | No |
| Filter, sort, columns (and reset), load more, page size, exact count | Components with `v-model` and events | No |

None has a name. A `list.js` contribution (`ListHandlers`) carries `columns` only.

### The rail and the avatar menu (`shell/RailColumn.vue`), and the sidebar

| Menu | Entries | Script runs it |
| --- | --- | --- |
| App menu | All apps, Customize sidebar (writes `#customize/rail`), Copy link | No. `#customize` is an address, so `page.router` can open it |
| Avatar menu | My settings (leaves for `/app/user/<name>`), Theme (Light, Dark, System), Desk v1, Log out (opens `LogoutDialog`) | No |
| Sidebar | Customize (writes `#customize/sidebar/<address>`), collapse toggle (`SidebarEdge`) | No |

Entries are frappe-ui `Dropdown` options: `label`, `icon`, `onClick`, sometimes `theme`
or `submenu`. None has a name.

### Keys today

The map's charter says no file in `frontend/src` registers a key. Two do, through raw
`window` `keydown` listeners, not `useKeyboardShortcut`:

- `pages/record/recordSave.ts:18`, `useSaveKeys`: Ctrl/Cmd+S saves the record.
- `pages/create/CreateDialog.vue:149`: Ctrl/Cmd+Enter and Ctrl/Cmd+S save the Create dialog.

## 3. The four shapes, measured against the inventory

Each snippet adds "Convert to Deal" to the CRM Lead record page, so it shows in the header,
shows in the palette and runs from a key. The server method is
`crm.fcrm.doctype.crm_lead.crm_lead.convert_to_deal(lead)`. It checks `write` on the lead
and returns the deal's name. CRM's `crm_lead/frontend/record.js` holds only
`page.tabs.order(["activity", "emails"])` today. Every API name below is a placeholder;
none exists.

The shared run function:

```js
async function convert(page) {
  const deal = await page.call("crm.fcrm.doctype.crm_lead.crm_lead.convert_to_deal", { lead: page.docname })
  await page.router.push(routeFor("CRM Deal", deal))
}
```

### Shape 1: one root object

One object (`frappe` is the root map's candidate name) is the only entry point. The
current page is a member of it, and an act is an item on a surface. The header item is
the act; it gains a `key`. The palette reads `page.header` (ruling 3).

```js
// crm/fcrm/doctype/crm_lead/frontend/record.js
export default {
  onRefresh(page) {                       // page is frappe.page
    if (page.doc.converted || !page.perms.write) return
    page.header.add({ name: "convert_to_deal", label: __("Convert to Deal"),
      icon: "lucide-handshake", display: "button", key: "Mod+Shift+D", run: convert })
  },
}
// Another script, or an LLM tool: frappe.page.header.run("convert_to_deal")
```

Reuses `HeaderItem`, `run(page)`, the replay and `runAction`. New: a `key` field, a `run`
verb on a surface, and the root object.

### Shape 2: a shell object above the page

The shell owns the acts; a page is one source of them. A script registers an act on the
shell for the page's life, and the header item points at it by name.

```js
export default {
  onRefresh(page, shell) {
    shell.acts.add({ name: "crm.convert_to_deal", label: __("Convert to Deal"),
      key: "Mod+Shift+D", available: () => !page.doc.converted, right: ["CRM Lead", "write"],
      run: () => convert(page) })
    page.header.add({ name: "convert_to_deal", act: "crm.convert_to_deal", display: "button" })
  },
}
// Anywhere: shell.run("crm.convert_to_deal")
```

Reuses `page.header` and the shell's existing acts (`openCreate`, the ruled
`openSettings`, the `#customize` hash). New: a second handler argument, a shell act list
with a lifetime tied to the page, and an `act` key on `HeaderItem`. The header item and
the act are two declarations.

### Shape 3: a command registry

Acts are declared once at module level with a global id, as in VS Code and Obsidian. A
`when` predicate reads a context, and surfaces list ids. This is the "new contribution kind
for global acts" of ruling 7, used for page acts too.

```js
// crm/fcrm/doctype/crm_lead/frontend/acts.js   (a new contribution kind)
export default [{
  id: "crm.lead.convert_to_deal",
  label: __("Convert to Deal"),
  when: (context) => context.doctype === "CRM Lead" && !context.doc.converted,
  right: { doctype: "CRM Lead", ptype: "write" },
  key: "Mod+Shift+D",
  surfaces: ["record.header"],
  run: (context) => convert(context.page),
}]
// Anywhere: acts.run("crm.lead.convert_to_deal")
```

Reuses `page.call` and the contribution path rules. New: a contribution kind, a context
object, a surface name for the header, and a declared `right` the dispatcher can check.
The record page's header items stay a separate list unless they are also moved into the
registry.

### Shape 4: a route-first address space

Every act has an address, and running an act means resolving its address, as `#settings`
and `#customize` already work. The header item links to the address, the palette lists
addresses, a key binds an address, and a script or an LLM asks for an address.

```js
export default {
  acts: {
    "convert-to-deal": { label: __("Convert to Deal"), key: "Mod+Shift+D",
      header: { display: "button" }, available: (page) => !page.doc.converted, run: convert },
  },
}
// The act's address: act:crm/crm-lead/LEAD-0042/convert-to-deal
// Anywhere: frappe.go("act:crm/crm-lead/LEAD-0042/convert-to-deal")
```

Reuses `boot.prefixes`, the slug, the record address and the hash dialog grammar. New: an
`act:` scheme and its resolver, and an `acts` key in the handler object. Ruling 8 keeps the
palette itself out of the hash; an act address does not have to be a URL a person can
link.

### Against the inventory

| Inventory part | Shape 1 | Shape 2 | Shape 3 | Shape 4 |
| --- | --- | --- | --- | --- |
| `HeaderItem` and its dropdown sections | The act itself | Points at an act | A surface that lists ids | Links to an address |
| Quick actions, tab `create` entries | Acts as they are | Point at acts | Move into the registry | Get addresses |
| Held acts | Stay `page` verbs | Stay `page` verbs | Stay `page` verbs | Stay `page` verbs |
| `page.create()`, `page.openSettings()` | Members of the root object | Shell acts | Registry entries | Addresses (`#settings/...` already is one) |
| Contribution `actions` (unread) | Replaced by `page.header.add` | Becomes `shell.acts.add` | Becomes the registry file | Becomes the `acts` key |
| List page, rail, avatar menu (unnamed) | Need a list page object and named menu items | Need shell acts with names | Need registry entries | Need addresses |
| A key | A field on the item | A field on the act | A field on the entry | A field on the act |
| Permission at dispatch | Must come from `run` or a new item field | `right` on the act | `right` on the entry | Resolver checks before it runs |
