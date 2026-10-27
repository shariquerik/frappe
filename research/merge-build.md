# What the always-on shell build costs `bench build`

Research for frappe/frappe#45483 (map frappe/frappe#45480, ruling 4). Facts only; no ruling.

- **desk-v2 side:** `upstream/desk-v2` at `8c96392df6` (2026-10-27).
- **Base side:** `git merge-base upstream/develop upstream/desk-v2` = `b9e4d35824` (2026-10-26).

## What `build_shell` runs

`frappe/bundler.py` on desk-v2, `bundle()`:

1. `setup()` and `make_asset_dirs()` (unchanged).
2. **`build_shell(frappe_app_path, production=mode == "production")`** (new, line 118). It runs before the esbuild pass, with no condition on `--app`, `--apps`, `--using-cached` or any site/bench setting. The docstring says "`--app X` is accepted and ignored". The only skip is when `frontend/package.base.json` is missing.
   1. `frappe.shell.manifest.write()`: reads `sites/apps.txt` and each app's hooks and `desk.package.json`, enforces the singletons and the import map, writes `frontend/manifest.json`, and composes the generated `frontend/package.json` from `package.base.json`. This is Python only and takes well under a second.
   2. `refresh_lockfile()`: copies `yarn.lock.base` to `yarn.lock` if `yarn.lock` is missing or older.
   3. `yarn install --production=false` in `frontend/`, but only if `frontend/node_modules` is missing, the composed `dependencies` changed, or the lock was refreshed. `--production=false` installs the devDependencies too (vite, typescript, eslint, vitest, happy-dom).
   4. Prints `cost_report()` (`apps: frappe` on a v1-only bench).
   5. `yarn build --outDir frappe/public/frontend.staging --emptyOutDir [--mode production]`, then checks that `index.html` exists and calls `swap_shell_assets()`.
3. `yarn run build|production` (the esbuild pass, which also builds `studio/frontend` and `flow/`). Unchanged: `esbuild/`, the root `package.json` and `yarn.lock` have no diff against the base.
4. Back in `frappe/commands/utils.py` `build()`: `build_framework_islands()`, `compile_translations()`, `after_build` hooks. Unchanged.

## Numbers

Measured on this machine (8 cores, 31 GB RAM, shared; load average 2.4–6 during the runs). Every build ran under `nice -n 19`, so the wall times include contention from other sessions. Each side ran from a fake bench at `~/wt/mb-bench-{base,v2}` with `sites/apps.txt` = `frappe` only, `common_site_config.json` = `{"socketio_port": 9000, "webserver_port": 8000}` (production mode, as on Press), and the bench's own `env` with `PYTHONPATH` on the worktree. The command was `python -m frappe.utils.bench_helper frappe build --app frappe`, which is what `bench build --app frappe` runs. The Node version was v24.22.1 and yarn was 1.22.22.

"Shell cold" means that `frontend/node_modules` was missing and all the other `node_modules` (root, `studio/frontend`, `flow`, `island-toolchain`) were warm. The yarn global cache was warm unless the row says otherwise.

### `bench build --app frappe`, wall time

| Case | Base (`b9e4d35824`) | desk-v2 (`8c96392df6`) | Delta |
|---|---|---|---|
| Warm, production | 53.7, 49.6, 47.8, 47.4 s (median 48.7) | 63.1, 62.1, 60.4 s (median 62.1) | **+13 s (+27%)** |
| Warm, `developer_mode: 1` | 49.1, 48.0 s | 63.1, 61.4 s | **+14 s** |
| Shell cold, production, warm yarn cache | 47.4–48.7 s (no shell) | 80.2 s | **+32 s** |
| Everything cold (first build of the worktree) | not comparable (see note) | 170.0 s | — |
| CPU (user + sys), warm | ~93 s | ~126 s | +33 CPU-s |
| Peak RSS, warm | 2.7–3.0 GB | 2.8–2.9 GB | no change |

Note: the base side's first two runs failed on fake-bench setup (the studio build needs `socketio_port` in `common_site_config.json` and an `apps/frappe` path that is not a symlink). Because of this, the base side has no clean "everything cold" number. The shell's share of the desk-v2 cold run comes from its log: install 37.3 s and vite 13.8 s.

### The shell steps alone (from the yarn logs and direct runs in `frontend/`)

| Step | Time |
|---|---|
| `manifest.write()` + `cost_report()` | < 1 s |
| `yarn install --production=false`, warm yarn cache | 18.5–20.5 s (19.2 s inside `bench build`) |
| `yarn install --production=false`, warm cache, `--offline` | 18.5 s (succeeds: no network needed if the cache has every package) |
| `yarn install --production=false`, **empty** cache (`YARN_CACHE_FOLDER` empty) | **34.2 s**, fills 901 MB of yarn cache |
| `yarn install --offline` with an empty cache | fails: `Can't make a request in offline mode` |
| `yarn build` (vite 8.1.5, 3,206 modules) | 13.1–13.8 s; vite reports "built in 12.1–12.7 s" |
| Failing vite build (forced error) | whole `bench build` exits 1 after 6.9 s |

