# CRM's record components: framework or CRM

Research notes for frappe/frappe#42549, a child of the record-page map (#42271).
Written 2026-09-07 by reading the code, not by running it.

## What was read, and from where

The ticket names 15 components plus `useRecordPage.ts` and three data modules.
They are on `frappe/crm` branch `feat/crm-frontend2`, which exists in two states:

| Ref | Tip | Date | Record components |
| --- | --- | --- | --- |
| `origin/feat/crm-frontend2` (pushed) | `019643e63` | 2026-08-15 | 14. No `RecordHeaderActions.vue`. |
| local `feat/crm-frontend2` (9 commits ahead, not pushed) | `9d064a58d` | 2026-08-30 | 15. Adds `RecordHeaderActions.vue`, moves the overflow menu's built-ins out of `RecordMenu.vue`. |

The ticket's list of 15 matches the local tip. The nine unpushed commits touch
`RecordHeader`, `RecordHeaderActions`, `RecordMenu`, `RecordTabs`, `RecordPanel`,
`RecordActions`, `DetailsTab`, `useRecordPage.ts` and `recordLayout.ts`, and add
`data/headerMenuOptions.ts`, `data/formTabAnnouncer.ts`, `composables/useRecordActions.ts`
and `composables/useHeaderProjection.ts`. The other eleven components are identical on
both refs.

Citations below use `crm:<path>:<line>` and are against `origin/feat/crm-frontend2`
unless marked `(local)`, which means the local tip `9d064a58d`. Engine citations use
`frappe:<path>:<line>` against `upstream/desk-v2` at `f31836aa21`. `PanelLayout` is
not on `upstream/desk-v2`; where it is cited, the ref is `origin/desk-v2` (the pre-split
line) and it is marked `(pre-split)`.

CRM's `desk-v2` branch (local, `59b1d47aa`, 2026-09-03) has no `frontend2/` directory at
all, so it carries none of these files. The ticket's statement holds.

## The engine's surfaces

The engine's `page` object exposes six surfaces: `quickActions`, `headerActions`, `tabs`,
`panelSections`, `fields` and `formTabs` (`frappe:frontend/src/recordPage/types.ts:339-345`).
The ticket's four words map onto them like this:

- header: `headerActions` (one flat list, projected into buttons and the `⋯` menu's bands
  by `frappe:frontend/src/recordPage/headerRenderings.ts:46-64`) and `quickActions`.
- panel: `panelSections`, consumed by `PanelLayout` (pre-split), which names each section
  by its stored `name` or a slug of its label
  (`frappe:ui/src/experimental/PanelLayout/sectionName.ts:6-8` pre-split).
- tabs: `tabs` (`TabsApi`, `types.ts:67-74`).
- fields: `fields` (`PageFields`, `types.ts:136-144`) and `formTabs`.

The generated page in the framework, `frappe:frontend/src/pages/Record.vue`, renders only
`quickActions` (lines 17-24, 74-77). Nothing in `frontend/src` outside `recordPage/`
consumes `headerActions` or `panelSections` (grep on `upstream/desk-v2`, no matches).
Every other surface has a host only in CRM.

## The shared input every component takes: `RecordChrome`

Thirteen of the 15 take a `chrome: RecordChrome` prop or a slice of it. `RecordChrome` is
defined in `crm:frontend2/src/data/docinfo.ts:100-114`: tags, shared users, assignees,
likers, liked, and the seven mutations that change them. It is built by
`crm:frontend2/src/composables/useDocinfo.ts:185-199` from `getdoc`'s `docinfo` buckets,
kept live over the socket's `docinfo_update` (lines 80-88), and every mutation it carries
calls a frappe endpoint:

| Mutation | Endpoint | Cited |
| --- | --- | --- |
| assign / unassign | `frappe.desk.form.assign_to.add` / `.remove` | `useDocinfo.ts:108-121` |
| addTag / removeTag | `frappe.desk.doctype.tag.tag.add_tag` / `.remove_tag` | `useDocinfo.ts:124-137` |
| toggleLike | `frappe.desk.like.toggle_like` | `useDocinfo.ts:140-145` |
| share / unshare | `frappe.share.add` / `frappe.share.set_permission` | `useDocinfo.ts:148-166` |

