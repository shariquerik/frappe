# Frappe OS — docs

Start with **[`summary.md`](summary.md)** — the living orientation (mental model, store,
routing, file map, gotchas). Everything else is reference or history.

- **[`summary.md`](summary.md)** — orientation; read this first.
- **[`architecture-review.md`](architecture-review.md)** — review vs the bench code
  guidelines (2026-06-17); some findings fixed, OSWindow split + frappe-ui resource
  adoption still open.
- **`adr/`** — architecture decision records (0001–0013): the extensibility design.
- **`design/`** — design sketches:
  - [`surface-and-registry.md`](design/surface-and-registry.md) — Surface model & Registry schema.
  - [`chrome-visual-language.md`](design/chrome-visual-language.md) — the Frappe-native
    chrome look (ground, menu bar, windows, traffic dots, adapt-behind dock, tokens).
- **`plans/`** — work plans, kept for history:
  - [`backend-connection.md`](plans/backend-connection.md) — wiring the live backend
    (Phases 0–5, complete).
  - [`listview-adoption.md`](plans/listview-adoption.md) — frappe-ui `ListView` swap.
  - [`component-feature-folders.md`](plans/component-feature-folders.md) — feature-folder
    reorg (ADR-0013).
