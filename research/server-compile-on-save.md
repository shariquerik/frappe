# Can the server compile a stored script's markup on save?

Research for [frappe/frappe#43695](https://github.com/frappe/frappe/issues/43695), a child of the map [#43692](https://github.com/frappe/frappe/issues/43692) (components in Desk v2 scripts without `h()`). Code: `desk-v2` at `31a8407561` (2026-10-01). Machine for timings: Apple M4, macOS, Python 3.14.2, node 24.9.0, esbuild 0.28.1.

## Answer in short

Yes, it can. Node and an esbuild binary are on every standard production setup at request time. One compile from Python takes about 6 ms, so no long-lived process is needed for a save. The weak points are the paths that write a `Client Script` row without calling `validate`, and the question of which tool the server should call.

| question | answer |
| --- | --- |
| Is `node` there at request time? | Yes, on a bench set up by `bench`, in the frappe_docker image, and in the Frappe Cloud image. Each installs node in the place gunicorn runs and starts `node apps/frappe/socketio.js` by default. Frappe already runs `node` from a web request: saving a Website Theme compiles its SCSS with `node generate_bootstrap_theme.js`. One exception: desk-v2 adds a Python realtime server, so a bench could in future run without node after its assets are built. No setup found does this today. |
| Is the esbuild binary there? | Yes, but not where the ticket expected. `apps/frappe/frontend/node_modules` has no esbuild on desk-v2, because vite 8 uses rolldown and oxc. esbuild is in `apps/frappe/node_modules/@esbuild/<platform>/bin/esbuild`, a runtime `dependency` of the old desk bundler. No setup deletes that folder. `apps/frappe/frontend/node_modules` can be deleted by `bench build --cache-key`, so a compile must not depend on it. |
| Time to start one compile from Python | Calling the native esbuild binary directly: 5.6 ms median for a 51-line script, and 5.6 ms for a 530-line one. Through node (`node_modules/.bin/esbuild` is a node script, or a node one-shot with the esbuild or oxc API): 34 to 56 ms, of which 25 ms is node starting. |
| Is a long-lived process needed? | Not for save. A save is rare and 6 ms is small next to the save's own database work. A long-lived node process cuts a compile to 0.08 ms (oxc) or 0.5 ms (esbuild), which would matter only for compiling on every page load. It adds a process per worker to supervise. esbuild's own long-lived mode (`--service`) is a private protocol used by its JS API, not a documented interface for Python. |
| Pure-Python or Python-binding JSX transform | No pure-Python transform handles modern JS. Two small bindings (oxc-py, esbuild-py) are fast (under 1 ms) but are one-person projects with no options, and they turn a syntax error into an empty string. The complete option is an embedded JS engine (mini-racer, which embeds V8, or quickjs-ng) running `@babel/standalone` 7: real `pragma` options and real error messages, 120 to 180 ms to start once per worker, then 2 to 3 ms a compile. dukpy's built-in `jsx_compile` uses Babel 6 and fails on `?.`, `??` and `<>`. |
| Site restored on a bench with no node | A restore pipes the SQL file into the database and runs no document code. Whatever the backup holds is what the site has. If the compiled output is stored in the row, the restored site works with no node. If it is not stored, the site needs node the first time it compiles. |
| Script imported through fixtures | `validate` runs. Fixtures go through `import_doc(..., data_import=True)`, which does not set `ignore_validate`. So a save-time compile runs during `bench migrate` and needs node then. |
| Script imported through a Package | `validate` is skipped. Package Import calls `import_file_by_path` without `data_import`, which sets `ignore_validate`. `before_validate` still runs. |
| Script changed by a patch | Depends on the patch. `frappe.get_doc(...).insert()` or `.save()` runs `validate`. `frappe.db.set_value`, `frappe.db.sql` and `frappe.db.bulk_update` run no document code, so stored output goes stale. |

What this means for the map's decision:

- Compiling on save is possible with tools a bench already has. It adds a hard dependency on a native binary at save time, in the same way Website Theme depends on node.
- Some writers skip `validate`. So the page cannot trust a stored compiled column alone. It needs a check that the compiled output matches the source, for example a hash of the source stored beside it, and a fallback (compile on read, or show an error) when it does not match.
- A save-time compile is a transform outside the vite build. The earlier ruling that one bench has one vite build, and that only stored scripts keep the import map ([#43085](https://github.com/frappe/frappe/issues/43085)), is not changed by it: the compiled output keeps its `import` lines and still runs as a blob-URL module through the import map.
- The fallback must exist anyway for a bench without node. Without it, a save there either fails (as Website Theme does) or stores source the page cannot run.

## 1. Is node, and the esbuild binary, there at request time?

### Frappe already calls node from a web request

| caller | what it runs | when | source |
| --- | --- | --- | --- |
| Website Theme | `node generate_bootstrap_theme.js <out> <scss>` with `Popen`, `cwd` = the frappe app folder. Anything on stderr becomes `frappe.throw`. | `validate`, so on every save of a theme | `frappe/website/doctype/website_theme/website_theme.py:51-53` and `:93-124`; `generate_bootstrap_theme.js` requires `./esbuild/sass_compiler`, which loads `sass-embedded` or `sass` from node_modules |
| Desk architecture page | `node <script> --stdout`, timeout 60 s | a GET of the page, System Manager only | `frappe/website/page_renderers/desk_architecture_page.py:29-44` |

No Python code in frappe calls esbuild at request time. The only other node calls are build commands in `frappe/bundler.py` (`subprocess.Popen` at line 282, `node -v` at line 294).

If `node` is missing, `Popen` raises `FileNotFoundError`, so a Website Theme save fails with a server error. That is the behaviour a save-time compile would copy if it called node the same way.

### Production setups

| setup | node at request time | esbuild binary | source |
| --- | --- | --- | --- |
| Bench CLI (`bench setup production`) | Yes. The ansible role installs node on the host. The supervisor template runs socketio next to gunicorn. | Yes, inferred from source. `yarn install --check-files`, no `--production`. Folders are pruned only by `remove_unused_node_modules`, only with `--cache-key`, only for a sub-folder whose build script has `vite build`. Its docstring says the app's root `node_modules` is never pruned "cause those usually belong to apps that do not have a build step and so their node_modules are utilized during runtime". | [nodejs role](https://github.com/frappe/bench/blob/c9d12503d9d7fbfd94086c3de3cd4ac23dd44823/bench/playbooks/roles/nodejs/tasks/debian_family.yml#L8), [supervisor.conf L118-120](https://github.com/frappe/bench/blob/c9d12503d9d7fbfd94086c3de3cd4ac23dd44823/bench/config/templates/supervisor.conf#L118-L120), [socketio.py L75](https://github.com/frappe/bench/blob/c9d12503d9d7fbfd94086c3de3cd4ac23dd44823/bench/commands/socketio.py#L75), [app.py L961-964](https://github.com/frappe/bench/blob/c9d12503d9d7fbfd94086c3de3cd4ac23dd44823/bench/app.py#L961-L964), [app.py L398, L439-442, L568-605](https://github.com/frappe/bench/blob/c9d12503d9d7fbfd94086c3de3cd4ac23dd44823/bench/app.py#L568-L605) |
| frappe_docker | Yes. Node is installed in the `base` stage and put on `PATH`; the final stage is `FROM base` and copies the whole bench from the builder. Only `.git` folders and `sites/assets` are moved or removed. `backend` (gunicorn) and `websocket` (node) use the same image in separate containers. | Yes, inferred: same `bench init` install, nothing deletes `node_modules`. | [production Containerfile L12, L42-50, L134-148](https://github.com/frappe/frappe_docker/blob/f09126b346c5f04a80068d0e34a0ca7c9fdaddb4/images/production/Containerfile#L42-L50); `images/custom/Containerfile` L46-55, L147-151 and `images/layered/Containerfile` L30-34 do the same |
| Frappe Cloud (press) | Yes. One-stage image, `nvm install` and node on `PATH`. gunicorn and `node .../socketio.js` run in the same container under supervisord. | Yes, inferred: `bench init` and `bench get-app`, no `--cache-key`, no `rm` of `node_modules`. | [press Dockerfile L2, L211, L218, L259, L316](https://github.com/frappe/press/blob/a59fd36e146e33d137ef855c387c51653e793b2f/press/docker/Dockerfile#L211); `press/docker/config/supervisor.conf` L8 and L206-207 |

The esbuild binary is "inferred" because it was read from the image definitions, not checked in a running container.

### Where esbuild is on desk-v2

- `package.json` at the app root lists `"esbuild": "^0.28.1"` under `dependencies` (line 47), not `devDependencies`. It stays even with `yarn install --production`.
- `frontend/` has only `package.base.json`; `bench build` generates `frontend/package.json` from it. It has no esbuild. `vite` 8.1.5 is a devDependency, and vite 8 bundles with rolldown, which ships the oxc transform (`rolldown/experimental` exports `transform` and `transformSync`).
- On this bench, `apps/frappe/frontend/node_modules/@esbuild` does not exist. `apps/frappe/node_modules/@esbuild/darwin-arm64/bin/esbuild` is a native Mach-O binary.
- `apps/frappe/node_modules/.bin/esbuild` links to `esbuild/bin/esbuild`, which on this bench is a node script that starts the native binary. Calling it costs a node start (see section 2). A Python caller should call `@esbuild/<platform>/bin/esbuild` directly, or resolve it the way esbuild's own `lib/main.js` does.

### A bench with no node

- Desk-v2 adds a Python realtime server (`frappe/realtime/server.py`, "Standalone Python Socket.IO realtime server"), and bench can run socketio with `socketio_backend: "python"` ([socketio.py L47, L56-61](https://github.com/frappe/bench/blob/c9d12503d9d7fbfd94086c3de3cd4ac23dd44823/bench/commands/socketio.py#L47)). Then node is needed only to build assets.
- No setup found removes node after the build. But such a bench is now possible, and a save-time compile must say what happens there.

## 2. Time to compile from Python

Method: a small Python harness (shown under "Method and sources") runs each command 30 times with `subprocess.run`, feeding the script on stdin, and takes the median wall time seen by Python. The script is a 51-line `Client Script` (1,557 bytes) with two components, a fragment, a `.map()` list, `?.`, `??` and `async`. The 530-line case repeats the components 12 times (16,407 bytes). Options: classic JSX, factory `h`, fragment `Fragment`.

| path | median | p90 |
| --- | --- | --- |
| native esbuild binary, 51 lines | 5.6 ms | 6.2 ms |
| native esbuild binary, 530 lines | 5.6 ms | |
| `node_modules/.bin/esbuild` (node script that starts the binary) | 34.1 ms | |
| `node` + esbuild JS API, one-shot | 56.2 ms | 61.0 ms |
| `node` + oxc (`rolldown/experimental` `transformSync`), one-shot | 52.3 ms | 54.7 ms |
| `node -e ''` (node start only) | 24.7 ms | 25.8 ms |
| long-lived node, esbuild, per compile | 0.5 ms | 0.8 ms |
| long-lived node, oxc, per compile | 0.08 ms | 0.11 ms |
| long-lived node, start once | 55 to 59 ms | |

- The native binary's time is almost all process start. Script size does not change it in this range.
- A save would add about 6 ms with the native binary. No long-lived process is needed for that.
- A long-lived process would matter only if the compile ran on every page load and was not cached. It needs one process per gunicorn worker, or a shared one with its own supervision, restart and timeout.
- esbuild's JS API keeps the binary running with `--service=0.28.1 --ping` and talks to it over stdin with a binary protocol (`node_modules/esbuild/lib/main.js:2268`). The docs list only three public interfaces: the command line, JavaScript and Go ([esbuild API, Overview](https://esbuild.github.io/api/)). So Python can use the command line, or a node helper, but should not speak the service protocol.
- esbuild's serve mode does not fit. The docs describe it as a web server that "serves your code to your browser", built from entry points on disk. It does not take submitted source. The transform API is the right one: it "transforms a string of code representing an in-memory file in an isolated environment" ([esbuild API, Serve and Transform](https://esbuild.github.io/api/)).

Output (esbuild, trimmed). Imports and `export default` pass through, so the result can still run as a blob-URL module:

```js
import { h, Fragment, ref, computed } from "vue";
...
return () => /* @__PURE__ */ h(Badge, { theme: theme.value, label: props.status });
...
/* @__PURE__ */ h(Fragment, null, /* @__PURE__ */ h("span", null, "Total: ", total.value.toFixed(2)), ...)
```

A syntax error gives file, line, column and a code frame on stderr with exit code 1, for example `bad.jsx:2:13: Unexpected closing "div" tag does not match opening "span" tag`. That text could be shown to the author as the save error.

## 3. Pure-Python and Python-binding JSX transforms

Checked 2026-10-01 against PyPI's JSON API and each project's repository. The working ones were installed in a scratch venv (Python 3.14, macOS arm64) and run on the same kind of script: factory `h`, fragment `Fragment`, with `?.`, `??`, `async`, `import`/`export` and `<>`.

No pure-Python transform handles modern JS. The options that work are native bindings to a Rust or Go compiler, or an embedded JS engine running Babel. Each produces classic `h(...)` calls. None produces Vue's own `_createVNode` output without a node build step.

| package | what it is | latest release | wheels: linux x86_64 / linux aarch64 / mac arm64 | licence | result on the test script | errors | source |
| --- | --- | --- | --- | --- | --- | --- | --- |
| oxc-py | binding to oxc 0.44 (Rust) | 0.1.3, 2025-11-03, 0 stars | yes / yes / yes | none stated | correct. No options: the only call is `transform(src)`. `h` and `Fragment` can be set only with `/** @jsx h */ /** @jsxFrag Fragment */` comments in the source. 0.25 to 0.4 ms a call. | a syntax error returns `''` and prints the message to stdout (checked) | [PyPI](https://pypi.org/pypi/oxc-py/json), [lib.rs](https://github.com/keller-mark/oxc-py/blob/main/src/lib.rs) |
| esbuild-py | esbuild 0.20.2 (Go) built into a shared library, no subprocess | 0.1.6, 2025-11-03, 2 stars | yes / **no** / yes | MIT | correct with the comment pragmas. About 0.2 ms a call, 127 ms to import. | returns `''`, no message. Import fails on Python 3.12+ without setuptools (uses `distutils`). | [PyPI](https://pypi.org/pypi/esbuild-py/json), [bindings](https://github.com/keller-mark/esbuild-py/blob/main/esbuild_bindings.go) |
| mini-racer + `@babel/standalone` 7.29.9 | V8 in Python; Babel loaded as a 3.1 MB script | 0.14.1, 2026-02-01, 219 stars | yes / yes / yes | ISC (Babel: MIT) | correct. `pragma: "h"`, `pragmaFrag: "Fragment"` are real options. Start plus Babel load 180 ms, then 2.3 ms a call. | Babel's message with line and column | [PyPI](https://pypi.org/pypi/mini-racer/json), [repo](https://github.com/bpcreech/PyMiniRacer) |
| quickjs-ng + `@babel/standalone` | QuickJS in Python | 0.16.2.1, 2026-09-01, 7 stars | yes / yes / yes | MIT | correct after a `console` stub. Load 116 ms, then 2.5 ms a call. | Babel's message | [PyPI](https://pypi.org/pypi/quickjs-ng/json), [repo](https://github.com/genotrance/quickjs-ng) |
| dukpy `jsx_compile` | Duktape with Babel **6.26** built in | 0.6.0, 2026-07-23, 534 stars | yes / yes / yes | MIT | **fails**: `?.` gives "SyntaxError: unknown: Unexpected token (1:12)" (checked); `<>` and `??` also fail. It also rewrites `import` to `require`. 82 ms a call. | Babel 6 message | [babel.py](https://github.com/amol-/dukpy/blob/master/dukpy/babel.py) |
| dukpy `JSInterpreter` + `@babel/standalone` 7 | same engine, newer Babel loaded by hand | same | same | MIT | correct. Load 152 ms, then 5.6 to 6.9 ms a call. | Babel's message | same |

Not usable or not relevant:

- oxc-python (tylersatre): parses only, cannot emit JS ([repo](https://github.com/tylersatre/oxc-python)).
- pyswc 0.2.0 (2023): no repository, no description, no aarch64 wheel ([PyPI](https://pypi.org/pypi/pyswc/json)).
- esprima (Python) 4.0.1 (2018): a parser with "experimental" JSX and no code output ([repo](https://github.com/Kronuz/esprima-python)). pyjsparser and js2py: ES5 only.
- quickjs (PetterS): archived. py-mini-racer (sqreen, 2021): replaced by mini-racer.
- python-jsx (tomasr8/pyjsx): lets you write JSX inside Python code; not a JS compiler ([repo](https://github.com/tomasr8/pyjsx)).
- PythonMonkey, stpyv8 (no linux aarch64 wheel) and pyduktape2 (GPL-2.0) could run Babel too; not tested.
- No package named `oxc`, `py-swc` or `sucrase` exists on PyPI. The PyPI names `swc`, `swcpy` and `esbuild` belong to unrelated projects, or to a wrapper that runs the esbuild program.
- Vue's own JSX plugin (`@vue/babel-plugin-jsx` 3.0.0) is CommonJS and depends on Babel 8 packages. Running it in an embedded engine would need a one-time bundle built with node. Not tested ([package.json](https://unpkg.com/@vue/babel-plugin-jsx/package.json)).

What this means:

- The two fast bindings are not fit for a save path. They pin old compilers, have one maintainer each, and drop the error message, so the author would see no reason for a failed save.
- An embedded engine with Babel 7 is complete and needs no node. It adds a Python dependency with native wheels, a 3.1 MB Babel file shipped in frappe, and 120 to 180 ms of start-up in each worker that compiles. Once started, a compile takes about the same time as calling the esbuild binary (2 to 3 ms against 6 ms including process start). Its advantage is that it keeps working on a bench with no node.
- The native esbuild binary is already installed with frappe, has real options and good errors, and needs no new dependency. It does need the binary for the server's platform, which `yarn install` provides.

## 4. Restore, fixtures, packages and patches

How each path writes a `Client Script` row, and whether a hook on save would run:

| path | how it writes | `before_validate` | `validate` | source |
| --- | --- | --- | --- | --- |
| Form save, REST API, `frappe.client` | `doc.insert()` / `doc.save()` | runs | runs | `frappe/model/document.py:1841-1864` |
| Fixtures (`bench migrate`, `install-app`) | `sync_fixtures` → `import_doc(path)` → `import_file_by_path(..., data_import=True, force=True)` → `import_doc` → `doc.insert()` | runs | runs: `ignore_validate` is set only `if not data_import` | `frappe/utils/fixtures.py:16-48`, `frappe/core/doctype/data_import/data_import.py:407-422`, `frappe/modules/import_file.py:203-240` |
| Package Import | `import_file_by_path(file, force=..., ignore_version=True)`, no `data_import` | runs | skipped | `frappe/core/doctype/package_import/package_import.py:89`; Package Release exports every `Client Script` whose `module` is in the package (`package_release.py:86-94`, `module_def.json:91`) |
| Patch using the document API | `frappe.get_doc(...).insert()` / `.save()` | runs | runs, unless the patch sets `flags.ignore_validate` | `document.py:1857` |
| Patch using the database API | `frappe.db.sql`, `frappe.db.set_value`, `frappe.db.bulk_update` | no | no | e.g. `frappe/patches/v13_0/enable_custom_script.py` uses `UPDATE tabClient Script`; `client_script.py:116` `reorder` uses `bulk_update` (it changes only `run_order`) |
| `bench restore` | pipes the SQL file into the database | no | no | `frappe/commands/site.py:247-330`, `frappe/database/db_manager.py` `restore_database` |
| Old `fixtures/custom_scripts/*.js` | not imported; prints "is not supported" | | | `frappe/utils/fixtures.py:51-64` |

Notes:

- `before_validate` runs even when `ignore_validate` is set (`document.py:1853-1858`). A compile in `before_validate` would also cover Package Import. It still would not cover the database API or a restore.
- A fixture compile runs during `bench migrate`, so it needs node at migrate time. On every setup in section 1 that holds.
- `export_fixtures` writes every field of the row. If the compiled output is a field, it goes into the fixture JSON unless it is left out. On import, a save-time compile would overwrite it anyway.
- After a restore, `bench migrate` runs `sync_fixtures` again, so fixture scripts are compiled again on the new bench. Scripts written by users on the old site are not; they keep whatever the backup holds.
- What a restore keeps depends on the design:
  - Compiled output stored in the row: the site works with no node, as long as the page accepts output made by an older compiler. The row needs the compiler version, or a hash of the source, to know when to compile again.
  - Compiled output not stored, only cached: the site needs a compile on first use, so it needs node, or a fallback.
- The same check covers the database-API writers. If the row stores a hash of the source the output was made from, a mismatch means the output is stale.

## Method and sources

- Code read at `desk-v2` `31a8407561`: the files named in each table. Searched `frappe/` for `subprocess`, `Popen`, `check_output`, `shutil.which`, `node` and `esbuild`.
- Production images read at pinned commits: [frappe/bench `c9d1250`](https://github.com/frappe/bench/tree/c9d12503d9d7fbfd94086c3de3cd4ac23dd44823), [frappe/frappe_docker `f09126b`](https://github.com/frappe/frappe_docker/tree/f09126b346c5f04a80068d0e34a0ca7c9fdaddb4), [frappe/press `a59fd36`](https://github.com/frappe/press/tree/a59fd36e146e33d137ef855c387c51653e793b2f).
- esbuild: [API docs](https://esbuild.github.io/api/) (Overview, Serve, Transform, JSX factory and fragment) and the installed `node_modules/esbuild/lib/main.js` 0.28.1.
- Python packages: release dates, wheels and licences from `https://pypi.org/pypi/<name>/json`; behaviour from each repository's source and from running it in a scratch venv. The oxc-py empty-string error and the dukpy `?.` failure were checked twice.
- Timings: run on this machine from scratch files outside the repo. The node helpers import esbuild from `apps/frappe/node_modules/esbuild` and oxc from `apps/frappe/frontend/node_modules/rolldown/dist/experimental-index.mjs`. Neither folder was changed. The harness:

```python
for _ in range(30):
	t = time.perf_counter()
	subprocess.run(
		[ESBUILD_BIN, "--loader=jsx", "--jsx-factory=h", "--jsx-fragment=Fragment"],
		input=SRC, capture_output=True, text=True, check=True,
	)
	samples.append((time.perf_counter() - t) * 1000)
```

  The long-lived case starts one `node worker.mjs` that reads one JSON request per line and writes one reply per line; the first five compiles are a warm-up and not counted.
