# How Flow can call `window.desk` from its panel

Research for #47613, part of map #47612 (Desk v2: the UI API an LLM drives). Read on `desk-v2` at `22494aa39f` (2026-11-16). All paths are in `apps/frappe`. A claim marked *inferred* was not checked in code or on a live site. Nothing here was walked on `desk.localhost`.

## Answer

Flow already has the full path that this work needs. Its `read_screen` tool runs in the browser: the server tool sends a realtime event, the chat in the panel reads the page, and the panel posts the result back to the waiting call. The panel runs in the same document and the same JavaScript realm as the desk v2 page. Thus Flow's code can call `window.desk` directly, with no iframe and no `postMessage`.

The smallest change copies `read_screen` for two new tools, `list_acts` and `run_act`, and adds `window.desk.state()` to what `read_screen` returns. About six files change. All of them are in Flow's code (`frappe/flow`, `flow/frontend`), except `window.desk` itself. Flow's owner must agree to it.

## 1. Where the panel runs

- **The same document as the page.** `frappe.flow.launcher.add_to_page` is an `after_request` hook (`frappe/hooks.py:631`). It adds `flow_launcher.bundle.js` to each HTML page under an app root (`frappe/flow/launcher.py:18-38`). The roots include `apps`, which is the desk v2 shell (`launcher.py:15`, `frappe/shell/__init__.py:4`). A Playwright test opens the panel on `/apps/desk` (`playwright/tests/flow_launcher.spec.js:117-127`).
- **Not an iframe.** The launcher makes a `<flow-launcher>` element on `document.body`. It mounts the chat in a `div` in the page's own tree, slotted into that element's shadow root (`frappe/public/js/flow_launcher.bundle.js:36-51`). `mountIsland` loads the chat with a dynamic `import()` in the same window (`ui/island/host.js:182`). `mountVueIsland` adds a shadow root for CSS only (`ui/island/mount.js:77-85`). Thus the chat's code shares `window` with the page.
- **The launcher runs only in the top window** (`flow_launcher.bundle.js:458`). It publishes `window.flow = { toggle }` (`:460`).
- **The `/flow` page is a second host.** It is a full page with no page beside it (`frappe/www/flow/index.py:1-26`). The chat knows which host it is in from the `panel` prop: `"desk"`, `"app"`, or none on `/flow` (`flow/frontend/src/island.js:20-30`, `flow/frontend/src/panel.js:1-10`).
- **On desk v2 the panel thinks it is in an "app".** The launcher finds Desk by `window.frappe?.set_route` (`flow_launcher.bundle.js:162`). Desk v2 sets no `window.frappe` (only `window.csrf_token`, `frontend/src/boot.ts:188`). So the panel gets `panel: "app"`, and `host.navigate` calls `location.assign` (`:173`). A link in the chat then reloads the whole desk v2 page (*inferred* from the code, not walked).

## 2. How a Flow tool runs now

- **Most tools run on the Frappe server.** The flow server (`flow/harness`) holds the model loop. For each "client tool" it posts to Frappe's callback (`flow/harness/src/flow_harness/agent/client_tools.py:26-53`). Frappe runs the tool as the session owner (`frappe/flow/daemon/callback.py:41-72`, `:109-131`).
- **A tool can answer later.** A tool returns `Pending(timeout)` (`frappe/flow/lib/tool.py:39-44`). The callback replies `{"pending": true, "timeout": N}` (`callback.py:129-130`). The flow server waits N seconds on a future keyed by a `result_token` (`client_tools.py:40-53`). Anyone with the token posts the result to `POST /sessions/{sid}/tool_result` (`client_tools.py:56-61`, `harness/src/flow_harness/server/routes/sessions.py:437-445`). Frappe wraps that as `DaemonClient.tool_result` (`frappe/flow/daemon/client.py:113-115`).
- **`read_screen` is a browser tool built on this.** The steps:
  1. The server tool publishes `flow:read_screen` with the session and token to the user's sockets, then returns `Pending(timeout=20)` (`frappe/flow/tools/builtins.py:32-34`, `:1084-1096`).
  2. Each chat listens on its own socket (`flow/frontend/src/chat/FlowPage.vue:208`). A chat that shows that session reads the page with `readScreen(window, …)` (`FlowPage.vue:235-247`).
  3. The chat posts the result to `frappe.flow.api.screen_result` (`FlowPage.vue:249`). That endpoint checks write access to the session and calls `tool_result` (`frappe/flow/api/api.py:207-224`).
  4. A chat on `/flow` waits 1.5 s and then answers with an error, so a panel on the same chat wins (`FlowPage.vue:234-240`).
  5. The first answer wins. A later one gets `delivered: false` and the chat ignores it (`FlowPage.vue:250-252`, `client_tools.py:56-61`).
