# Research: a relay from the server to a person's open desk tab, and prior art for browser agents

Ticket: frappe/frappe#47614, part of map #47612. Read on 2026-11-16 against `desk-v2` at `22494aa39f`. All repo paths are under `apps/frappe/` and are cited as `path:line` on that commit. "Inferred" marks a claim that this research did not check in source or a primary document.

## Answer in short

- **Carry the request with what exists.** The server sends the request with `frappe.publish_realtime(..., user=...)` to the `user:{user}` room. The tab posts the answer back to a whitelisted method over REST API v2. Flow's `read_screen` tool already works this way.
- **This path needs no change to the socket server.** Both socket servers (Node, the default, and the new Python one) relay Redis `events` to rooms in the same way. A relay that uses only `publish_realtime` and a REST reply works on both.
- **Do not hold a web worker for minutes.** The `fr ui` call waits for the answer for a bounded time (about 25 s). Then it returns `waiting_for_user` with a request id, and the client asks again. The tab stores the final answer in Redis with a time to live.
- **Name a tab with an id that the tab makes.** The socket id changes on each reconnect. Pick the default tab by "the last focused tab of this user". Return the tab id and its route in every result.
- **The token maps to a user, not to a tab.** OAuth and API keys call `frappe.set_user(token_user)`. The relay may target only the tabs of `frappe.session.user`. The opt-in (ruling 8) is a per-user setting, because Frappe OAuth has only the `all` scope.
- **Cost with no agent: none on the server.** A tab with the opt-in off adds no listener. A tab with the opt-in on adds one socket listener. Nothing polls and nothing sends a heartbeat.
- **Prior art agrees on one shape.** Playwright MCP, Chrome DevTools MCP, browser-use and Claude's browser tools all send a text tree with one line for each element (role, name, short id). Each action returns a short result that says what changed. An open dialog shows in every result with the call that answers it. None of them holds one call open for minutes while a person decides. See [section 4](#4-prior-art-browser-agents).

## 1. What the realtime layer offers

### 1.1 Two socket servers, one Redis contract

The web process does not talk to sockets. It publishes JSON to the Redis channel `events`, and a separate socket server re-emits it to a room.

- `publish_realtime` picks a room and calls `emit_via_redis` (`frappe/realtime/__init__.py:30-90`). `emit_via_redis` publishes `{event, message, room, namespace}` to the channel `events` (`:107-122`).
- A Redis connection error is swallowed (`:115`). A publish is fire and forget. Nothing tells the sender if a socket got the event.
- The Python server's `RedisBridge` reads `events` and emits to the room in the site's namespace (`frappe/realtime/bridge.py:45-120`). Its docstring calls the message shape "the frozen external contract" (`:49-52`).
- `bench socketio` picks the server from `socketio_backend` in `common_site_config.json`. The default is `node` (bench `commands/socketio.py:35-47`, the installed bench, not this repo). This bench runs `node apps/frappe/socketio.js` (checked with `ps`).
- `frappe/asgi.py:25-28` can also embed the Python server in one ASGI process with the web app.

A relay that uses only `publish_realtime` therefore runs on all three set-ups. A relay that needs a new socket event handler must be written twice: once in `realtime/*.js` and once in `frappe/realtime/*.py`. Flow did that for its own relay (`realtime/flow_handlers.js`, `frappe/realtime/flow_handlers.py:1-5`).

### 1.2 Rooms

On connect, each socket joins `user:{user}` and `website`, and a System User also joins `all` (`frappe/realtime/handlers.py:35-40`, `realtime/handlers.js:6-12`). Other rooms (`doc:`, `doctype:`, `task_progress:`, `open_doc:`) are joined on request after a permission check (`frappe/realtime/handlers.py:48-110`).

There is no room per tab. `publish_to_user` reaches "all of that user's sockets on this site" (`frappe/realtime/README.md`, the room table). That includes every desk tab, every Flow panel, and every other client that connects with the user's credentials, on every device.

### 1.3 Request and response

The realtime layer has no request and response from the server to a client today.