None of this is CRM data. The record itself comes from `frappe.desk.form.load.getdoc`
(`crm:frontend2/src/data/resources.ts:25`). The one `crm.api` call in the whole cluster is
the comment composer's `crm.api.comment.add_comment`
(`crm:frontend2/src/components/record/composer/RecordComposer.vue:265`). The list page's
`crm.api.doc.get_data` (`resources.ts:9`) is not used by the record page.

So "CRM-only data" below almost never means a CRM endpoint. It means one of these
CRM-side helpers: the `RecordPageKey` injection (`crm:frontend2/src/data/pageContext.ts:6-7`),
the `PageHeaderPortal` slot mechanism (`crm:frontend2/src/components/PageHeaderPortal.vue`,
18 lines), the `queryCache` (`fetchCached`/`refetchCached`), `doctypeChanged` (a cache
bus), `usePageState` (scroll and draft restore), `usePanelState` (localStorage keys
`crm-panel-width`, `crm-panel-collapsed`, `crm-panel-sections:<doctype>`,
`crm:frontend2/src/composables/usePanelState.ts:24-27`), and the hardcoded tab list in
`recordLayout.ts`.

## The 15 components

### Header row

**RecordHeader.vue** (local 100 lines, origin 82)
Surface: header. On the local tip it feeds the overflow menu's built-ins to
`controller.headerActions.provideBuiltins` (local `RecordHeader.vue:92-94`) and projects
them with `useHeaderProjection` (local 96-99), which calls the engine's
`projectHeaderActions` (`crm:frontend2/src/composables/useHeaderProjection.ts:25` local).
On origin the same feed lives in `RecordMenu.vue:105-107`.
What it renders that is *not* on a surface: the breadcrumbs, a plain `any[]` prop
(`RecordHeader.vue:22`, `:74`) handed to frappe-ui's `Breadcrumbs` through a 14-line
`PageBreadcrumbs.vue`; the favourite star (24-28); and a hardcoded Save button (44-50).
CRM-only: `PageHeaderPortal` (3, 63), which is why the controller is passed as a prop
rather than injected (`RecordMenu.vue:36-38` origin); `RecordPageKey` (67).
Call: **framework**. Every doctype needs crumbs, the `⋯` menu and Save. The charter's
point 4 already rules that each crumb and Save become header items, so the breadcrumb
half is rewritten on the way, not moved.

**RecordHeaderActions.vue** (49 lines, local only)
Surface: header. Renders the engine's `HeaderControl[]` (a button, or a dropdown with
members; `frappe:frontend/src/recordPage/headerRenderings.ts:25-28`) as frappe-ui
`Button`/`Dropdown` (local `RecordHeaderActions.vue:3-29`). Menu rows are spelled by
`crm:frontend2/src/data/headerMenuOptions.ts` (51 lines), a pure function over
`HeaderNode`.
CRM-only: nothing.
Call: **framework**. It is the renderer the engine's projection has no host for.

**RecordMenu.vue** (local 42 lines, origin 181)
Surface: header. Local: a pure renderer of `HeaderBand[]` (local `RecordMenu.vue:24-37`).
Origin: also owns the built-ins, which the local tip moved to
`crm:frontend2/src/composables/useRecordActions.ts` (123 lines): `favourite`, `copy_url`,
`copy_id`, `duplicate`, `page_scripts` (gated on `canWritePageScripts`), `delete`
(origin `RecordMenu.vue:58-103`; local `useRecordActions.ts:34-72`). Duplicate posts
`frappe.client.insert` with `duplicatePayload` (origin 147-149); delete posts
`frappe.client.delete` (origin 169-172).
CRM-only: `doctypeChanged` (origin 151, 173), `usePageScriptsDialog` (origin 45),
`listRoute` built from the doctype only (origin 47), which is CRM's URL scheme.
Call: **framework**. Six generic verbs against frappe endpoints.

