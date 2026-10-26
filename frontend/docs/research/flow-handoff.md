# Research: handing the palette's text to Flow as a new chat

Ticket: [Research: handing the palette's text to Flow as a new chat](https://github.com/frappe/frappe/issues/45260).
Map: [Desk v2 — the command palette: acts, places and records from one key](https://github.com/frappe/frappe/issues/45257), ruling 10.

## Sources

- Repo `frappe/frappe`, branch `desk-v2` at `c3eb3c40e7`. Files:
  - `frappe/flow/launcher.py`
  - `frappe/public/js/flow_launcher.bundle.js`
  - `frappe/hooks.py` (`after_request`, `add_to_apps_screen`)
  - `frappe/flow/api/api.py` (`boot`), `frappe/flow/permissions.py`, `frappe/www/flow/index.py`
  - `frappe/flow/doctype/flow_session/flow_session.json`
  - `flow/frontend/src/router.js`, `flow/frontend/src/chat/FlowPage.vue`, `flow/frontend/src/chat/SetupState.vue`, `flow/frontend/src/settings/GeneralPanel.vue`
  - `flow/harness/ui/core/src/store.js`, `flow/harness/ui/core/src/components/Composer.vue`
  - `flow/package.json`, `flow/harness/ui/core/package.json`, `flow/yarn.lock`, `frontend/package.json`
  - `frappe/shell/__init__.py`, `frappe/shell/boot.py`, `frappe/sessions.py` (`get_session_info`), `frontend/src/boot.ts`
- Site `desk.localhost`, served on port 8000 by the main checkout (`desk-v2` at `c3eb3c40e7`). Checked on 2026-10-26 with a fresh Administrator session (`sid` cookie).

## 1. Does Flow's launcher load on desk v2 pages?

**No.** Desk v2 pages do not get the launcher today.

- `add_to_page` (`frappe/flow/launcher.py`) is an `after_request` hook (`frappe/hooks.py`). It adds the script only when the first path segment is in `get_app_roots()`.
- `get_app_roots()` takes the first segment of each `add_to_apps_screen` route. On `desk.localhost` it returns `{"desk", "crm", "g"}` (frappe `/desk/build`, erpnext `/desk/home`, CRM `/crm`, Gameplan `/g`).
- Desk v2 lives under `SHELL_ROOT = "apps"` (`frappe/shell/__init__.py`). `apps` is not in the set, so `/apps/<prefix>/…` does not qualify.
- Live check, `curl` with the session cookie, counting `<script src="…flow_launcher…">` tags:

  | Path | Status | Launcher tag |
  |---|---|---|
  | `/apps` | 200 | 0 |
  | `/apps/desk` | 200 | 0 |
  | `/apps/desk/user` | 200 | 0 |
  | `/apps/crm` | 200 | 0 |
  | `/desk`, `/desk/user` | 200 | 1 |
  | `/crm`, `/g` | 200 | 1 |
  | `/flow` | 200 | 0 |

- The other conditions of `add_to_page`: a `GET`, status 200, `text/html`, the user can read `Flow Session`, and the user did not hide the icon.
- The check does **not** look at Flow's setup. On `desk.localhost` there is no Flow Provider, no Flow Model and no Flow Agent, and the launcher still loads on `/desk` and `/crm`.

What the launcher does where it loads (`flow_launcher.bundle.js`):

- It adds a `<flow-launcher>` element with an open shadow root: a round icon (draggable, right-click menu "Hide Flow icon") and a panel.
- The panel holds an `<iframe>` of `/flow`. It can float, dock left or right, go full screen, minimize or close. Its layout and the open chat's address persist in `localStorage["flow_launcher"]`.
- `Cmd/Ctrl+I` toggles the panel. It listens on `window` in the capture phase, and leaves the key to rich text (`isContentEditable`).
- In the chat, `Cmd/Ctrl` keys that are not text keys are copied to the page as a `keydown` on the `<flow-launcher>` host. From code reading, `Mod+K` pressed in the chat would reach the page, and so the palette. This was not tried live.
- Its z-index is `1035` on paths that start with `/desk`, else `45`. On `/apps` it gets `45`, below frappe-ui dialogs (`50`). The palette dialog would show above the panel.
- Desk v2 sets `window.csrf_token` (`frontend/src/boot.ts`), which the launcher's "hide" call reads. `window.frappe.ui.toast` does not exist there, so the launcher would use its own toast.
- It runs only in the top window (`window.top === window`).

## 2. What opens a new chat with text in it today

- **`/flow?new=1`** opens a blank new chat. Bare `/flow` reopens the last chat (`FlowPage.vue`, `onMounted`; `NEW_CHAT` in the launcher).
- **No query key carries a first message.** The only query key `/flow` reads for chats is `new`. (`q` and field keys are read only by the settings record lists.)
- **The `/flow` store** (`@flow/ui-core`, `store.js`) has the parts: `startNewChat()`, `send(text)`, and `setDraft(draft)`, a one-way channel the composer reads to fill its box. None of them is on `window`.
- **The launcher has no public API.** It keeps its `FlowLauncher` instance in no global. It sends no events. It listens for one event, `flow-launcher`, on the chat's window; `/flow`'s Settings sends it when the user hides or shows the icon (`GeneralPanel.vue`).
- **What another script can reach today:** only by hacks. It can click the icon through the open shadow root (`document.querySelector("flow-launcher").shadowRoot`). It can write `localStorage["flow_launcher"]` before the launcher loads. The `/flow` iframe is same-origin, but the store is not reachable from it. None of these is documented or stable.

## 3. What gates Flow

- **Permission.** `Flow Session` read is given to the roles `System Manager` and `Flow User` (DocPerms in `flow_session.json`). `has_session_permission` adds owner and share rules for single records. The launcher and `boot()` both check `frappe.has_permission("Flow Session", "read")`.
- **Setup state.** `/flow` shows `SetupState` ("Finish setup to start") and no composer while the user has **no enabled Flow Model or no enabled Flow Agent** visible to them (`needsSetup` in `FlowPage.vue`). `boot()` also sends `has_provider` (any enabled Flow Provider), used only for the setup buttons. Models and agents with roles are filtered per user (`role_query_conditions`). Text handed to `/flow` before setup would land on that empty state and be lost.
- **Hidden launcher.** The user default `hide_flow_launcher` (`launcher.HIDDEN_KEY`) stops the script from loading at all. So a hidden icon today also means no `Cmd/Ctrl+I` and no panel. `/flow` Settings › Flow icon turns it back on.
- **How a page can tell without a request:**
  - Desk v2's boot has `session.roles` and `session.defaults` (`get_session_info`). Roles approximate the permission but miss custom DocPerms. Nothing in the boot tells the setup state.
  - The launcher's presence already proves permission and not hidden, but not setup.
  - No signal today covers all three. The proposal below adds one.

## 4. The smallest change on Flow's side

Three small edits, all in Flow's files:

1. `launcher.py`: add the desk v2 root (`frappe.shell.SHELL_ROOT`, `"apps"`) to the roots `add_to_page` accepts.
2. `flow_launcher.bundle.js`: give the page one documented entry, and a readiness signal (see the proposal).
3. `/flow` (`FlowPage.vue`): accept a first message by address, for example `/flow?new=1&q=<text>`. On mount it starts a new chat, hands `q` to the composer through `setDraft` (or sends it), and removes `q` from the address with `router.replace`. The launcher saves the iframe's address in `localStorage`, so a `q` left in it would come back on the next page.

**Owners.** Flow's code is written almost only by Shrihari Mahabal (GitHub `ShrihariMahabal`):

- `frappe/flow/launcher.py`: 2 of 2 commits (latest `6a4e74ef7a`, 2026-10-23).
- `frappe/public/js/flow_launcher.bundle.js`: 7 of 7 commits (latest `38e5136082`, 2026-10-24).
- `flow/frontend`: 195 of 196 commits (one by Ankush Menat).
- `frappe/flow`: 412 of 418 commits (others: Tanmoy Sarkar, rehanrehman389).

The change must be agreed with him.

## 5. Does Flow's frontend use frappe-ui?

**Yes, but a different version.**

- `flow/package.json` pins `frappe-ui` at `1.0.0` (`yarn.lock` resolves `1.0.0`). `@flow/ui-core` has it as a peer dependency at `1.0.0`. About 50 imports in `flow/frontend/src` and `flow/harness/ui/core/src`.
- Desk v2 (`frontend/package.json`) pins `frappe-ui` at `1.0.2`.
- The two apps build apart and the chat runs in an iframe. Nothing is mounted across them, so the version gap does not matter for a hand-off by event or address.

## Proposal for the call

The palette dispatches one window event, `flow:ask`, with `{ text }` in `detail`. It shows the "Ask Flow: <text>" row only while the launcher has set `document.documentElement.dataset.flow = "ready"`.

On Flow's side, `launcher.py` adds the `apps` root and one attribute `data-ready`. That attribute is true when the user sees at least one enabled Flow Model and one enabled Flow Agent: two `get_list(limit=1)` calls, run only on HTML pages where the script is already added. The launcher sets `data-flow="ready"` from it and listens for `flow:ask`. On the event it replaces its iframe with `/flow?new=1&q=<text>` and opens the panel, as its `close()` already does with `/flow?new=1`. `/flow` reads `q` once, starts a new chat with it, and drops `q` from the address. Prefill or send is for the owner to decide; prefill is safer, because the user sees the text before a model runs.

The event keeps the two apps apart. The palette imports nothing from Flow. Without the launcher (no permission, icon hidden, not set up, or Flow not on the page), nobody listens and the row never shows. A hidden icon then also hides "Ask Flow". The call can keep that, or let the launcher load with no icon for a user who hid it.

The cost on Flow's side: no new cache key. The permission check is the one the launcher already runs. On a full HTML page load for a Flow user, there are two indexed reads. On desk v2 that is once per app load, not per route.
