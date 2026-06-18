# Shell reference snapshot

Frozen copies of the four `/x` shell files that `BACKEND_PLAN.md` copies patterns
from. Captured on the `framework2` branch (where `apps/frappe/shell` lives) so the
plan stays self-contained after `frappe-os` moves to a branch based on `develop`,
where `shell/` no longer exists.

| Snapshot file     | Original on framework2              | Used as template for          |
| ----------------- | ----------------------------------- | ----------------------------- |
| `vite.config.js`  | `apps/frappe/shell/vite.config.js`  | `frappe-os/vite.config.js`    |
| `api.js`          | `apps/frappe/shell/src/api.js`      | `frappe-os/src/api.js`        |
| `x.py`            | `apps/frappe/frappe/www/x.py`       | `apps/frappe/frappe/www/os.py`|
| `x.html`          | `apps/frappe/frappe/www/x.html`     | `apps/frappe/frappe/www/os.html`|

These are read-only references — do not edit them. Once Phases 0–1 are ported into
the live `frappe-os` files, this folder is only kept for historical traceability.