**RecordFavourite.vue** (83 lines)
Surface: none of its own; sits in the header row (`RecordHeader.vue:24-28`).
Reads `Liker[]` and `favourited` (`RecordFavourite.vue:78`), both from `docinfo`
(`crm:frontend2/src/data/docinfo.ts:123-135`). The star is a hand-drawn SVG (12-30)
so the stroke can thicken. The same verb also appears as a menu item
(`useRecordActions.ts:34` local), so the record has two favourite controls.
CRM-only: nothing.
Call: **framework**. `toggle_like` is a frappe endpoint and the charter (point 5) already
notes it checks read permission only.

### Quick actions

**RecordActions.vue** (origin 247 lines, local 248)
Surface: `quickActions`. Feeds five built-ins to `controller.quickActions.provideBuiltins`
(`RecordActions.vue:183-184`) and renders `visible()` (186-190) with a fit-to-width
overflow (`useFittedActions`, 197-202). Also rendered vertically in the collapsed rail
(`RecordPanel.vue:19-25`).
Built-ins (140-181): `email`, `comment`, `attach`, `print`, `tags`.
CRM-only: `email` and `comment` call `requestComposer` and jump the reader to CRM's
`emails` or `activity` tab when the current tab has no composer (216-230), using
`EMAILS_TAB`, `ACTIVITY_TAB` and `hasComposer` from `recordLayout.ts` (100-105). `print`
opens `/printview` (`crm:frontend2/src/data/recordActions.ts:38-41`), which is desk v1's
print page. `attach` uses a frappe `upload_file` transport
(`crm:frontend2/src/data/attachments.ts:8-24`). `tags` reads `chrome.tags` (169).
Call: **split**. The row (fit, overflow, tooltips, the surface feed) is framework. The
built-in list is the app's: two of the five assume CRM's tab strip and composer.

### Tabs