- The Python `Socket` wrapper has `emit`, `join`, `leave`, `participants`, `get`, `set`, `has_permission` (`frappe/realtime/socket.py:18-109`). It has no call that waits for the client's answer.
- An acknowledgement exists only in the other direction: a client emits with a callback, and the handler's return value answers it (`frappe/realtime/README.md`, "Acknowledgements". `frappe/realtime/dispatch.py:83-96`).
- python-socketio 5.17 has `AsyncServer.call(event, data, to=sid, timeout=60)`. It waits for the client's ack, cannot broadcast, and "still waits until the specified timeout" if the connection drops (`env/.../socketio/async_server.py:226-268`, installed copy). Socket.IO 4.8 (Node) has the same idea as `socket.timeout(ms).emitWithAck()` (inferred from the Socket.IO docs, not checked here).
- Both of these run inside the socket server. The `fr ui` request starts in the web process, which has no socket. To use them, the relay would need a new handler in both servers, and the CLI would need to connect to socket.io itself.

### 1.4 The relay that already exists: Flow's `read_screen`

Flow's agent can read the page beside its chat panel. The path is the same one that `fr ui` needs, in small:

1. The tool publishes `flow:read_screen` with `{session, token}` to the user's room, then returns `Pending(timeout=20)` (`frappe/flow/tools/builtins.py:32-34`, `:1084-1096`).
2. Every tab of the user gets the event. Only a panel that shows that chat answers (`flow/frontend/src/chat/FlowPage.vue:235-236`).
3. A Flow page in a tab of its own waits 1.5 s and answers with an error, "so a panel on the same chat is heard first" (`FlowPage.vue:232-240`).
4. The panel posts `frappe.flow.api.screen_result` with the token and the screen (`FlowPage.vue:249`). That method checks that the caller may write the session (`frappe/flow/api/api.py:208-226`).
5. The Flow server holds the waiting call as an `asyncio.Future` keyed by the token. The first answer wins, and a later one gets `delivered: false` (`flow/harness/src/flow_harness/agent/client_tools.py:41-67`, `server/routes/sessions.py:437-442`).

What carries over: the room, the random token, "first answer wins", a delay to rank tabs, and a REST reply checked against the caller's user. What does not carry over: the wait. Flow waits in its own asyncio server, not in a web worker.

## 2. Options for the relay

| | A. Redis and REST (recommended) | B. Socket ack | C. Through the Flow server |
|---|---|---|---|
| Request path | REST v2 → `publish_realtime` → tab | `fr ui` connects to socket.io → new handler → `call`/`emitWithAck` to one tab | REST → Flow server client tool → tab |
| Reply path | tab → REST v2 POST → Redis list | socket ack | tab → REST → Flow server |
| Socket server change | none | a handler in Node and in Python | none |
| Long wait | bounded per call, then poll | free (async) | free (async) |
| Works without Flow | yes | yes | no |
| Fits "REST API v2 only" | yes | no | yes |

**Option B, details.** Socket auth accepts an `Authorization` header in place of the `sid` cookie (`frappe/realtime/auth.py:140-157`, `realtime/middlewares/authenticate.js:26-43`). The origin check passes when no `Origin` header is sent (`auth.py:130-137`). Thus `fr ui` could connect with its bearer token. But this adds a second protocol to frappectl, and the socket would also get every event sent to the user's room.

**Option A, the shape:**

1. `POST /api/v2/method/<relay>.run` with `{tab?, act, args}`. The server checks the opt-in, makes a request id with `secrets.token_urlsafe`, and calls `publish_realtime("desk:ui_request", {...}, user=frappe.session.user)`.
2. The server waits on the Redis list `ui_reply:{id}` with `BLPOP` for up to about 25 s (the client and server limits are in 3.1).
3. The tab with the matching tab id runs the act through `window.desk`. It posts `{id, result}` to `<relay>.reply`. The reply method checks that `frappe.session.user` is the user who made the request, then pushes the result on `ui_reply:{id}` with a time to live.
4. If the wait ends first, the call returns `{ok: false, error: {code: "waiting_for_user", request: id}}`. `fr ui wait <id>` calls `<relay>.result` and waits again.

