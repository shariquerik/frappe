# What an author loses with each flavour of Vue JSX

Research notes for frappe/frappe#43694 (child of the map #43692, "components in scripts without `h()`").

There are two ways to turn Vue JSX into JavaScript:

- **Babel plugin**: `@vue/babel-plugin-jsx`, used by `@vitejs/plugin-vue-jsx` and by CRM today. It rewrites each element into `createVNode(...)` calls and understands Vue directives.
- **Automatic runtime**: esbuild, Oxc (the transformer inside Vite 8) and sucrase with `jsx: automatic` and `jsxImportSource: "vue"`. Each element becomes `jsx(type, props)`, imported from `vue/jsx-runtime`. Vue's `jsx()` is ten lines: it takes `children` out of the props and calls `h(type, props, children)`. Nothing else is translated.

Short answer: the Babel plugin has six things the automatic runtime lacks: `v-model`, `v-show`, `v-html`/`v-text`, `v-slots`, custom `v-` directives, and merging of `class`/`style`/`onX` after a spread. All of them have a plain-props or `withDirectives` form that works the same in both flavours. The risk is in text that compiles in both flavours but behaves differently, listed in the second section. A `v-` directive in an automatic-runtime script compiles without error and does nothing.

All results below were run, not read off docs. Each case was one JSX text, compiled by every compiler, mounted with Vue 3.5.41 in jsdom, then clicked or typed into. The four automatic-runtime compilers (esbuild, esbuild with `jsxDev`, Oxc, sucrase) gave the same result in every case, except where sucrase failed to compile. `Badge` is the real frappe-ui 1.0.0-beta.29 `Badge.vue`, compiled with `vue/compiler-sfc`. `Button` is a stand-in with frappe-ui Button's real slot names (`prefix`, `default`, `suffix`) and `label` prop, because the real one pulls in vue-router and icons.

## Feature table

"Same" means the same text works in both flavours.

| Feature | Babel plugin: how it is written | Works | Automatic runtime: how it is written | Works |
|---|---|---|---|---|
| Fragment | `<><span>a</span><span>b</span></>` | yes | same | yes |
| `class` and `style` | `class={['a', { b: true }]} style={{ color: 'red' }}` | yes | same | yes |
| `class`, `style` or `onX` after a spread | `<button {...attrs} class="x" onClick={f}>` merges: class is `"from-spread x"`, both handlers run | yes | same text, but the later key wins: class is `"x"`, only `f` runs | differs |
| `onClick` | `onClick={() => n.value++}` | yes | same | yes |
| `onUpdate:modelValue` | `onUpdate:modelValue={(x) => (v.value = x)}` | yes | same text works in esbuild and Oxc. Sucrase fails to compile any `a:b` attribute name. Works in all four: `{...{ 'onUpdate:modelValue': fn }}` | yes (esbuild, Oxc), compile error (sucrase) |
| `v-model` on `<input>` | `<input v-model={v.value} />` | yes | `<input value={v.value} onInput={(e) => (v.value = e.target.value)} />` | yes |
| `v-model` on a component | `<TextInput v-model={v.value} />` becomes `modelValue` + `onUpdate:modelValue`. Must be an assignable expression: `v-model={v}` on a `const` ref throws "Assignment to constant variable" | yes | `<TextInput modelValue={v.value} onUpdate:modelValue={(x) => (v.value = x)} />` | yes |
| `v-model` argument and modifiers | `v-model:title={t}`, `v-model={[v, ['trim']]}` (README; not run) | yes | write the props by hand: `title={t} onUpdate:title={...} titleModifiers={{ trim: true }}` | yes |
| `v-show` | `<div v-show={visible}>` | yes | `withDirectives(<div />, [[vShow, visible]])`, imports from `vue` | yes |
| Custom directive | `<p v-color="red">` resolves `color` by name, so it must be registered (`directives: { color }` on the component, or `app.directive`). A local `const vColor` is not picked up inside a render function | yes, if registered | `withDirectives(<p />, [[vColor, 'red']])` | yes |
| `v-html`, `v-text` | `<div v-html={html} />` becomes `innerHTML` | yes | `<div innerHTML={html} />` (also works in Babel) | yes |
| Default slot | `<Button>Save</Button>` or `<Button><span>Save</span></Button>`, wrapped by the plugin in a slot function | yes | same text renders the same, but children are passed as values. Vue warns "Non-function value encountered for default slot" in development, and the parent re-renders when the slot content's state changes. No warning: `<Button>{() => 'Save'}</Button>` | yes, with warning |
| Named slots | `<Button>{{ prefix: () => <i>P</i>, default: () => 'Save' }}</Button>` | yes | same | yes |
| Named slots via `v-slots` | `<Button v-slots={{ prefix: () => <i>P</i> }}>Save</Button>` | yes | not available. The same text puts `v-slots="[object Object]"` on the element and drops the slots | no |
| Scoped slot | `<List items={items}>{{ item: ({ value }) => <b>{value}</b> }}</List>` | yes | same | yes |
| frappe-ui component (`Badge`, `Button`) | `import { Badge } from 'frappe-ui'`, then `<Badge label="Open" theme="green">{{ prefix: () => <i>*</i> }}</Badge>`. If `Badge` is not imported, the plugin calls `resolveComponent('Badge')`, so a globally registered component still works | yes | same text, but `Badge` must be imported. If it is not, the script throws `Badge is not defined` | yes, if imported |
| `key` | `<li key={id}>` | yes | same, but `key` must come before any spread: `<div {...p} key="k">` makes the compiler import `createElement` from `vue`, which Vue does not export, and the whole module fails to load | yes, if `key` is first |