### Sizes

| What | Size |
|---|---|
| `frontend/node_modules` | **412 MB** on disk (325 MB apparent), 277 top-level entries |
| Largest entries in it | `@rolldown` 37 MB, `typescript` 23 MB, `happy-dom` 19 MB, `frappe-ui` 9.4 MB, `eslint` 3.9 MB, `@codemirror` 3.8 MB |
| Yarn cache filled by a cold install | 901 MB (`~/.cache/yarn` by default) |
| `frappe/public/frontend/` (built shell) | **21 MB**, 208 files |
| … of which JS + CSS | 4.34 MB raw, **1.29 MB gzip** |
| … of which source maps | 90 `.map` files, 15.7 MB |
| v1 assets (`frappe/public/dist`) | 55 MB on both sides; `frappe/public` without `frontend/` and `node_modules` differs by 240 KB |

## Failure modes

Code read: `frappe/bundler.py` `bundle()` and `build_shell()`, and `frappe/commands/__init__.py` `popen()`. A forced vite error confirmed the behaviour.

- **Order.** `build_shell()` runs before the esbuild `popen`. Every step that can fail raises: `SingletonConflict`, `DeclarationError` and `ImportMapConflict` from the manifest, `CalledProcessError` from `yarn install` and `yarn build` (both `raise_err=True`), and `RuntimeError` when no `index.html` is produced. Nothing catches these in `bundle()` or in `commands/utils.py` `build()`.
- **So a failed shell build fails the whole `bench build`, and esbuild does not run.** The forced error (a syntax error appended to `frontend/src/main.ts`) gave exit code 1 after 6.9 s, with `CalledProcessError: Command 'yarn build --outDir …/frontend.staging --emptyOutDir --mode production'`. The log has no esbuild `DONE` line. `sites/assets/assets.json` kept its earlier mtime. `build_framework_islands()`, `compile_translations()` and the `after_build` hooks did not run either.
- **v1 assets left in place: yes, on a bench that built before.** esbuild never started, so `frappe/public/dist` and `assets.json` from the last good build are untouched. The v1 desk keeps working, but on old assets: the v1 changes in that pull are not built.
- **On a bench that never built** (a fresh `bench init`, a fresh image), the same failure leaves **no v1 assets at all**. Code read only: `bench init` calls `build_assets()` → `exec_cmd("bench build")`, which raises on a non-zero exit.
- **The old shell is kept.** Vite writes only into `frappe/public/frontend.staging`. The swap runs only after a zero exit and an `index.html` check. The forced error left `frappe/public/frontend/index.html` byte-identical (same md5) and no `frontend.staging` directory. If vite had written part of a tree before it failed, `staging` would be left on disk until the next build, which removes it first (`shutil.rmtree(staging)`).
- **The swap.** `swap_shell_assets()` renames `frontend` → `frontend.previous` and `staging` → `frontend`, then deletes `previous`. On overlayfs (a directory from an earlier image layer) the rename fails with `EXDEV`. The code then falls back to `overlay_shell_assets()`, which copies over the old tree and deletes the stale files.
- **A missing or failing `yarn install`** (no network and no cache, or a registry error) fails the build the same way, before vite and before esbuild.
- **The install trigger misses some changes.** `compose_package_json()` compares only `dependencies`, so a change to devDependencies in `package.base.json` alone does not reinstall. The install runs again only when `yarn.lock.base` is newer than `yarn.lock`, which is what `base-lock.sh` produces.

## Which commands reach `build_shell`