The Redis key names and the method names above are a proposal, not existing code.

## 3. Wait time, tabs, identity, cost

### 3.1 How long a request can wait

- frappectl's HTTP timeout is 60 s (`frappectl/transport.py:25`, `DEFAULT_TIMEOUT`).
- Production gunicorn uses sync workers with `-t {{ http_timeout }}`, default 120 s, and `2 × CPU + 1` workers (bench `config/templates/supervisor.conf:7`, `config/supervisor.py:47`, `config/common_site_config.py:61-66`). A waiting call holds one worker for its full wait.
- Flow's `read_screen` waits 20 s (`builtins.py:34`).

A confirm can take minutes, so one HTTP call cannot cover it. Wait for at most about 25 s in one call. The act result is known before that in most cases. When a confirm opens, the tab can post a first reply at once: `{status: "waiting_for_user", dialog: {...}}`. Then it posts the final result when the person answers. The agent then reads "waiting for the user" or "declined", as ruling 4 asks. Keep the result in Redis for a fixed time (for example 15 min) so that `fr ui wait` can get it later.

### 3.2 How a tab is named and picked

- Each desk v2 tab opens one socket at boot (`frontend/src/main.ts:101`, `frontend/src/shell/socket.ts:1-13`).
- A reconnect makes a new socket id, and the server forgets its rooms (`frontend/src/shell/socket.ts:15-18`). The socket id is therefore not a stable tab name.
- No tab id exists in desk v2 now. A search for `tabId`, `tab_id` and `BroadcastChannel` under `frontend/src` and `ui/src` found nothing. `frontend/src/browserMemory.ts:26-32` already keeps per-tab state in `sessionStorage`.
- `sessionStorage` "survives over page reloads and restores". A page that has an opener starts with "a copy of the opener's `sessionStorage`" ([MDN, Window.sessionStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/sessionStorage)). A tab opened from a desk link can thus copy the id. The tab must make a new id when it sees that its `window.opener` is set or that another tab answers with the same id.

Proposal for picking:

1. `fr ui tabs` sends `desk:ui_hello` to the user's room. Each opted-in tab answers with `{tab, route, title, visible, focused_at}`. The call collects answers for about 1 s.
2. A request with no tab goes to the tab with the latest `focused_at`. This is the tab the person used last.
3. Every result carries `tab` and `route`, so the agent can name the tab in the next call.
4. A request that names a tab that is gone gets `tab_not_found` after the short collect window, not after the full wait.

### 3.3 How a frappectl token maps to the tab's user

- frappectl logs in with OAuth Authorization Code and PKCE, scope `openid all` (`frappectl/oauth.py:1-24`, `:55`). It also supports API keys (`frappectl/config.py:44-55`).
- On each request, `validate_oauth` looks up the `OAuth Bearer Token`, calls `frappe.set_user(token.user)`, and stores `frappe.session.data.oauth_client` (`frappe/auth.py:683-729`). An API key also ends in `frappe.set_user` (`frappe/auth.py:784`).
- The scope check uses the token's own scopes as the required scopes (`frappe/auth.py:720-723`). Frappe has no narrower scope than `all` that the relay could ask for.
- frappectl's read-only profile is a client-side guard on the HTTP verb (`frappectl/transport.py:283-290`). The server does not see it.

The relay thus knows the user and the OAuth client. It may only send to `user:{frappe.session.user}`. The opt-in of ruling 8 must be a server-side setting per user, because neither the token scope nor the read-only profile can carry it. `oauth_client` can name the caller in the shell's "an agent drives this tab" mark (the map lists that mark as not yet specified).

### 3.4 Cost on a site with no agent

- Server: zero. The relay methods run only when called. Redis keys exist only during a request.
- Tab with the opt-in off: zero. The tab does not add the listener.
- Tab with the opt-in on: one `socket.on` listener on a socket that is already open (`frontend/src/shell/realtime.ts:16-29` shows the same pattern for scripts). No heartbeat and no polling.
- Every tab of the user receives each request event, and only one answers. This is the same cost as `read_screen`.

