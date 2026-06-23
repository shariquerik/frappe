# Windows open small, and remember their last size

App windows **open as a small floating window**, never maximized. The one knob is whether a
window **remembers its last geometry** — `state.rememberWindowSize`, on by default:

- **On (default):** a canonical window (`app:<id>`) reopens at the size and position it was
  last left at — including a maximized state the user set. This works because closing a
  window leaves its `state.geo[id]` patch intact, so reopening the canonical id rehydrates
  the last geometry; a never-opened app falls back to the small by-index default
  (`defAppGeo`).
- **Off:** the saved patch is dropped on open, so every window resets to the small default.

Extra instances (`app:<id>#n`, e.g. "open list row in a new window") **always reset to the
small default**, regardless of the toggle, so a freshly-minted twin reads as visibly distinct
from the window already on screen — only the canonical instance carries a remembered size.

The toggle lives in System Settings ▸ General ▸ Behavior and is persisted and hydrated
alongside `rowOpenTarget` (ADR-0018).

## Why

The previous default maximized every app window, so opening any app covered the whole
desktop — at odds with the macOS-style multi-window shell, where windows are movable,
resizable, and stackable. Opening small makes the desktop usable as a desktop; remembering
the last geometry means the user only arranges a window once and finds it that way next time.
An earlier draft modelled this as a three-way `small | remember | maximized` preference, but
"open maximized on every launch" had no real demand and "small" vs "remember" is the only
distinction that matters — so it collapsed to a single boolean.

## Relationship to prior ADRs

- **Builds on ADR-0016.** The canonical/`#n` instance scheme is what lets "remember last"
  key off a stable per-app id while extras stay deliberately small and distinct.
- **Mirrors ADR-0018's preference pattern.** `rememberWindowSize` lives next to
  `rowOpenTarget`: a per-user field on `OsState`, set via a `useOS()` action, persisted and
  hydrated the same way, surfaced in the same Settings ▸ Behavior section.
- **Consistent with ADR-0012.** Geometry remains Surface-agnostic; this preference acts only
  on the geometry layer at spawn time and does not depend on which Surface a window hosts.