| Command | Reaches `build_shell`? | Source |
|---|---|---|
| `bench build` (all apps) | Yes, once | `bundle()` line 118 |
| `bench build --app <any app>` / `--apps a,b` | **Yes**, a full shell build, the same as for frappe | `bundle()` has no `apps` check; docstring "`--app X` is accepted and ignored" |
| `bench build --using-cached` / `USING_CACHED=1` | Yes (only esbuild's `--run-build-command` is skipped) | `bundle()` |
| `bench get-app X` / `bench install-app` path in bench CLI | Yes, through `build_assets(app=X)` → `bench build --app X` | `bench/app.py:969` |
| `bench update`, `bench init` (unless `--skip-assets`) | Yes, through `build_assets()` | `bench/commands/update.py:79`, `bench/utils/system.py:112` |
| `bench watch` | **No.** `watch()` starts the esbuild, island and studio watchers only; nothing calls `build_shell` | `bundler.py` `watch()` |

The only caller of `build_shell` in the repo is `bundle()` (`grep -rn build_shell`).

A full `bench build` on a bench with more apps was not measured. The main bench is shared, and its other apps' build commands write into their own source trees. From the code, the shell part does not depend on the app count on a v1-only bench: it runs once per `bench build` invocation, and an app without `desk.package.json` adds no packages. The esbuild part is identical code on both sides. So the expected delta for a full build is the same +13 s warm / +32 s shell-cold. **Each extra `bench build --app X` invocation pays the vite build (~13 s) again.**

## Frappe Cloud and frappe_docker (code paths only)

### Files the build generates

`frontend/package.json`, `frontend/yarn.lock`, `frontend/manifest.json`, `frontend/node_modules` and `frappe/public/frontend` are all gitignored (`.gitignore` lines 211–221). A fresh clone has only `package.base.json` and `yarn.lock.base`. The first `bench build` generates the rest, and the guard (`package.base.json` exists) passes, so a fresh clone always builds the shell.

### Network

`bench setup requirements` / `update_yarn_packages()` in the bench CLI runs `yarn install` only in the app root (`apps/frappe/package.json`), never in `frontend/`. The shell's `yarn install` therefore happens **inside `bench build`**, at image build time. It needs the npm registry unless the yarn cache already holds every package. A warm cache works with `--offline`; an empty cache fails.

### Frappe Cloud (Press)

Source: `frappe/press` `press/docker/Dockerfile` and `frappe/agent` `agent/build_configs/get_cached_app.py`.

- frappe is installed with `bench init --frappe-path file:///…/apps/frappe`. This runs `build_assets()`, which is a full `bench build`, with `apps.txt` = frappe only. Cold shell: install plus vite.
- `common_site_config.json` is Press's fixed file. It has no `developer_mode`, so the build is production mode. The shell's vite config reads no site config.
- Each RUN mounts `--mount=type=cache,target=/home/frappe/.cache`, and the yarn v1 cache lives under `~/.cache/yarn`. The shell install can therefore reuse packages from earlier builds on the same builder. A new builder, or a cache eviction, means an empty-cache install (34 s here, plus registry download time).
- For each other app, either:
  - **No cached assets:** `bench get-app file:///…` runs `bench build --app <app>`, which rebuilds the shell. That is about 13 s of vite per app, plus an install if the app's `desk.package.json` changes the dependencies. **An image with N non-frappe apps runs the shell build N+1 times.**
  - **Cached assets** (`get_cached_app.py`): runs `bench get-app --skip-assets` and extracts the stored tarball. No `bench build`, so no shell rebuild. On a cache miss it falls back to `bench build --app <app> --production`, which rebuilds the shell.
- Only the last shell build survives in `frappe/public/frontend`. The `apps.txt` that the manifest reads grows as the apps are added (Press copies its final `apps.txt` only at the end), so the last full build sees all the apps. With cached apps, the shell is never rebuilt after their install. Their desk v2 contributions are then not in the shell. This does not matter for v1-only apps.
- `FRAPPE_DOCKER_BUILD` is set, and esbuild uses it to skip the Redis update. `build_shell` does not read it.
- The `frontend/node_modules` (412 MB) stays in the image layer of the `bench init` step. Nothing removes it.

### frappe_docker

Source: `frappe/frappe_docker` `images/production/Containerfile` and `images/custom/Containerfile`.

- `bench init --frappe-branch … --frappe-path …`, then (production image) `bench get-app … erpnext`, or (custom image) `bench init --apps_path=apps.json`. The shell build runs in `bench init` and again for each `get-app` that builds assets.
- The yarn cache is **not** a cache mount, so every image build is an empty-cache install that needs the registry (34 s here plus download).
- The builder stage copies the whole bench into the final image (`COPY --from=builder … /home/frappe/frappe-bench`) and removes only `.git` directories. **`frontend/node_modules` (412 MB) ships in the final image**, and so does `frappe/public/frontend` (21 MB, 15.7 MB of it source maps). The yarn cache in `~/.cache` stays behind in the builder stage.
- The `FRAPPE_BRANCH` default is `version-16`. The shell build reaches frappe_docker only for a branch that has the merge (develop, or a later version branch).

## How to reproduce

```bash
git -C apps/frappe worktree add <bench>/apps/frappe -b … upstream/desk-v2   # a real apps/frappe path, not a symlink
mkdir -p <bench>/{sites/assets,config}; echo frappe > <bench>/sites/apps.txt
echo '{"socketio_port": 9000, "webserver_port": 8000}' > <bench>/sites/common_site_config.json
(cd <bench>/apps/frappe && yarn install --frozen-lockfile)
cd <bench>/sites && FRAPPE_BENCH_ROOT=<bench> PYTHONPATH=<bench>/apps/frappe \
  nice -n 19 /usr/bin/time -v ~/frappe-bench/env/bin/python -m frappe.utils.bench_helper frappe build --app frappe
```