Things that are the same in both flavours and need no rewrite: JSX text whitespace and entities (`&amp;`, `&nbsp;`), string and number children, scoped and named slots passed as an object of functions, and `ref`.

## Texts that compile in both flavours but behave differently

These matter most, because one syntax must work the same in a stored script and in an app file. None of them gives a compile error in either flavour.

| Text | Babel plugin | Automatic runtime | Form that behaves the same in both |
|---|---|---|---|
| `v-model={...}`, `v-show={...}`, `v-html={...}`, `v-text={...}`, `v-slots={...}`, `v-anything={...}` | Applied as a directive or prop | Passed to `h()` as a plain attribute named `v-model` etc. The element renders, the directive does nothing, and Vue prints no warning | Plain props (`modelValue` + `onUpdate:modelValue`, `innerHTML`), slot objects, and `withDirectives(...)` |
| `<button {...attrs} class="x" onClick={f}>` | `class` and `style` values are merged and both `onClick` handlers run (`mergeProps`, on by default) | Plain object spread: the later `class` and `onClick` replace the earlier ones | Merge by hand: `class={[attrs.class, 'x']}`, or call `mergeProps(attrs, { class: 'x' })` from `vue` |
| `<div>{done && <b>done</b>}</div>` when `done` is `false` and it is the only child | Renders nothing (an empty comment node) | Renders the text `false`. `h()` turns a single child that is not an array, object or function into `String(child)`. The same happens for a lone `true`, and inside a component (`<Button>{done && 'x'}</Button>`) | `{done ? <b>done</b> : null}`. A lone `null` or `undefined` child renders nothing in both |
| `<Badge />` with no `import` for `Badge` | `resolveComponent('Badge')`: works if the component is registered globally, warns otherwise | `ReferenceError: Badge is not defined` | Always import components |
| `<my-widget />` (lowercase name that is not an HTML or SVG tag) | `resolveComponent('my-widget')`: renders a registered component, or the bare element with a warning | Always the bare `<my-widget>` element | Import the component and use its capitalised name |
| `<div {...p} key="k">` | Works | Module fails to load: `The requested module 'vue' does not provide an export named 'createElement'` (esbuild, Oxc, sucrase) | Put `key` before the spread |
| `<Button>{n.value}</Button>` (children of a component that read reactive state) | Children are wrapped in a slot function, so only `Button` re-renders when `n` changes (1 parent render, 2 child renders in the test) | Children are built in the parent's render, so the parent re-renders too (2 and 2), and Vue warns about a non-function slot in development. Output is the same | `<Button>{() => n.value}</Button>` |
| `<use xlinkHref="#icon" />` | Rewritten to `xlink:href` | Left as an `xlinkHref` attribute, which the browser ignores | `href="#icon"` (SVG 2) |

A portable subset follows from this: no `v-` attributes, `withDirectives` for directives, explicit `modelValue` and `onUpdate:...` props, slots passed as functions or an object of functions, every component imported, `key` before any spread, and `cond ? x : null` instead of `cond && x` for a lone child. Text in that subset behaved the same under all five compilers in these tests. The one exception is that sucrase cannot compile `onUpdate:modelValue={...}` written as an attribute; the spread form `{...{ 'onUpdate:modelValue': fn }}` compiles everywhere.

## CRM's setup

- CRM uses the Babel plugin: `crm/frontend/vite.config.js` registers `vueJsx()` from `@vitejs/plugin-vue-jsx` 5.1.6, which bundles `@vue/babel-plugin-jsx` 2.0.1.
- CRM has one JSX file, `crm/frontend/src/utils/dialogs.jsx` (the global dialog list behind `createDialog`).
- It uses one Babel-only feature: `<div v-html={dialog.html} />` on line 29. Compiled with esbuild's automatic runtime, this becomes `jsx("div", { "v-html": dialog.html })`, so a dialog's HTML body would not render.
- It uses `onUpdate:open={...}` on line 21. That compiles in esbuild and Oxc but not in sucrase.
- Its slots are passed as an object of functions (`{{ default: () => [...] }}`, line 23), which works in both flavours.