- **Trigger sessions drop `read_screen`,** because no page is open (`frappe/flow/doctype/flow_session/flow_session.py:184-188`).
- **`read_screen` sees less on desk v2 than on desk v1.** It reads unsaved state, empty required fields, list filters and selection from desk v1 globals (`frappe.get_route`, `cur_list`, `frm`) (`flow/frontend/src/chat/screen.js:37-38`, `:51-77`). Desk v2 has none of these, so it gets only the URL, title and visible text (`screen.js:29-42`).
- **Tools are fixed when a chat starts.** `create_session` sends `server_config()` with the tool schemas to the flow server once (`frappe/flow/lib/session.py:73`, `flow_session.py:151-188`). No other call sends tools. So a tool that is added later reaches only new chats (*inferred*: no "update tools" call was found).
- **The Assistant gets every builtin.** `sync_builtin_assistant` gives the "Flow" agent all of `BUILTIN_TOOLS` (`frappe/flow/assistant/assistant.py:116-120`, `builtins.py:1237-1262`). Its prompt names each tool (`assistant.py:26-27`). Apps add tools through the `flow_tools` hook (`frappe/flow/lib/agent.py:59-65`), but those tools must be attached to an agent by hand.

## 3. What passes between the panel and the page

| Direction | Channel | Where |
|---|---|---|
| Page to launcher | `flow:ask` window event with `{text}` | `flow_launcher.bundle.js:60`, `frontend/src/shell/paletteFlow.ts:17` |
| Page to launcher | a click on `[data-flow-toggle]`, or `window.flow.toggle()` | `flow_launcher.bundle.js:62-64`, `:460` |
| Launcher to page | `html[data-flow="ready"]`, `data-flow-docked`, `--flow-dock-width` | `flow_launcher.bundle.js:31`, `:216-222` |
| Page reads launcher | desk v2 reads the panel's box from the shadow root | `frontend/src/shell/flowLauncher.ts:67-72` |
| Launcher to chat | `host`: `locale`, `user`, `base_url`, `navigate(route)` | `flow_launcher.bundle.js:169-174`, `ui/island/context.js:9-24` |
| Launcher to chat | props: `panel`, `path`, `onClose`, `onNavigate` | `flow_launcher.bundle.js:175-183` |
| Chat to page | direct reads of `window` and `document` (`readScreen(window, …)`) | `FlowPage.vue:243`, `screen.js:29` |

The launcher passes no page object. Desk v2 and Flow know each other only through globals, events and DOM attributes. `paletteFlow.ts:1-2` states this rule: "the palette imports nothing from Flow". `window.desk` fits this rule: the chat reads it when a call comes, so load order does not matter.

## 4. The smallest change

Copy the `read_screen` path. Do not add a new transport.

**Flow server code (`frappe/flow`):**

1. `tools/builtins.py`: add two tools beside `read_screen`. Each publishes an event and returns `Pending`.
   - `list_acts()`: the acts that can run now, with description and argument schema.
   - `run_act(name: str, args: dict | None)`: runs one act. It returns `{ok, data, error}`.
   - Add both to `BUILTIN_TOOLS` and give them a line in `ASSISTANT_INSTRUCTIONS`.
   - Use one event, such as `flow:page_call` with `{session, token, op, args}`, in place of one event per tool.
