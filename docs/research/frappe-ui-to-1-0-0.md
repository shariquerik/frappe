# What frappe-ui still breaks before 1.0.0, against our call sites

Research for frappe/frappe#42722, written 2026-09-10.

## Question

The desk frontend (`frontend/src`) and `@framework/ui` (`ui/src`) are moving from
`frappe-ui` 1.0.0-beta.55 to 1.0.0-beta.63. Tickets #42720 (`ui/`) and #42721
(`frontend/`) hold the call-site census for that window. This file asks what
frappe-ui still plans to change after beta.63 and before the 1.0.0 tag, and which
of it reaches the two trees.

## Where frappe-ui stands

- `main` is `1.0.0-beta.63` plus one commit (`f4dfb481`, a charts colour tweak).
  The changelog at the beta.63 tag is byte-identical to `main`. Everything in the
  changelog's `## Unreleased` head has already shipped in a beta.
  Source: `gh api repos/frappe/frappe-ui/compare/v1.0.0-beta.63...main`.
- The release-candidate ticket (frappe-ui#1029) gates `rc.1` on "every sweep ticket
  closed and every removal and rename landed". Its four original blockers (#877,
  #881, #942, #944) and the three added on 2026-09-03 (#1116 rail rename, #1117
  input sizes, #1118 form typography) are all closed. Those three landed together
  in PR frappe-ui#1133 and shipped as beta.63. Open blockers today: none.
- After `rc.1` is cut, no rename may land. Bug fixes that need no API change may
  land during the one-week soak (crm, helpdesk, gameplan). A break found during the
  soak re-cuts `rc.2`. Source: frappe-ui#1029 body and `v1-release/rc-progress.md`.
- `v1-release/deprecated-removals.md` has one unstruck row, `Input`. That row is
  stale: `Input.vue` no longer exists and `src/index.ts` exports no `Input`
  (frappe-ui#1076, item 3). The deprecation log already lists it as removed.
- Deferred to 1.1 by the RC decision brief: natural-language dates (#1101), `href`
  on rail and sidebar items (#1125), parity additions (#1122), Tag and Notification
  (#1123), PhoneInput (#930), resizable layouts (#542), MultiSelect creation (#809),
  the initializer (#826), data-fetching v3 (#610), and the charts screen-reader
  check (#1036). None of these is a break.

So there is no planned rename or removal left between beta.63 and the tag. What
remains is a set of silent changes: rendered values, behaviour, and typing. The
table lists each one with its source, where it stands, and what it touches here.

## Planned or pending changes after beta.63

Counts are files, taken from the desk-v2 checkout at `438bcdf570` (which matches
`upstream/desk-v2`). "Loud" means the build or `vue-tsc` fails. "Silent" means old
code keeps compiling and renders or behaves differently.

| # | Change | Source | Where it stands | Loud or silent | `frontend/src` | `ui/src` |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Colour token values re-aligned to the Figma palette. Values only, no renames. | [frappe-ui#685](https://github.com/frappe/frappe-ui/issues/685), milestone Version 1.0.0 | Open, no PR, no comments. The chromatic ink scale shift it implies already shipped in beta.43 (#1022). What is left is a value sweep. | Silent (render) | 16 files use `ink-*`, `surface-*` or `outline-*` classes | 95 files |
| 2 | Dark mode `ink-gray-5` and `ink-gray-6` move one step lighter for WCAG AA. Also edits `Dialog.vue`. | [frappe-ui#1090](https://github.com/frappe/frappe-ui/pull/1090) (fixes #1087) | Open PR since 2026-08-13. The RC handoff lists it under "review existing correctness fixes"; not an RC blocker. | Silent (render, dark mode only) | 11 files: `shell/SidebarRow.vue`, `shell/SidebarEdge.vue`, `shell/Unauthorized.vue`, `shell/BootError.vue`, `shell/NotFound.vue`, `pages/Record.vue`, `pages/record/RecordHeader.vue`, `pages/List.vue`, `pages/Home.vue`, `pages/list/DeleteDialog.vue`, `pages/Module.vue` | 67 files |
| 3 | `docStore` cache keyed by the signed-in user's `user_id` cookie, with a purge on user switch. No public API change. | [frappe-ui#1006](https://github.com/frappe/frappe-ui/pull/1006) | Open PR; prioritised in the RC handoff. | Silent (behaviour, `useDoc` only) | 0 (`useDoc` is not imported) | 0 |
| 4 | Visual parity with Espresso 2.0: DatePicker panel width, contiguous range cells, Select max height, MultiSelect trailing check instead of a leading checkbox, Combobox search field, Dialog close button and padding, Dropdown menu padding 6px to 4px, toast icon alignment, Checkbox hover. | [#1119](https://github.com/frappe/frappe-ui/issues/1119), [#1120](https://github.com/frappe/frappe-ui/issues/1120), [#1121](https://github.com/frappe/frappe-ui/issues/1121) | Open, `wayfinder:task`. The decision brief says they do not gate RC. They are bug-fix class, so #1029's policy lets them land during the soak or in a 1.x patch. | Silent (render). Two items in #1121 are still decisions: sorting Dialog actions by theme, and one of the two close-button paths. | Dialog 3, Dropdown 3, toast 6 | Dialog 7, Dropdown 7, Select 13, Combobox 9, MultiSelect 4, TextInput 12, Textarea 1, Password 1, Checkbox 7, DatePicker family 3, toast 8 |
| 5 | `useList` cancels the request on a cache hit, so `loading` and `isFinished` stop cycling on a warm mount. | [frappe-ui#319](https://github.com/frappe/frappe-ui/issues/319), milestone Version 1.0.0, `wayfinder:task` | Open, undecided. The maintainer's 2026-08-07 comment calls it silent and asks for a before/after in `migration.md`. | Silent (behaviour) | 1: `list/useListRows.ts` derives `loading` and `inFlight` from each page's `data == null`, so a cancelled fetch changes when the list settles. Needs a read, not a grep. | 0 |
| 6 | Disabled `TextInput`, `Textarea`, `Password` and `Rating` start dimming their label and description, as the inline controls already do. | `v1-release/rc-progress.md`, "Inputs track result", open question 1 | Recorded as "worth a decision before the tag". No ticket, no PR. | Silent (render) | 0 | 8 files pass both `disabled` and a label to one of these: `Fields/TextField.vue`, `Fields/PasswordField.vue`, `Fields/NumberField.vue`, `Fields/TextareaField.vue`, `Fields/PhoneField.vue`, `Fields/RatingField.vue`, `FileUpload/FileUploadDialog.vue`, `FormLayout/stories/DemoCurrencyField.vue` |
| 7 | `update:modelValue` on Combobox, MultiSelect and MultiEmailInput, and `update:collapsed` on Sidebar and SidebarSection, are still declared twice. If fixed the way #1098 fixed `open` and `query`, the exported `*Emits` interfaces lose those members. | `v1-release/rc-progress.md`, "Open finding for the maintainer" | Not fixed on purpose; the real fix is in the docs generator. Needs a maintainer decision. | Loud in TypeScript only for code that imports the `Emits` interface; runtime events stay | 1: `shell/SidebarRow.vue` uses `@update:collapsed` in a template. A fix makes that listener typecheck; nothing to change. | 0 import an `Emits` type (`ComboboxOption`, `MultiSelectProps`, `MultiEmailInputProps` are the only types imported) |
| 8 | Editor: pasted Google Docs and Drive links stop turning into iframe embeds. | [frappe-ui#1084](https://github.com/frappe/frappe-ui/pull/1084) | Open PR. | Silent (behaviour) | 0 | 2 files build on `RichTextKit`: `Composer/ComposerEditor.vue`, `Composer/types.ts` |
| 9 | Experimental `ListView` row wrapper becomes a `div role="button"` instead of a `button`. | [frappe-ui#1107](https://github.com/frappe/frappe-ui/pull/1107) | Open PR against `frappe-ui/experimental`, outside the freeze. | Silent (DOM) | 0 | 1: `ListView/stories/ListViewToolbar.vue`, which already fails (see below) |
| 10 | Root element access and attribute forwarding made consistent across components. | [frappe-ui#796](https://github.com/frappe/frappe-ui/issues/796) | Open since June, no milestone, no decision. Button's `rootRef` was removed in the beta.63 window instead. | Would be silent (where `class`, `data-*` and listeners land) | Not countable until scoped | Not countable until scoped |
| 11 | `@vueuse/core` dependency moves from `^10` toward `^14` to stop the duplicate reka-ui pulls in. | [frappe-ui#895](https://github.com/frappe/frappe-ui/issues/895) | Open, no decision. | Install-time, not a code break | `frontend/package.json` pins `@vueuse/core ^11.3.0`; a bump would nest a second copy | `ui/package.json` declares `>=10.4.1`, so it follows |

Fixes that are pending but are not breaks: `doctype_subscribe` re-emitted on socket
reconnect (#1105), toasts fired before the Toaster mounts are replayed (#1062), and
accessible names on Dialog, Slider and Progress (#1089, #1039, #1113). The RC handoff
lists all of them for review before the cut.

## Already failing against beta.63 that the census did not list

These are not planned breaks. They are imports in `ui/src` that resolve against
neither beta.55 nor beta.63, found by resolving every named import in both trees
against the packed beta.63 export barrels. #42720 lists only the
`frappe-ui/code-editor` pair and the `xl` story size.

| Import | Removed in | Files on desk-v2 | Files on `upstream/develop` |
| --- | --- | --- | --- |
| `FeatherIcon` from `frappe-ui` | Before beta.55 (PR #983 merged 2026-08-08; beta.55 was published 2026-08-20); replaced by a `lucide-*` string or `Icon` | 9: `SignupBanner/SignupBanner.vue`, `Composer/EmailComposer/RecipientSelect.vue`, `DataImport/DataImportList.vue`, `DataImport/UploadStep.vue`, `DataImport/ImportSteps.vue`, `DataImport/PreviewStep.vue`, `Onboarding/HelpCenter.vue`, `Onboarding/GettingStartedBanner.vue`, `Onboarding/HelpModal.vue` | 10 |
| `PhoneInput` from `frappe-ui` | Never existed at the root; it is open PR #930, deferred to 1.1 | 7: every file under `Phone/stories/` | 7 |
| `ListView`, `ListHeader`, `ListRows`, `ListFooter`, `ListSelectBanner` from `frappe-ui` | Moved to `frappe-ui/experimental` (#985) | 1: `ListView/stories/ListViewToolbar.vue` | 1 |

Every one of these directories is re-exported from `ui/src/index.ts`, so they are on
the path the desk build takes when it imports the `@framework/ui` barrel.

## What this means for the next bump

- The beta.63 pin (#42720, #42721) is the last loud migration before 1.0.0. The RC
  gate has no open blockers, and once `rc.1` is cut the surface is frozen unless a
  break is found during the soak. Plan the 1.0.0 pin as a version-number change plus
  a screenshot check, not a call-site sweep.
- Everything still pending is silent. The before/after screenshot pair that #42721
  already requires for the 13px typography is the right tool; take it again at
  `rc.1`, in both light and dark mode, because rows 1, 2 and 4 all move rendered
  output and two of them are dark-mode heavy.
- Row 5 is the one behaviour change with a real call site. `useListRows.ts` should
  be read against frappe-ui#319 when that ticket gets a decision, not when the
  version bumps.
- Row 7 needs nothing from us. No file imports a `*Emits` interface, and the one
  template listener gains a type rather than losing one.
- Row 11 is worth a line in the pin PR: if frappe-ui bumps `@vueuse/core`, align
  `frontend/package.json` in the same PR so the bundle carries one copy.
- The three "already failing" rows belong on #42720 now. They cost the same kind of
  edit as the `frappe-ui/code-editor` line that ticket already carries, and leaving
  them means the `ui/` barrel still does not build on beta.63 after that ticket
  closes. The `PhoneInput` stories have no target at all until 1.1; they should
  import the local `Phone` component or be deleted.
- `ui/package.json`'s floor should follow the tag: `>=1.0.0-beta.63` now, `>=1.0.0`
  when it lands, per the map's ruling that the floor states what we test against.

## Sources read

frappe-ui `main` at `f4dfb481`: `v1-release/plan.md`, `rc-progress.md`,
`rc-decision-brief.md`, `rc-implementation-handoff.md`, `deprecated-removals.md`,
`checkpoints/{consumer-gameplan,inputs,integration,list,rail}.md`,
`docs/content/docs/changelog.md` (Unreleased head and Deprecation log),
`docs/content/docs/migration.md` headings, `src/index.ts`, `tailwind/migrate-tokens-v2.js`;
issues #864, #1029, #1016, #685, #1087, #319, #796, #1076, #745, #708, #722, #689,
#1119, #1120, #1121, #1125, #1134, #895; PRs #1090, #1006, #1084, #1107, #1133;
the packed `frappe-ui@1.0.0-beta.55` and `@1.0.0-beta.63` tarballs from npm.