## Other facts found on the way

- Vue's guide still says "you can't use React's JSX transform in Vue applications" (render-function guide, JSX/TSX section). Vue has shipped `vue/jsx-runtime` since 3.3.0-alpha.6 (changelog: "jsx-runtime: fix automatic runtime implementation", #7959, and "jsx-runtime: handle keys", #7976). The sentence is out of date for basic elements and components, but true for directives and `v-slots`.
- `vue/jsx-dev-runtime` points to the same file as `vue/jsx-runtime` (`vue/package.json` exports), so esbuild's `jsxDev` mode works and behaves the same.
- Vite 8 transforms `.jsx` files with Oxc, not esbuild. Oxc 0.152 behaved the same as esbuild in every case here.
- Sucrase's parser rejects every namespaced attribute name (`a:b=...`). The upstream issue (alangpierce/sucrase#841, "Support JSX xml-namespaced attributes") was closed by the reporter after switching to another compiler, with no fix.
- The Babel plugin's lookup of a local directive variable (`vColor` for `v-color`) checks `path.scope.references`. Babel fills `references` only on the module scope, so the lookup succeeds only for JSX at module top level, where `withDirectives` cannot run anyway. Inside a render function it falls back to `resolveDirective('color')`. The README only documents the registered form.

## Sources

Versions tested: vue 3.5.41, @vue/babel-plugin-jsx 2.0.1 with @babel/core 7.29.7, esbuild 0.28.2, oxc-transform 0.152.0, sucrase 3.35.1, frappe-ui 1.0.0-beta.29.

- Vue automatic runtime: `vue/jsx-runtime/index.mjs` in `frontend/node_modules/vue` (3.5.41), the whole `jsx()` function; `vue/package.json` `exports` for `./jsx-runtime` and `./jsx-dev-runtime`.
- What `h()` does with children: `@vue/runtime-core/dist/runtime-core.esm-bundler.js`: `h()` (line 8531) wraps a lone VNode in an array and passes anything else through; `normalizeChildren()` (line 7991) turns a non-object, non-function child into `String(children)`; `normalizeVNodeSlots()` (line 5364) prints the "Non-function value encountered for default slot" warning. Upstream: `packages/runtime-core/src/h.ts`, `vnode.ts`, `componentSlots.ts` in vuejs/core.
- Babel plugin README: options `mergeProps` (default true) and `enableObjectSlots`; syntax for `v-show`, `v-model`, `v-models`, custom directives and `v-slots`. https://github.com/vuejs/babel-plugin-jsx/blob/main/packages/babel-plugin-jsx/README.md
- Babel plugin source, `@vue/babel-plugin-jsx` 2.0.1 `dist/index.mjs` (in CRM's `node_modules/@vitejs/plugin-vue-jsx/node_modules`): `getTag` (line 88, `resolveComponent` for names not in scope), `dedupeProperties` (line 171, merging `class`/`style`/`on*`), `parseDirectives` and `resolveDirective` (lines 263 and 326; the `path.scope.references` check is line 352), `v-html`/`v-text` to `innerHTML`/`textContent` (line 422), `transformJSXElement` (line 507, children of components wrapped in `{ default: () => [...] }`).
- Babel scope: `@babel/traverse/lib/scope/index.js`, where `registerDeclaration` writes names only to `getProgramParent().references`.
- Vue guide, render functions, JSX/TSX and "Passing slots": https://vuejs.org/guide/extras/render-function.html (source: vuejs/docs `src/guide/extras/render-function.md`).
- Vue 3.3 changelog, jsx-runtime entries under 3.3.0-alpha.6: https://github.com/vuejs/core/blob/main/changelogs/CHANGELOG-3.3.md
- esbuild 0.14.51 changelog, "Add support for React 17's automatic JSX transform" (`jsx`, `jsxDev`, `jsxImportSource`), and 0.15.8, which describes the `createElement` fallback for `{...spread}` followed by `key`: https://github.com/evanw/esbuild/blob/main/CHANGELOG-2022.md
- Sucrase README, `jsxRuntime: "automatic"` and `jsxImportSource`: https://github.com/alangpierce/sucrase#transforms ; namespaced attributes: https://github.com/alangpierce/sucrase/issues/841
- Oxc transform options `jsx.runtime` and `jsx.importSource`: `oxc-transform/index.d.ts` (0.152.0).
- frappe-ui `Badge.vue` and `Button.api.md` (slot names `prefix`, `icon`, `default`, `suffix`) in `crm/frontend/node_modules/frappe-ui/src/components/`.
- CRM: `crm/frontend/vite.config.js`, `crm/frontend/src/utils/dialogs.jsx`.
