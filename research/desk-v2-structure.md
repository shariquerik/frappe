# Desk v2 structure: layers, concepts, extension points and the import graph

Research for frappe/frappe#43429, a child of the architecture map #43426. This file decides nothing. It gives the facts the architecture map and the interactive diagram prototype (#43434) start from.

- Measured at `desk-v2` commit `6352fefbdf` (the merge of the record page's return-visit build, PR #43382).
- Paths are relative to the frappe repo root.
- Line counts include blank and comment lines and leave out `tests/` folders, stories, `*.test.*`, `*.spec.*` and `*.d.ts` files. This is the same rule as the earlier record-page research (the simplification study, #43383), so its numbers and these can be compared.
- The record page (`frontend/src/recordPage/`, `frontend/src/pages/record/`, `pages/Record.vue`) was measured by #43383 and is not measured again here. It is in the import graph only as nodes and edges, because the diagram needs the whole desk.
- The graph comes from `research/desk-v2-structure/build-graph.mjs`, which writes `research/desk-v2-structure/graph.json`. Run it again with `node research/desk-v2-structure/build-graph.mjs` from the repo root. It needs Node 18 or later and nothing else.

## Method

1. I wrote the graph script and read the import sites it found for every cycle and every layer break.
2. Three read-only agents read the code for the concept and extension-point inventories: one for the client outside the record page, one for the Python shell and the DocTypes, one for the extension points. Each read the code first and only then looked for the ruling behind each item.
3. I checked the layer breaks, the cycles and the DocType count against the code myself.

## A note on how this file was finished

The research agent drafted the full findings, but the disk filled before the draft was saved, and the draft was lost. The parent session wrote the sections below from the agent's summary and from `graph.json`. The numbers are the agent's. Some detail the agent had, for example the full concept table and the file:line of each extension point, is not here. Section 4 and section 5 list counts and examples, not full inventories. The architecture map's report can ask for the full lists if it needs them.

## 1. Size

Line counts from `graph.json`, grouped by the layer each folder was put in by the script.

| Layer in the graph | Folders | Files | Lines |
| --- | --- | --- | --- |
| `ui/src` parts the desk reaches | 22 | 162 | 18,064 |
| Pages (record page and list page folders) | 12 | 130 | 13,748 |
| Desk (shell, list engine, navigation, router, contributions, root modules) | 13 | 53 | 4,758 |
| Python shell, `frappe/shell/` | 14 | 14 | 2,413 |
| Build (the vite plugin folder) | 1 | 10 | 926 |
| Other Python the shell imports (`frappe/boot.py`, `frappe/sessions.py` and others) | 11 | 24 | 12,637 |

`frontend/src` is 183 files and 18,506 lines. The record page is 123 of those files and 13,307 of those lines. Outside the record page:

| Area | Files | Lines |
| --- | --- | --- |
| Shell | 19 | 1,751 |
| List | 10 | 1,343 |
| Navigation | 8 | 536 |
| Router | 7 | 477 |

The graph has 73 folders and 244 edges.

## 2. Cycles

Seven groups of folders import each other. They hold 91 simple cycles.

| Folders in the group | Folders |
| --- | --- |
| 13 | shell, router, list, `pages`, `pages/list`, and all eight `pages/record/*` folders |
| 6 | `ui` Fields, FormLayout, Grid, Link, TableMultiSelect, composables |
| 5 | `frappe`, `frappe/utils`, and the shell's `doctypes.py`, `links.py`, `manifest.py` |
| 3 | `ui` Composer and its comment and email composers |
| 2 | `ui` api and cache |
| 2 | desk contributions and navigation |
| 2 | the shell's `navigation.py` and `navigation_filter.py` |

The group of 13 is the largest. Two loops close it:

- **The route table.** The router imports the pages, and the pages import the router.
- **The composer.** `shell/ComposerWindow.vue`, the window that holds an open comment or email, imports 6 files from `pages/record/composer`. 12 files in that folder import the composer store `shell/composer.ts`.

Four cycles run between single files. None of them is in `frontend/src`. They are in `ui` api and cache (10 files), the Fields and FormLayout types (2 files), the Fields and FormLayout field-type lookup (4 files), and the shell's two navigation Python files.

## 3. Layer breaks

Five import sites in a lower desk folder import a page or the page engine:

| Site | What it does |
| --- | --- |
| `shell/ComposerWindow.vue` | Imports the record page's comment and email writers. |
| `shell/composer.ts:5-6` | Imports page-engine types. |
| `shell/doctypeUpdates.ts:4-5` | Reaches into the form-layout and list-settings folders to clear their caches. |
| `contributions/registry.ts:4` | Calls the page engine directly. |
| `main.ts:16-17` | Does record-page setup by hand. |

Between the two packages:

- Nothing in `ui/` imports from `frontend/`.
- Four `ui` files use the record page's own words. An example is `ui/src/components/FormLayout/resolveLayout.ts:180-195`. This goes against DP1 in `frontend/PHILOSOPHY.md`, the rule to place a module by who it serves: code that speaks the desk's words belongs in `frontend/`.
- 86 of the 159 desk imports into `@framework/ui` skip the package's named exports and reach inner files directly.

## 4. Concepts outside the record page

114 concepts in all.

| Where | Concepts |
| --- | --- |
| Shell | 15 |
| List | 11 |
| Navigation | 9 |
| Router | 11 |
| Contributions and build | 17 |
| Root modules of `frontend/src` | 7 |
| Python shell and build | 34 |
| Server routes that exist only for desk v2 | 10 |

The client has 70 concepts. With the record page's concepts from the simplification research, a new reader of desk v2 meets well over a hundred names.

## 5. Extension points

26 ways found to change the desk. 25 are built: 17 for apps, 6 for site admins, 3 for users. The settings panes were ruled on the root map but never built.

Ten pairs of mechanisms do the same job. Examples:

- A `record.js` file shipped by an app and a stored Client Script both change the record page.
- A field can be hidden three ways: leave it out of the Form Layout, hide it from a script, or set `hidden` in the DocType.
- When two apps ship a renderer for the same navigation kind, the first app wins. When they ship the permission hook for that kind, the last app wins.
- Two lists say what customization code may import: `@shell` for app files, and `import_map` for stored scripts.

## 6. DocTypes

8 DocTypes: 6 new and 2 changed. The names match the DocType register comment on the root map. Five of the register's descriptions differ from the code. The register's section on older DocTypes is out of date since the REST API v2 work.