2. `api/api.py`: keep `screen_result` as the one way back. It already takes any JSON and any token (`api.py:207-224`). A rename to `page_result` is optional.
3. `doctype/flow_session/flow_session.py:184-188`: drop the new tools from Trigger sessions, as `read_screen` is dropped.

**Flow frontend (`flow/frontend`):**

4. `chat/FlowPage.vue`: handle the new event next to `flow:read_screen`, with the same session check and the same `/flow` reply.
   - `list_acts` calls `window.desk.acts.list()`.
   - `run_act` calls `window.desk.acts.run(name, args)`.
   - When `window.desk` is missing, answer with an error such as "The page beside the chat is not a desk v2 page."
5. `chat/screen.js`: when `window.desk?.state` exists, add `screen.desk = window.desk.state()`. This gives the agent the snapshot through the tool it already knows, with no new tool.
6. `chat/toolMeta.js`: a label and icon for each new tool (`toolMeta.js:145-151` shows the `read_screen` entry).

**Desk v2 (`frontend`):** `window.desk` with `acts.list()`, `acts.run()` and `state()`. That is a separate ticket on map #47612.

**Two gaps that `run_act` must close and `read_screen` does not have:**

- **Run once.** The event goes to every socket of the user. Every chat that shows the session reacts (`FlowPage.vue:233`, `:251`). A second answer to a read does no harm, but a second run does an act twice. Before it runs, the chat claims the token with one atomic server call. An example is a Redis `SET … NX` on `flow_page_call:<token>` (*inferred*: the endpoint does not exist, and the shape is a proposal).
- **Time.** `read_screen` waits 20 s (`builtins.py:34`). An act can open a confirm that a person answers later (map ruling 4). Proposal: `run_act` returns `Pending(timeout=60)`. The chat races the act against a 15 s timer. If a confirm is still open when the timer ends, the chat answers "waiting for the user" with the dialog's id. The agent can then read `state()` again. The numbers are a starting point (*inferred*).

A full page load ends the chat's pending reply, because the island unmounts. A `run_act` that reloads the page then times out. Navigation acts must route inside the desk v2 app (*inferred*).

Size: about 150 lines in Flow plus tests, by analogy with `read_screen` (*inferred*).

## 5. Options not chosen

- **Desk v2 listens on its own socket and answers.** It needs no change to Flow's frontend. But the desk shell does not know which tab shows which chat, so it cannot find the right tab. It also copies the session check.
- **Pass `desk` in the island's `host` context** (`ui/island/context.js:9-24`). This is a clean typed contract. But the launcher runs `defer` and can run before desk v2 sets `window.desk`, so a captured value can be `undefined` (*inferred*). A getter in `host` solves that. It is a good second step, not the first.
- **One Flow tool per act**, built from act schemas. Tools are fixed when a chat starts (`session.py:73`), but the acts change with each page. A generic `run_act(name, args)` with `list_acts()` matches how the tool list works.
- **An `iframe` or `postMessage` bridge.** It is not needed, because the chat is in the same realm.

## 6. What Flow's owner must agree to

Most commits under `frappe/flow` and `flow/frontend` on `desk-v2` are by Shrihari Mahabal.

1. Two new builtins on the Assistant for every Flow user, and their names (`list_acts`, `run_act`).
2. One page-call event and one result endpoint in place of the `read_screen`-only pair. Keep `screen_result` or rename it.
3. Approval for `run_act`. Proposal: `requires_confirmation=True`, so the "Ask" mode still "asks before changing anything" (`FlowPage.vue:189-194`). The desk's own confirms stay on top of this (ruling 4). A later act field, such as "changes nothing", could let reads like `shell.open` skip the card.
4. Calls held open for up to about 60 s on the flow server, and the "waiting for the user" reply.
5. The claim step, so that only one tab runs an act.
6. Flow reads a global that another team owns: `window.desk`, with a `version` field so the chat can check what it can call.
7. Optional: on desk v2, `host.navigate` uses `window.desk` to route in place of `location.assign` (`flow_launcher.bundle.js:173`). This keeps the panel alive across a Flow link.
