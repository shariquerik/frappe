# Which apps get a tile on the index, and what each tile shows

Research for [frappe/frappe#45251](https://github.com/frappe/frappe/issues/45251), a child of the map
[#45250](https://github.com/frappe/frappe/issues/45250). Read on 2026-10-26.

## What was read

| Repo | Ref | SHA |
|---|---|---|
| frappe | `upstream/desk-v2` | `78da6b2663592337d2733b5e6b0f58dcbefc446a` |
| erpnext | `desk-v2` (bench checkout) | `d8aeb8b0ed1929c44534c1c4aea7e9a64ddb0d22` |
| crm | `desk-v2` (bench checkout) | `70d47a297308b3ce74e6e63bf7216bd618dfdf15` |
| gameplan | `develop` (bench checkout) | `c643ae8f730e0f25478dad479f92ddf3d0a68cb3` |
| helpdesk | `develop` | `4f41f4c2166cc97fb4d890212e054484840c157d` |
| hrms | `develop` | `f07fd409467a61e414c089d9c87de312afb957de` |
| lms | `develop` | `5d6df8e3ed8eb88f26189fd3eed4b5f7c5904e18` |
| insights | `develop` | `fdd364aa7e0faaf74e90c4137cee41d3471a018d` |
| drive | `develop` | `b2300ffbfbd4be3b7dd8784cb86df15949b84916` |
| builder | `develop` | `10faafe0bc06a25e20d4d29627fcd402b221ee8d` |
| raven | `develop` | `5c0b031e0bdabd882deb7459e7369158d2b2219b` |
| payments | `develop` | `7411976eaefdcb69c06642932e568dbbbc58ec8b` |
| telephony | `develop` | `9447577500a25d242088398157b72c654fa34b20` |

A read-only check ran on `desk.localhost` (active apps: frappe, erpnext, crm, gameplan) as
Administrator and as each enabled user.

## The fact that frames every answer: every active app has a prefix

`build_prefix_registry` gives a prefix to every active app (`frappe/shell/registry.py:39-43`).
An app that declares no `app_prefix` gets `default_prefix(app)`, its name without `frappe_`
(`registry.py:16-28`). `ShellPage.can_render` serves every claimed prefix (`frappe/website/page_renderers/shell_page.py:54-56`).

So, in code today, no app is "an app with its own frontend and no prefix". Gameplan is served at
`/apps/gameplan`. The live registry is `{desk: frappe, erpnext: erpnext, crm: crm, gameplan: gameplan}`.

An app that ships no standard `Rail` record gets a derived rail: every doctype it owns that the user
can read, sorted by name (`frappe/shell/navigation.py:90-91`, `navigation.py:478-492`). On
`desk.localhost`, only ERPNext (`erpnext/erpnext/rail/erpnext/erpnext.json`) and CRM
(`crm/crm/rail/crm/crm.json`) ship a standard `Rail`. Frappe and Gameplan get a derived rail of
doctypes.

`index_boot` lists every registry entry that passes `has_app_permission`, sorted by install order
(`frappe/shell/boot.py:73-99`). On `desk.localhost` it gives four tiles: Framework, ERPNext, CRM, Gameplan.

## 1. Every `add_to_apps_screen` hook

Each app declares exactly one entry. `app_screen` reads only the first entry
(`frappe/shell/boot.py:66`).

| App | File:line | `name` | `title` | `route` | `logo` | `has_permission` | `sequence_id` |
|---|---|---|---|---|---|---|---|
| frappe | `frappe/hooks.py:730-740` | `frappe` | Framework | `/desk/build` (`app_home`) | `/assets/frappe/images/frappe-framework-logo.svg` | `frappe.permissions.check_app_permission` | 1000 |
| erpnext | `erpnext/hooks.py:38-47` | `erpnext` | ERPNext | `/desk/home` (`app_home`) | `/assets/erpnext/images/erpnext-logo.svg` | `erpnext.check_app_permission` | 1 |
| crm | `crm/hooks.py:15-23` | `crm` | CRM | `/crm` | `/assets/crm/images/logo.svg` | `crm.api.check_app_permission` | none |
| gameplan | `gameplan/hooks.py:11-19` | `gameplan` | Gameplan | `/g` | `/assets/gameplan/manifest/favicon-196.png` | `gameplan.api.can_access_gameplan` | none |
| helpdesk | `helpdesk/hooks.py:13-21` | `helpdesk` | Helpdesk | `/helpdesk` | `/assets/helpdesk/desk/favicon.svg` | `helpdesk.api.permission.has_app_permission` | none |
| hrms | `hrms/hooks.py:12-22` | `hrms` | Frappe HR | `/desk/hr-setup` (`app_home`) | `/assets/hrms/images/frappe-hr-logo.svg` | `hrms.hr.utils.check_app_permission` | 2 |
| lms | `lms/hooks.py:357-365` | `lms` | Learning | `/{get_lms_path()}`, default `/lms` | `/assets/lms/frontend/learning.svg` | `lms.lms.api.check_app_permission` | none |
| insights | `insights/hooks.py:23-31` | `insights` | Insights | `/{insights_path}`, default `/insights` | `/assets/insights/frontend/insights-logo.png` | `insights.permissions.check_app_permission` | none |
| drive | `drive/hooks.py:16-24` | `drive` | Drive | `/drive` | `/assets/drive/frontend/favicon-310x310.png` | `drive.api.product.access_app` | none |
| builder | `builder/hooks.py:220-228` | `builder` | Builder | `/{builder_path}`, default `/builder` | `/assets/builder/frontend/builder_logo.png` | `builder.api.check_app_permission` | none |
| raven | `raven/hooks.py:21-30` | `raven` | Raven | `/raven` | `/assets/raven/raven_logo.svg` | `raven.permissions.check_app_permission` | none |

Count: 11 hooks, 11 apps. HRMS and Raven also declare `setup_wizard_text`.

Notes for the tile:

- The LMS, Insights and Builder routes come from site config at import time. Insights says so in a
  comment (`insights/hooks.py:18-21`).
- The tile title is the hook's `title`, not the `app_title` hook. They differ for CRM ("CRM" and
  "Frappe CRM") and frappe ("Framework" and "Frappe Framework").
- v1 translates the title with `_()` (`frappe/apps.py:72`). `app_screen` does not (`boot.py:68`).
- v1 sorts tiles by `sequence_id`, default 100 (`frappe/desk/page/desktop/desktop.js:99`).
  `index_boot` sorts by install order and ignores `sequence_id` (`boot.py:96-97`).

## 2. `app_prefix`, and prefix plus a route outside `/apps`

| App | `app_prefix` hook | Prefix used | Ships a standard `Rail` | Route outside `/apps` |
|---|---|---|---|---|
| frappe | `"desk"` (`frappe/hooks.py:16`) | `desk` | no (derived rail) | `/desk/build` (desk v1) |
| erpnext | none (declares `app_modular = True`, `erpnext/hooks.py:21`) | `erpnext` | yes | `/desk/home` (desk v1) |
| crm | none | `crm` | yes | `/crm` (own UI) |
| gameplan | none | `gameplan` | no (derived rail) | `/g` (own UI) |
| helpdesk | none | `helpdesk` | not read | `/helpdesk` (own UI) |
| hrms | none | `hrms` | not read | `/desk/hr-setup` (desk v1) |
| lms | none | `lms` | not read | `/lms` (own UI) |
| insights | none | `insights` | not read | `/insights` (own UI) |
| drive | none | `drive` | not read | `/drive` (own UI) |
| builder | none | `builder` | not read | `/builder` (own UI) |
| raven | none | `raven` | not read | `/raven` (own UI) |

- Only frappe declares `app_prefix`. No app declares `app_permission`.
- Every app has a prefix. Eight apps also have their own UI outside `/apps`: CRM, Gameplan,
  Helpdesk, LMS, Insights, Drive, Builder and Raven. Three apps route to desk v1: frappe, ERPNext and HRMS.
- Today the code cannot tell a v2 app from an own-UI app by the prefix. The only signal on this bench
  is the shipped standard `Rail` record (ERPNext, CRM). Frappe has no `Rail` and keeps its tile by
  ruling 3.

## 3. Logos

All files were read from the source repo. The hook path is the built asset path.

| App | Source file | Type | Pixel size | Background |
|---|---|---|---|---|
| frappe | `frappe/public/images/frappe-framework-logo.svg` | SVG | viewBox 50x50, no width or height | Rounded square, fill `#7B808A`. Transparent corners. |
| erpnext | `erpnext/public/images/erpnext-logo.svg` | SVG | 118x118 | Rounded square, `#067EFB`. Transparent corners. |
| crm | `crm/public/images/logo.svg` | SVG | 300x300 | Rounded square, `#EF0BF5`. Transparent corners. |
| gameplan | `gameplan/public/manifest/favicon-196.png` | PNG RGBA | 196x196 | Rounded square, orange. 7% of pixels transparent (corners). |
| helpdesk | `desk/public/favicon.svg` | SVG | 118x118 | Rounded square, `#7D42FB`. Transparent corners. |
| hrms | `hrms/public/images/frappe-hr-logo.svg` | SVG | 61x61 | Rounded square, `#06B58B`. Transparent corners. |
| lms | `frontend/public/learning.svg` | SVG | 80x79 (not square) | Rounded square, `#0E7159`. Transparent corners. |
| insights | `frontend/public/insights-logo.png` | PNG RGBA | 235x235 | Rounded square, dark. 4% transparent (corners). |
| drive | `frontend/public/favicon-310x310.png` | PNG RGBA | 310x310 | Rounded square, teal. 4% transparent (corners). |
| builder | `frontend/public/builder_logo.png` | PNG RGBA | 176x176 | Rounded square, blue. 6% transparent (corners). |
| raven | `raven/public/raven_logo.svg` | SVG | 61x61, viewBox 28x28 | Rounded square, black. Transparent corners. |

- Every logo is a full-bleed app icon: a colored rounded square that fills the canvas, with
  transparent corners only. No logo has a transparent field around a glyph. A tile draws the logo as
  is, with no plate behind it. It must not add its own rounded plate or padding.
- The smallest PNG is 176x176. Every logo is sharp up to 88 CSS px at 2x.
- The corner radius differs per logo (17% to 29% of the side in the SVGs). A tile that clips to its own
  radius will cut some logos.
- None of the 11 apps lacks a logo. An app with no `add_to_apps_screen` hook still gets a tile today,
  with `logo: None` and a title made from its module name (`boot.py:64-70`). Payments and Telephony
  have no hook (Telephony's is commented out). LMS requires Payments and Helpdesk requires Telephony.
  So on a site with LMS or Helpdesk, the v2 index shows a "Payments" or "Telephony" tile with no logo.

## 4. What v1 `get_apps` filters that `index_boot` does not

`get_apps` is at `frappe/apps.py:39-82`. `index_boot` is at `frappe/shell/boot.py:73-99`.

| v1 filter | v1 code | In `index_boot` | Applies to a v2 tile? | Reason |
|---|---|---|---|---|
| Setup-wizard gate: hide an app whose setup wizard is not complete, except from a System Manager | `apps.py:47-52` | no | Yes | An app opened before its setup wizard has no defaults, and v2 has no setup wizard of its own to send the user to. |
| Skip `frappe` | `apps.py:54-55` | no, `desk` is listed | No | Ruling 3 keeps the Framework tile on the `desk` prefix. |
| Docked companion apps (`get_docked_apps`, `Dock` mounts) | `apps.py:22-36`, `57-58` | no | Yes, in v2 terms | A companion lives on its host's rail, so its own tile leads to a derived rail of doctypes. In v2 the mount is a `Rail` record with `extends` set (`navigation.py:373`). No app on this bench has one. |
| No `add_to_apps_screen` hook means no tile | `apps.py:60-62` | no, a tile with a made-up title and no logo | Yes | A library app such as Payments or Telephony is not something a user opens. The hook is the app's statement that it has a front door. |
| `has_permission` | `apps.py:65-67` | no, it uses `has_app_permission` | Yes, for a tile that links out to the app's own UI | `has_permission` is the app's own answer for its own route. For a v2 prefix tile, `has_app_permission` is the gate that `/apps/<prefix>` enforces, and ruling 6 hides a tile with nothing to land on. |

## 5. What `has_app_permission` checks

`has_app_permission(app)` reads the app's `app_permission` hook. With no hook, it returns
`default_app_permission()`: the user is not Guest and has `user_type == "System User"`
(`frappe/shell/permissions.py:10-34`). A hook that raises fails closed. The check is keyed by app,
not by prefix. Every app has a prefix, so "an app with no prefix" does not reach this function.

No app read here declares `app_permission`. So, for all 11, the check is "is a System User".

Live result on `desk.localhost`: every System User passes for all four apps. The Website User
`test_mandatory@example.com` fails for all four. `index_boot` also refuses the whole index to a
non-System User (`boot.py:76-77`).

It cannot stand for "the user can open this app" when the app has its own UI:

| Case | `has_app_permission` | The app's own check | Result |
|---|---|---|---|
| Gameplan member. Gameplan roles have `desk_access = 0` (`gameplan/roles.py:38-47`), so members are Website Users. | False | True (`gameplan/api.py:387-401`: a Gameplan role) | No index and no tile, but the user can open `/g`. |
| System User with no Sales role | True | False (`crm/api/__init__.py:55-76`: FCRM module and System Manager, Sales User or Sales Manager) | Tile shown. `/crm` refuses. `/apps/crm` opens with a permission-filtered rail. |
| System User who is not System Manager, on Framework | True | False (`frappe/permissions.py:967-971`: System Manager) | Tile shown, which ruling 3 wants. |
| ERPNext | True for System Users | True for anyone not a Website User (`erpnext/__init__.py:155-164`) | Same answer for System Users. |

So `has_app_permission` answers "may this user load the shell at `/apps/<prefix>`". It is the right
gate for a v2 prefix tile. For a tile that links out to an app's own UI, the gate is the hook's
`has_permission`.