### 3.5 Safety notes

- A socket cannot send to another user's room: no core handler lets a client emit to a room (`frappe/realtime/handlers.py`). Only the web process publishes. Inferred: an app's own handler could break this.
- The reply method must check the session user against the stored request, as `screen_result` checks write access on the session (`frappe/flow/api/api.py:213`).
- The request id is the only secret in the reply. Make it random and single use, as Flow does (`client_tools.py:41`).

## 4. Prior art: browser agents

A helper agent read these sources on 2026-11-16 and gave commit-pinned links. This research checked two of the pages again by hand: the Claude browser toolset page and the MCP tools spec. The rest is as the helper reported it. Playwright MCP's code now lives in the Playwright monorepo, and `microsoft/playwright-mcp` keeps the README and tests.

### 4.1 Page snapshot

All four tools send a text tree, one line for each element, with a role, a quoted name, state flags and a short id:

| Tool | Line format | Source |
|---|---|---|
| Playwright MCP | `- button "Submit" [ref=e2]` (ARIA snapshot as YAML) | [aria-snapshots docs](https://playwright.dev/docs/aria-snapshots), [tab.ts#L495-L516](https://github.com/microsoft/playwright/blob/b4d016aa/packages/playwright-core/src/tools/backend/tab.ts#L495-L516), [click.spec.ts#L36-L47](https://github.com/microsoft/playwright-mcp/blob/78eca853/tests/click.spec.ts#L36-L47) |
| Chrome DevTools MCP | `uid=1_1 button "Click me" focusable focused`, also as JSON in `structuredContent` | [snapshot.ts#L15-L50](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/ebb2ba07/src/tools/snapshot.ts#L15-L50), [McpResponse test snapshot#L334-L362](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/ebb2ba07/tests/McpResponse.test.js.snapshot#L334-L362) |
| browser-use 0.x | `[35]<input type=text placeholder=Enter name />`, `*[` marks an element that is new since the last step | [system_prompt.md#L40-L63](https://github.com/browser-use/browser-use/blob/0.13.14/browser_use/agent/system_prompts/system_prompt.md#L40-L63) |
| browser-use 1.0 | `[id] role "name" = value`, `*` marks a new id | [ax.py#L92-L103](https://github.com/browser-use/browser-use/blob/4b5b1b0a/browser_use/ax.py#L92-L103) |
| Claude browser toolset (API) | `textbox "Search docs" [ref_3]` from `read_page` | [browser-use-tool docs](https://platform.claude.com/docs/en/agents-and-tools/tool-use/browser-use-tool) |

Each tool gives the agent a way to ask for less:

- Playwright MCP: `depth` and a `target` subtree on `browser_snapshot`, and `browser_find` for a text search, which the README calls "cheaper than capturing the whole snapshot" ([README.md#L1030-L1034](https://github.com/microsoft/playwright-mcp/blob/78eca853/README.md#L1030-L1034)).
- Chrome DevTools MCP: no snapshot after an action unless `includeSnapshot` is true ([input.ts#L32-L35](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/ebb2ba07/src/tools/input.ts#L32-L35)).
- browser-use 1.0: past 3000 characters it keeps the first 80% and the last 20%, because "a dialog's Done/Submit is usually its last line", and it writes how to get the rest ([ax.py#L655-L667](https://github.com/browser-use/browser-use/blob/4b5b1b0a/browser_use/ax.py#L655-L667)).
- Claude's `read_page`: `filter: interactive`, `depth` and a `ref` subtree, with a stated cap of 50,000 characters ([browser-use-tool docs](https://platform.claude.com/docs/en/agents-and-tools/tool-use/browser-use-tool)).

All four prefer this tree to a screenshot. Chrome DevTools MCP says "Prefer taking a snapshot over taking a screenshot" ([snapshot.ts#L15-L50](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/ebb2ba07/src/tools/snapshot.ts#L15-L50)).

Flow's own `read_screen` sends `Label: value` lines, `#` headings and `Tabs:`, with a cap of 6000 characters of text and 1000 characters for one value (`flow/frontend/src/chat/screen.js:1-10`).

### 4.2 Action result

- **Playwright MCP** returns Markdown sections in a fixed order: `Error`, `Result`, `Ran Playwright code`, `Open tabs`, `Page` (URL, title, console counts), `Modal state`, `Snapshot`, `Events` ([response.ts#L265-L379](https://github.com/microsoft/playwright/blob/b4d016aa/packages/playwright-core/src/tools/backend/response.ts#L265-L379)). After an action, the snapshot goes to a file and the result links to it.
- **Chrome DevTools MCP** returns one line, such as `Successfully clicked on the element`, plus `Page navigated to <url>.` Each line is also a field in `structuredContent` ([McpResponse.ts#L1041-L1075](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/ebb2ba07/src/McpResponse.ts#L1041-L1075)). Its design notes ask for "semantic summaries", "Self-Healing Errors" and "Reference over Value" ([design-principles.md](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/ebb2ba07/docs/design-principles.md)).
- **browser-use 0.x** had `ActionResult` with `is_done`, `success`, `error`, `extracted_content`, `long_term_memory` and more ([views.py#L307-L338](https://github.com/browser-use/browser-use/blob/0.13.14/browser_use/agent/views.py#L307-L338)). Version 1.0 keeps only `extracted_content` and `error` ([tools.py#L52-L90](https://github.com/browser-use/browser-use/blob/4b5b1b0a/browser_use/tools.py#L52-L90)). Its one-line result says what changed: `[ok] click [id] button "X" -> navigated to <url> / page changed / no change` ([ax.py#L776-L787](https://github.com/browser-use/browser-use/blob/4b5b1b0a/browser_use/ax.py#L776-L787)).
- **Claude's toolset** returns a short ack, `Clicked element ref_2.` A stale ref gives `is_error` with "Error: ref_3 is stale or not found on the current page. Re-read the page to get fresh references." ([browser-use-tool docs](https://platform.claude.com/docs/en/agents-and-tools/tool-use/browser-use-tool)).
- **MCP spec** (2026-07-28): `isError: true` is for errors "that language models can use to self-correct". A tool with `structuredContent` "SHOULD also return the serialized JSON in a TextContent block" ([server/tools](https://modelcontextprotocol.io/specification/2026-07-28/server/tools)).

### 4.3 Dialogs and confirms

| Tool | When a dialog opens | Source |
|---|---|---|
| Playwright MCP | The action returns at once with `### Modal state` and the tool that clears it (`browser_handle_dialog`). Other tools fail until it is cleared. | [tab.ts#L572-L585](https://github.com/microsoft/playwright/blob/b4d016aa/packages/playwright-core/src/tools/backend/tab.ts#L572-L585), [tab.ts#L683-L689](https://github.com/microsoft/playwright/blob/b4d016aa/packages/playwright-core/src/tools/backend/tab.ts#L683-L689), [tool.ts#L70-L89](https://github.com/microsoft/playwright/blob/b4d016aa/packages/playwright-core/src/tools/backend/tool.ts#L70-L89) |
| Chrome DevTools MCP | Every response says `# Open dialog … Call handle_dialog to handle it before continuing.` A click that opens a dialog is reported as done, not failed. | [McpResponse.ts#L1141-L1155](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/ebb2ba07/src/McpResponse.ts#L1141-L1155), [input.ts#L50-L64](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/ebb2ba07/src/tools/input.ts#L50-L64) |
| browser-use | Accepts the dialog by itself and tells the agent after. | [ax.py#L102](https://github.com/browser-use/browser-use/blob/4b5b1b0a/browser_use/ax.py#L102), [popups_watchdog.py](https://github.com/browser-use/browser-use/blob/0.13.14/browser_use/browser/watchdogs/popups_watchdog.py) |
| Claude in Chrome | A JS dialog blocks the extension. The person must close it. The extension asks before high-risk acts. | [code.claude.com/docs/en/chrome](https://code.claude.com/docs/en/chrome), [claude.com/blog/claude-for-chrome](https://claude.com/blog/claude-for-chrome) |
| MCP spec | "there SHOULD always be a human in the loop with the ability to deny tool invocations". A tool can return `resultType: "input_required"` and the client retries with the answers. | [server/tools](https://modelcontextprotocol.io/specification/2026-07-28/server/tools) |

None of them waits for minutes on a person inside one call. The tools that let the agent continue report the open dialog in the result and name the next step. This matches ruling 4: return "waiting for the user" at once with the dialog, and let the agent ask again.

### 4.4 Tabs

- Playwright MCP: `browser_tabs` with `list/new/close/select` and an index. It lists `- 0: (current) [title](url)` in a result when there is more than one tab ([response.ts#L381-L392](https://github.com/microsoft/playwright/blob/b4d016aa/packages/playwright-core/src/tools/backend/response.ts#L381-L392)).
- Chrome DevTools MCP: `list_pages`, then `select_page {pageId}`. A `--pageIdRouting` mode requires `pageId` on each call "for concurrent agent sessions". After a reconnect it says "Page ids have changed. Call list_pages" ([pages.ts#L25-L66](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/ebb2ba07/src/tools/pages.ts#L25-L66), [McpResponse.ts#L1036-L1040](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/ebb2ba07/src/McpResponse.ts#L1036-L1040)).
- Claude in Chrome works only in tabs it opened or that the person dragged into its tab group ([support article](https://support.claude.com/en/articles/12012173-get-started-with-claude-in-chrome)). Its exact tool list is not published. Names other than `tabs_context_mcp` and `browser_batch` are inferred.
- The MCP spec's non-normative "Stateful Tools" section says: return an explicit handle (it names "an open browser context"), check authorization on every call, give it a bounded lifetime, and make an expired handle a tool error that says so ([server/tools](https://modelcontextprotocol.io/specification/2026-07-28/server/tools)).

### 4.5 Pages that publish their own tools

Playwright MCP and Chrome DevTools MCP now read "WebMCP" tools: a page registers named tools with schemas, and the agent lists and calls them. Playwright marks their output "page-provided and untrusted" ([webmcp.ts#L157-L183](https://github.com/microsoft/playwright/blob/b4d016aa/packages/playwright-core/src/tools/backend/webmcp.ts#L157-L183)). This is the same idea as `window.desk` acts with a description and a JSON schema. Inferred: if desk acts later register as WebMCP tools too, these clients could drive a desk tab with no relay.

### 4.6 What an LLM reads well

These points come from the sources above and from Anthropic's [Writing tools for agents](https://www.anthropic.com/engineering/writing-tools-for-agents):

1. One line for each element: role, quoted name, state, short id. Names that mean something beat opaque ids.
2. Ids stay stable until the page changes. A stale id is an error that says how to recover.
3. The result says what changed: "navigated to", "page changed", "no change", new elements marked.
4. Blocking state is in every result and names the next step, for example an open dialog and the call that answers it.
5. Return little by default. Let the agent ask for more with depth, a subtree, a filter or a search. Say when output is cut and how to get the rest.
6. One call for related edits, as `fill_form` does: it "reduces turn count".
7. Errors that say what to do, not codes or tracebacks.
8. A short text summary next to the structured data.

### 4.7 What this means for `window.desk` and `fr ui`

- `desk.state()` should be a short tree of lines, not a dump of `doc`: route, page kind, record, unsaved, field errors, open dialogs. It should take a depth or a section to read more.
- Every `run` result should carry `{ok, data, error}` plus `tab`, `route` and the open dialog, if any. An act that opens a confirm returns `{ok: false, error: {code: "waiting_for_user", dialog}}` at once.
- `fr ui` should print a text summary by default and the JSON with `--json`, as Playwright MCP does.
- `fr ui tabs` and a `tab` argument follow `list_pages` and `select_page`. A tab id that is gone is an error that says "call `fr ui tabs`".