**RecordTabs.vue** (origin 163 lines, local 160)
Surface: `tabs`. Feeds `RECORD_TABS` to `controller.tabs.provideBuiltins`
(`RecordTabs.vue:84-87`), renders `visible()` once the first replay has run (91-94),
mounts a scripted tab's `component` with `page` (7-13, 119-123) and a built-in through
`resolveTab(type)` (14-26), fires `on_tab_change` (`onTabChange` on the local tip) on a
change between two shown tabs (100-106), and holds the form's own active tab across the
save that rebuilds the panel (125-146).
CRM-only: the four built-ins, `activity`, `emails`, `files`, `details`
(`crm:frontend2/src/data/recordLayout.ts:35-40`), and the components behind them
(`crm:frontend2/src/data/tabTypes.ts:46-58`). The `?tab=` query key. The `docinfo` and
`feeds.files` props every tab receives (`tabTypes.ts:24-33`).
Call: **split**. The strip and the scripted-tab contract are framework. The built-in set
is per app: `Emails` is CRM's, `Details` is the generic form
(`crm:frontend2/src/components/record/tabs/DetailsTab.vue:4-10` renders
`@framework/ui`'s `FormLayout`), `Activity` and `Files` wrap `@framework/ui`'s
`ActivityTimeline` (`ActivityTab.vue:20-23`, `FilesTab.vue:53-56`).

**RecordFeed.vue** (119 lines)
Surface: none. The scroller a feed tab fills: a centred column, two edge fades, and the
band that floats the composer and a scroll button over the timeline
(`RecordFeed.vue:9-71`).
CRM-only: `useScrollRestore` from `usePageState` (81, 109-114), keyed `scroll:<tab>`;
it mounts `RecordComposer` (39-44).
Call: **CRM**. It is the body of three CRM tabs, not a surface. An app that wants a
timeline tab writes its own body; the framework offers `ActivityTimeline`, not the page
around it.

**RecordComposer.vue** (383 lines)
Surface: none directly. It reads `controller.tabs.visible()` to build the `+` menu from
each tab's `create` action (344-357, `createActions` in `tabTypes.ts:66-82`), which is the
one place the engine's `TabItem.create` (`types.ts:45-46`) is honoured.
CRM-only: `crm.api.comment.add_comment` (265), the cluster's only CRM endpoint; the
email path is frappe's `communication.email.make` (269). Draft restore through
`useRestoredRef` (191), `currentUser` from CRM's session module (180), mention options
(182), localStorage keys `crm-composer-height:*` (295-299), a reply envelope prefilled
from the first `Data/Email` field in the layout
(`crm:frontend2/src/data/composer.ts:76-84`, 128-142).
Call: **CRM**. It wraps `@framework/ui`'s `EmailComposer` and `CommentComposer`
(151-156); the wrapper is the app's. The `+` menu's reading of `tabs.visible()` is the
only piece a framework tab host must keep.

### Panel

**RecordPanel.vue** (144 lines)
Surface: `panelSections`. Mounts `PanelLayout` with `:surface="controller?.panelSections"`
and `:page="controller?.page"` (`RecordPanel.vue:43-51`). Above it, outside the surface,
it mounts `RecordIdentity` (33-39). It owns the width, drag edge, collapse and rail
(3-8, 10-14, `PanelEdge.vue` 70 lines), and `expand`, which sends a field with no honest
panel row to the form (131-136).
CRM-only: `usePanelState` (120-123; localStorage keys named above), `useScrollEdges`,
`DETAILS_TAB` in `expand` (133), which assumes a tab named `details` exists.
Call: **framework**. Map 6's ticket 88 said this shell stays in CRM; the charter's point
1 now says `PanelLayout` is desk layer and moves to `frappe/frontend`, and the shell that
sizes and collapses it has no CRM content. It goes with it.

**RecordIdentity.vue** (101 lines)
Surface: panel, but not on `panelSections`. Fixed markup above `PanelLayout`
(`RecordPanel.vue:33-39`): image, title, subtitle, the quick-action row, tags, then facts
(`RecordIdentity.vue:36-70`). Title and subtitle come from `recordIdentity`
(`crm:frontend2/src/data/recordDoc.ts:35-45`: `meta.title_field`, else `name`); the image
tile shows when `meta.image_field` is set (40).
CRM-only: `doctypeLabel` from `@/data/doctypes` (82, 99).
Call: **framework**, with a condition. As written it is exactly the "hardcoded chrome a
script cannot name" that the map's structural condition forbids. It has to land as
built-in panel items (map 6's ticket 85 was heading there), not as a block above the
list.

**RecordFacts.vue** (39 lines)
Surface: panel (inside identity, fixed). Two labelled rows, "Assigned to" and "Shared
with", on the same 130px grid as `PanelField` so the values line up (32-34).
Reads `chrome.assignees`, `chrome.shared` (10, 21).
CRM-only: nothing.
Call: **framework**. Same condition as `RecordIdentity`: it is two rows that want names.

**RecordAssignees.vue** (122 lines)
Surface: none (a facts row). A `MultiSelect` over stacked avatars; each pick diffs
against the current assignees and emits one `assign`/`unassign` per change (116-121,
`assignmentDiff` in `docinfo.ts:167-172`).
CRM-only: `useUserSearch` (78, 97-98), which itself calls `frappe.client.get_list`
(`crm:frontend2/src/composables/useUserSearch.ts:19`).
Call: **framework**.

**RecordShare.vue** (69 lines)
Surface: none (a facts row). Stacked avatars and a button that opens `ShareDialog`
(`RecordPanel.vue:79-84`, `ShareDialog.vue` 86 lines, `frappe.share.*` through chrome).
CRM-only: nothing beyond `useUserSearch` in the dialog.
Call: **framework**.

**RecordTags.vue** (41 lines)
Surface: none (inside identity). Renders nothing until the record has a tag; from then on
carries its own `+` through `TagPicker` (136 lines) (`RecordTags.vue:1-3`, 25-31). Colour
is a hash of the tag name (`crm:frontend2/src/data/tags.ts:30-35`). While there are no
tags, the `tags` quick action stands in (`RecordActions.vue:169-180`).
CRM-only: nothing.
Call: **framework**.

**RecordImage.vue** (160 lines)
Surface: none (inside identity). Upload, replace or clear the `image_field`, with a
tooltip explaining why it may be read-only (4, `useRecordImage` -> `recordImageField`,
`recordDoc.ts:55-71`: `read_only`, or `fetch_from` without `fetch_if_empty`). Uploads
through `@framework/ui`'s `FileUploadDialog` (101-103).
CRM-only: nothing.
Call: **framework**.

### The host and the data modules

**useRecordPage.ts** (origin 333 lines, local 371)
The host: everything the framework's `Record.vue` (174 lines) does not do.
It calls `createRecordPage` with the real host contract (`useRecordPage.ts:110-130`;
local adds `activateTab`, `formLayout`, `activeFormTab`, `activateFormTab`), loads two
Form Layouts, `Details` and `Side Panel`, with the panel falling back to the form
(59-75), feeds `page.fields` overrides into both (57, 63, 70), builds the breadcrumbs
(169-178), runs `usePageScripts` (105-108), wires field commits to events (133-135),
paints the cached record before the fetched one lands (152-160), and saves through
`frappe.client.save` with a three-way merge on `TimestampMismatchError` (180-296).
CRM-only: route param `id` (49; the framework's page uses `name`,
`frappe:frontend/src/pages/Record.vue:66`); `APP_NAME` plus `useNavigation` for a
saved-view crumb (88-93, 162-167); `routeDoctype`/`doctypeLabel` (95, 173);
`fetchCached`/`refetchCached` (96, 82, 125); `doctypeChanged` (310).
Call: **framework**. The saved-view crumb and the cache layer are CRM's and drop out;
the rest is what the framework host lacks. Compare `frappe:frontend/src/pages/Record.vue:85-137`,
which fetches with `frappe.client.get` plus `getdoctype`, has no docinfo, no layout, no
conflict path, and passes `perms: () => ({})` (122).

**recordDoc.ts** (233 lines)
Pure functions over `getdoc`'s answer: `toRecordPayload` (17-24: `docs[0]`, `docinfo`,
`_link_titles`), `recordTitle` (27-32), `recordIdentity` (35-45), `recordImageField`
(55-71), `fieldDiff`/`collidingFields`/`conflictRows` for the save merge (123-214),
`isTimestampMismatch` (216-218). Imports `displayValue` from `PanelLayout` (3) and the
format defaults from `FormLayout` (4).
CRM-only: nothing. The comment at 184 mentions a Deal; the code does not.
Call: **framework**.

**recordLayout.ts** (origin 55 lines, local 66)
`RECORD_TABS`, the hardcoded four-tab strip (35-40); `DETAILS_TAB`, `ACTIVITY_TAB`,
`EMAILS_TAB` (18-23); `hasComposer` (30-33); `activeTab` (10-15), which the host uses to
answer `page.tabs.active` (`useRecordPage.ts:118-122`); local adds `goToTab`.
`useRecordLayout` ignores its doctype argument (5-7).
Call: **split**. `activeTab`/`goToTab` are host helpers; the tab list and the composer
tab names are CRM's.

**recordActions.ts** (41 lines)
`duplicatePayload` strips the fields the server owns and resets `docstatus` (3-23;
child rows too, 25-36). `printUrl` builds a desk v1 `/printview` link (38-41).
CRM-only: nothing, but `printUrl` points at v1.
Call: **framework**.

## Summary

| File | Lines | Surface | CRM-only data it reads | Call |
| --- | ---: | --- | --- | --- |
| RecordHeader.vue | 100 (82) | header | PageHeaderPortal, RecordPageKey | framework |
| RecordHeaderActions.vue | 49 | header | none | framework |
| RecordMenu.vue | 42 (181) | header | doctypeChanged, list URL scheme | framework |
| RecordFavourite.vue | 83 | header row, no surface | none | framework |
| RecordActions.vue | 248 (247) | quickActions | CRM tab names, composer request, v1 printview | split |
| RecordTabs.vue | 160 (163) | tabs | RECORD_TABS, tab components, `?tab=` | split |
| RecordFeed.vue | 119 | none | usePageState scroll restore | CRM |
| RecordComposer.vue | 383 | reads `tabs.visible()` | `crm.api.comment.add_comment`, session, drafts | CRM |
| RecordPanel.vue | 144 | panelSections | usePanelState, DETAILS_TAB | framework |
| RecordIdentity.vue | 101 | panel, fixed markup | doctypeLabel | framework, as built-in items |
| RecordFacts.vue | 39 | panel, fixed markup | none | framework, as built-in items |
| RecordAssignees.vue | 122 | none | useUserSearch | framework |
| RecordShare.vue | 69 | none | none | framework |
| RecordTags.vue | 41 | none | none | framework |
| RecordImage.vue | 160 | none | none | framework |
| useRecordPage.ts | 371 (333) | host of all six | `id` param, view crumb, queryCache | framework |
| recordDoc.ts | 233 | none | none | framework |
| recordLayout.ts | 66 (55) | tabs | RECORD_TABS | split |
| recordActions.ts | 41 | none | none | framework |

Counts are the local tip's, with origin's in brackets where they differ.
Twelve of 15 are framework, one of them (`RecordIdentity` with `RecordFacts`) only once
it is rewritten as named panel items. Two are split at the built-in list. Two are CRM's:
the feed body and the composer.

## What the proof walk needs

The walk renames a breadcrumb, hides one panel section while its neighbour stands, and
changes one field.

**Rename a breadcrumb.** Today no script can. The crumbs are a prop
(`RecordHeader.vue:22`) built by the host (`useRecordPage.ts:169-178`) and never put on a
surface; `headerActions` holds only the `⋯` menu's verbs. The charter's point 4 fixes
this by making each crumb a header item with `display: 'crumb'`. So the walk needs the
header row (`RecordHeader`, with its breadcrumb half rewritten to read the surface) and
the host's crumb list as built-ins. It does not need `RecordHeaderActions`, `RecordMenu`
or `RecordFavourite`; they can come along, but the walk does not touch them.

**Hide one panel section.** `PanelLayout` already does this: it feeds every visible
section to `panelSections.provideBuiltins` by name
(`frappe:ui/src/experimental/PanelLayout/PanelLayout.vue:66-68` pre-split) and renders
`visible()` (88-91). What the walk needs is `RecordPanel` to mount it, the host's
`Side Panel` layout with its `Details` fallback (`useRecordPage.ts:66-75`), and the
`PanelLayout` port the map already lists. It does not need `RecordIdentity` or anything
inside it: those are not sections and cannot be hidden by name today.

**Change one field.** The `fields` surface is fed into both layouts as `overrides`
(`useRecordPage.ts:57, 63, 70`), and `PanelLayout` renders fields, so the change can be
seen in the panel without the Details tab. If the walk wants to see it in the form,
`RecordTabs` plus `DetailsTab` come in.

Strictly, then: **two of the 15** (`RecordHeader`, `RecordPanel`), plus `useRecordPage.ts`
and `recordDoc.ts` (for `toRecordPayload` and `recordTitle`, which name the crumb), plus
the `PanelLayout` port. `RecordTabs` is optional. The other twelve components are not on
the walk's path. The map's own note still applies: the walk cannot run until the
`Page Script` and `Form Layout` tables land, because the engine reads scripts from a
table `upstream/desk-v2` does not have.

## Against map 6's ticket 88

Ticket 88 (halted) proposed moving `RecordIdentity`, `RecordFacts`, `RecordImage`,
`RecordTags`, `RecordActions` and `ShareDialog` into `frappe/ui`, and keeping
`RecordPanel` and `PanelEdge` in CRM. This reading agrees on the six, disagrees on the
shell: with `PanelLayout` now ruled desk layer (charter point 1), the shell that sizes it
has nothing CRM-specific left and goes with it. Ticket 88's list also put `RecordActions`
whole in the framework; the built-in list inside it is the app's.
