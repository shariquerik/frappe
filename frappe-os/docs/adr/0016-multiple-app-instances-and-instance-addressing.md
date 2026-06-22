# Multiple windows per app, addressed by a reserved `?instance=n` query

An app may have **multiple concurrent windows** (File ▸ New window), not one per app as
the POC assumed. Each is an **instance**. The first ("canonical") owns the bare window id
`app:<id>` and the bare path `/os/<app>`; extras get `app:<id>#n` (n ≥ 2) and are addressed
by a reserved `?instance=n` query on the same path.

Decision: the URL **addresses the focused window's Surface (its content), not the window**.
A path names content; two windows showing the same Surface share a path. To keep them
individually addressable we add one OS-reserved query key, `instance`, present **only** for
non-canonical instances — so single-window URLs, deep-links, and the `/app/...` interop are
byte-for-byte unchanged, and a twin (and only a twin) carries `?instance=n`. Resolution of a
bare path is **canonical-first**: `/os/<app>` focuses the canonical instance when it exists,
falls back to a surviving twin only when it doesn't (so closing the canonical never spawns a
blank one on reload), and mints the canonical otherwise.

Because each instance is a distinct fullPath (`/os/crm` vs `/os/crm?instance=2`), a focus
switch between twins pushes a real timeline entry, so browser back/forward toggles them, and
a reload restores the exact instance.

## Considered options

- **A per-window segment in the *path*** (e.g. `/os/crm/2/...`) — rejected: it puts window
  (container) identity into what is otherwise a content address, complicating every
  deep-link, share-link, and the `/app/...` translation, and changing the canonical URL for
  the overwhelmingly common single-window case.
- **Uniform, non-privileged instance ids** (every window `app:<id>:<seq>`, none canonical) —
  rejected: superficially cleaner, but it removes the deterministic target a deep-link /
  cold-boot resolves to (relocating the "which instance?" question rather than answering it)
  and forces a migration of existing `app:<id>` deep-links and persisted sessions.
- **Distinguish instances only in `history.state`, keeping the URL identical** — rejected:
  requires bypassing vue-router with raw `history.pushState`, which clobbers vue-router's own
  history bookkeeping. If two windows are navigable in history they are addressable, so the
  discriminator belongs in the URL, not in invisible state.

## Consequences

- `instance` is an **OS-reserved query key**: apps and (future) list-filter-in-URL state must
  not use it. The projection returns a structured `{ path, query }` location so the key
  composes with any future store-derived query instead of being string-concatenated.
- The canonical instance is **deliberately privileged** (owns the bare id and path). This
  asymmetry is the cost of leaving the common case untouched; it is intentional, not a wart.
- **Out of scope (deferred):** pop-out (`rec:`) windows are a separate id space and are *not*
  yet toggle-able via back/forward the way instances now are — they share a path with their
  inline form and rely solely on `history.state.osWin`. Folding pop-outs into the same
  addressing model is a distinct decision left to a later session.
