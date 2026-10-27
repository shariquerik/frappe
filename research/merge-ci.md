# Merge to develop: does desk-v2 CI prove desk v1 with the setting off?

Question: [frappe/frappe#45485](https://github.com/frappe/frappe/issues/45485), map [#45480](https://github.com/frappe/frappe/issues/45480).

Checked on 2026-10-27 against `upstream/desk-v2` at `8c96392df6` and `upstream/develop` at `2d2094c252`. desk-v2 is 1029 commits ahead of develop and 57 behind (merge base `b9e4d35824`, 2026-10-26).

## Answer

Mostly yes, for MariaDB. The full server suite (with the patch/migration job) and the full UI suite run on the desk-v2 tip every hour, with the same workflow files as develop. The setting is off (`enable_desk_v2` = 0) for all of it, except for a few tests that turn it on and restore it. The latest finished runs on desk-v2 pass. No v1 test is deleted on desk-v2, and no v1 assertion is weakened.

The gaps: Postgres has never run on desk-v2. SQLite runs nowhere. The 57 develop commits that desk-v2 does not have were never tested together with desk-v2.

## How the suites reach desk-v2

- `server-tests.yml` ("Server") and `ui-tests.yml` ("UI") are byte-identical on both branches (`git diff upstream/develop upstream/desk-v2 -- .github/workflows/{server,ui}-tests.yml` is empty).
- Their own `schedule:` triggers fire only on the default branch. desk-v2 gets its runs from `develop-status.yml` ("Develop Tests"): its `cron: "23 * * * *"` job runs `develop_status.py start`. `start_branch` loops over `BRANCHES = ("develop", "desk-v2")` and does `gh workflow run server-tests.yml|ui-tests.yml --ref <branch>` when the branch has new commits that the suite can see (`needs_suite`). These are `workflow_dispatch` runs on desk-v2.
- On a desk-v2 PR, `roulette.py` runs with `SKIP_ON_PRS=true`. `skips_test_suites` returns true for base `develop` or `desk-v2`, so both suites stop unless `tests_requested`. That is true with the `Run Server Tests` / `Run UI Tests` / `run-full-ci` label, with `fixes-develop` while the branch is failing, or (server only, desk-v2 only) when `runs_desk_server_tests` sees a change under `frontend/`, `ui/` or `frappe/**/frontend/`.
- A desk-v2 PR gets a **Desk-v2 status** commit status (`develop_status.py post`). It fails while the latest hourly server or UI run on desk-v2 failed. So a PR cannot merge onto a red desk-v2, but the PR's own code is not tested unless it is labelled.
- On a push or dispatch, roulette writes only `build=strawberry` and never writes `run_postgres` (`if not pr_number: ... sys.exit(0)`). The Integration matrix is therefore `["mariadb"]` on every hourly run on both branches. The comment "Always run against postgres too" in `server-tests.yml` is not true. Postgres runs only on a PR with the `postgres` label.

## The setting during the suites

`enable_desk_v2` is a System Settings Check with `"default": "0"` (`frappe/core/doctype/system_settings/system_settings.json`). Nothing in `.github/` or the CI site setup sets it (`git grep enable_desk_v2 -- .github` is empty; UI site setup only runs `complete_setup_wizard` and `create_test_user`). The tests that change it:

| Test | Value | Restored |
|---|---|---|
| `frappe/tests/test_shell.py` `switch_desk_v2` | 0 or 1 per test | yes, `change_settings` via `enterContext` |
| `frappe/tests/test_utils.py` (get_url_to_form) | 0, then 1 | yes, `with change_settings` |
| `frappe/integrations/.../test_notification_webhook_url.py` | 0 | yes, `enterContext` |
| `playwright/tests/desk_v2_api_calls.spec.js` | 1 (`set_desk_v2`) | `afterAll` sets 0 |
| `playwright/tests/desk_v2_code_editor.spec.js` | 1 | `afterAll` sets 0 |

So every v1 test runs with the setting off, which is the state a develop site gets after the merge. With the setting on, `get_url_to_form` returns `/apps/...` addresses (`frappe/utils/data.py`). The two Playwright specs flip it on their worker's site for the length of the spec. A v1 spec does not run on that site at the same time (`fullyParallel: false`, one worker per site).

## Suites

"Tip" is `8c96392df6` (merge of #45428). Hourly runs are `workflow_dispatch`. PR checks are from the last merged desk-v2 PRs (#45428, #45432, #45434, #45373 and others).

| Suite (workflow / job) | On develop | On desk-v2 push | On desk-v2 PR | Hourly on desk-v2 | Setting | Latest result on desk-v2 |
|---|---|---|---|---|---|---|
| Server tests, MariaDB (`Server` / `Integration (mariadb, 1..2)`) | hourly + labelled PRs | no | only with label or desk frontend change | yes | 0 | pass, both shards (hourly run 40499838779 on the tip) |
| Server tests, Postgres (`Integration (postgres, n)`) | only PRs with the `postgres` label | no | only with the `postgres` label (no desk-v2 PR has had it) | **no** (roulette never outputs `run_postgres` on dispatch) | 0 | **never run** |
| Server tests, SQLite (`SQLite Individual`) | workflow `disabled_manually` | no | no (disabled) | no | - | **never run**; last run anywhere 2026-10-06 |
| Patch / migration tests (`Server` / `Migration`: v14 dump to v15, v16, then this commit) | hourly + labelled PRs | no | with the server suite | yes | 0 | pass (run 40499838779) |
| UI tests, Playwright (`UI` / `UI Test (mariadb, 1..4)`, 124 spec files, develop has 121) | hourly + labelled PRs | no | only with label | yes | 0 (two desk_v2 specs set 1, then restore) | pass, all 4 shards (hourly run 40499847589 on the tip) |
| Studio component tests, Cypress (`UI` / `Studio Component Tests`) | hourly + labelled PRs | no | only with label | yes | n/a (no desk) | pass (run 40499847589) |
| Flow page tests (`UI` / `Flow Page Tests`) | hourly + labelled PRs | no | only with label | yes | n/a | pass (run 40499847589) |
| Frontend unit tests (`Frontend` / `Unit Tests`, desk-v2's `frontend/`) | **does not exist on develop** | yes | on `frontend/`, `ui/`, `frappe/shell/` changes | no | n/a | pass, push run 40496823431 on the tip |
| Linters (`Linters`: Pre-Commit, Semgrep Rules, Semantic Commits, Vulnerable Dependency Check, Documentation Required) | every PR | no | every PR | no | n/a | pass on #45428 (the tip's PR), #45432, #45434 |
| Default JS bundle size (`Compare`) | every PR | no | every PR | no | n/a | pass on #45428 |
| Individual (`run-indinvidual-tests.yml`) | manual only | no | no | no | - | not run on either branch |

Hourly history on desk-v2 today: Server failed at `f7424371aa` and `03b4c8edb9` (two desk-v2-only tests in `frappe/tests/test_shell_navigation.py::TestBootBudget`, `KeyError: 'setup_complete'` in `frappe/shell/boot.py`, not v1), then passed at `edf88d6c87` and `e826529a61`. On the tip (`8c96392df6`), every test job of runs 40499838779 (Server) and 40499847589 (UI) passed. At the time of writing, their `Server Success` / `UI Success` gate jobs were still queued for a runner. UI passed on every hourly run today. develop's latest hourly Server and UI runs (`2d2094c252`) pass.

## v1 tests changed on desk-v2

No test file is deleted on desk-v2 relative to develop (only `ui/src/components/ActivityTimeline/tests/pagination.test.ts`, a desk-v2 file). 14 existing v1 test files are changed: 3295 lines added, 21 removed. The removed lines are imports that moved, `pass` stubs replaced with tests, one renamed sidebar test (`test_the_title_index_catches_a_row_whose_name_has_drifted` became `test_a_title_a_row_has_drifted_onto_is_still_refused`, still asserting `UniqueValidationError`), and `assertEqual(..., 403)` calls that now add the response body as the failure message. `test_utils.py` now wraps the old `/desk/...` `get_url_to_form` assertions in `enable_desk_v2=0` and adds `/apps/...` ones under `=1`. No v1 assertion is weakened.

## Gaps

1. **Postgres.** No server run on desk-v2 has used Postgres. The hourly runs are MariaDB-only on both branches, because roulette writes `run_postgres` only on the PR path. desk-v2 changes about 1000 commits of server code, and none of it is tested on a supported backend. Fix before the merge: open the merge PR with the `postgres` and `run-full-ci` labels, or dispatch the Server workflow with Postgres on desk-v2.
2. **SQLite.** `SQLite Individual` is `disabled_manually` for the whole repo, and the main `Server` workflow has no SQLite job. develop is no better covered. This is not a desk-v2 gap, but SQLite with the setting off is not tested anywhere.
3. **The merge result.** desk-v2 is 57 commits behind develop. The hourly runs test desk-v2, not desk-v2 merged with develop. The merge PR into develop also skips the suites (base `develop`), unless it has a label. Give it `run-full-ci` (and `postgres`) so the merged tree runs Server, Migration and UI once before it lands.
4. **PR-level coverage.** Most desk-v2 PRs merge without their own server or UI run (for example #45367, #45371, #45384, #45387, #45390, #45392 show `Integration: skipping`). The guard is the Desk-v2 status from the next hourly run. A break shows up in the next hour, not on the PR (as with the two `test_shell_navigation` failures today).
5. **Setting on.** No suite runs the whole v1 desk with `enable_desk_v2` = 1. That is outside this question (it is off after the merge), but it is untested if a site turns it on.
6. **Briefing correction.** "Vulnerable Dependency Check fails repo-wide" is out of date. It passes on the latest desk-v2 PRs (#45428, #45432, #45434) and on develop's latest merged PR (#45409).

## Sources

- `upstream/desk-v2` and `upstream/develop`: `.github/workflows/{server-tests,ui-tests,develop-status,frontend-tests,linters,sqlite-individual-tests,run-indinvidual-tests,default-js-bundle-size}.yml`, `.github/helper/{roulette,develop_status}.py`, `.github/CI.md`.
- `gh workflow list -R frappe/frappe -a` (SQLite Individual is `disabled_manually`).
- `gh run list` / `gh run view` for runs 40475462908, 40475468800, 40468688231, 40456291623, 40491822198, 40491830761, 40496823431, 40499838779, 40499847589; `gh pr checks` for desk-v2 PRs #45367 to #45434 and develop PR #45409.
- `git grep -E "enable_desk_v2|set_desk_v2" upstream/desk-v2`.
