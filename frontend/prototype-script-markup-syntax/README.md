# PROTOTYPE: one Record-page script, four markup syntaxes

Throwaway. It answers one question for the map "Desk v2: components in scripts without
h()" (frappe/frappe#43692): which syntax reads best when an author writes a real
component? The ticket is "Prototype: one real component written with h(), JSX, htm and a
template string" (frappe/frappe#43696). Nothing here ships.

The same Sales Order script is in `scripts/`, written four ways. It adds a panel section
with a status `Badge`, the item rows from `page.doc.items`, one "late" line, and a button
that opens a note dialog with a `Textarea` and a Save button.

| File | Syntax |
| --- | --- |
| `scripts/1-h.js` | `h()`, as a stored script is written today |
| `scripts/2-jsx.jsx` | JSX, automatic runtime (esbuild, `jsxImportSource: "vue"`) |
| `scripts/3-htm.js` | `htm` tagged templates bound to `h` |
| `scripts/4-template.js` | a Vue `template:` string, full Vue build |

## Run it

```sh
cd frontend/prototype-script-markup-syntax
npm install
npm start
open index.html
```

`npm start` runs `check.mjs`, then `page.mjs`:

- `check.mjs` bundles each script, renders the section for three orders (late, completed,
  no items) and compares the HTML. It then mounts the section in happy-dom, clicks "Add
  note", types into the dialog and clicks Save. It fails if any version differs from
  `h()`. The `frappe-ui` components are stand-ins with the same props (`stubs.js`).
- `page.mjs` writes `index.html`: the four scripts side by side, with what each one needs.

The only difference the check found: the template keeps a leading space inside the "late"
line, which a browser does not show. The compare ignores whitespace next to a tag.
