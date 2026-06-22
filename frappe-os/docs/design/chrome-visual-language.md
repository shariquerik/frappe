# Chrome visual language — Frappe-native desktop

> **Status:** implemented. This is the agreed look for the OS chrome (menu bar, windows,
> dock, ground), folded in from a throwaway prototype that was grilled decision-by-decision
> on live pixels (the prototype + its `NOTES.md` verdict were deleted after folding — this
> doc is their permanent home). Mechanical restyle only; it does not change the store,
> routing, or the Surface/Action models.

## Through-line

**Keep the OS structure — menu bar + floating windows + dock — but break every macOS
*material* tell.** Light, opaque frappe-ui "Frappe card" windows float on a colored ground;
nothing uses vibrancy/blur as its primary surface. Identity is the type *system* (Inter /
frappe-ui default), not a foreign display face. Styling rides frappe-ui CSS tokens
(`--surface-*`, `--ink-*`, `--outline-*`, `--shadow-*`); only genuinely token-less,
design-specific values become named custom properties (see **Tokens**).

## Ground — "Product Duotone"

The default wallpaper is a colored (not neutral) gradient, ERPNext indigo → CRM teal:

```
radial-gradient(150% 130% at 12% -10%, #5b54e6 0%, #2c3a9e 42%, #0f7d78 100%)
```

It lives as the first entry in `wallpaperDefs()` (`desktop/windows.ts`, `id: 'duotone'`,
`dark: true`) and is the default (`currentWp` falls back to `'duotone'`). It is *not*
hardcoded in `App.vue` — the desktop binds `currentWp.bg`, so the ground stays swappable in
the wallpaper picker and `wp.dark` drives the adaptive chrome below.

## Adaptive chrome over the wallpaper

Chrome that sits over the wallpaper flips its ink with the wallpaper's darkness
(`os.currentWp.value.dark`): white ink + a dark top scrim on dark grounds, `ink-gray-8` +
a faint light scrim on light grounds. This is why a colored *or* a light wallpaper both
read.

- **Menu bar** (`components/MenuBar/MenuBar.vue`): transparent + soft top scrim (no frosted
  glass, no bottom hairline). The bar only ever sits over the wallpaper (windows start below
  it at `TOP=32`), so wallpaper darkness alone decides legibility. Menu buttons keep a
  full-height hit area (reaches the top screen edge) but render their hover highlight as an
  **inset `before:` pseudo-element** (`isolate` + `before:-z-10`), so the pill no longer
  fills the whole 32px bar height.

## Windows — "Frappe card"

`components/Window/OSWindow.vue` (frame) + `WindowChrome.vue` (title bar).

- **Frame:** light, opaque `surface-base`; **10px** radius; `overflow-hidden` so the body
  clips to the radius. A constant hairline ring (`ring-1 ring-black/10`) is **folded into
  the box-shadow** (`0 0 0 1px rgba(0,0,0,0.1), …`) — an inline `box-shadow` overrides a
  Tailwind `ring-*` class, so they cannot coexist as separate properties. Focus-dependent
  contained drop shadow: active `0 16px 40px -16px rgba(20,16,50,.45), 0 4px 12px -6px
  rgba(0,0,0,.25)`, inactive `0 10px 28px -18px rgba(20,16,50,.35)`. Maximized/split windows
  drop the radius/shadow and fill.
- **Title bar:** solid `#f8f9fc` (a slightly cooler tint than `surface-gray-1`/#f8f8f8;
  kept literal to match the judged pixels) with an `inset 0 -1px 0 rgba(0,0,0,.06)` hairline
  instead of a border.
- **Window controls (traffic dots):** three dots on the LEFT — close / minimize / zoom.
  Neutral `surface-gray-5` at rest with **no glyph**; on title-bar **group-hover** each fills
  with its semantic espresso token (`surface-red-6` / `surface-yellow-6` / `surface-green-6`)
  and reveals a glyph. Glyphs are **imported lucide icons** (`~icons/lucide/*`, which render a
  real `<svg>` — NOT the mask-based `lucide-*` utility, whose stroke is baked into the pack-wide
  1.5 and can't be overridden per icon) with `:stroke-width="3"` to read at 9px, tinted
  `text-ink-gray-8` at `--tw-text-opacity:0.55`. Zoom = a `chevrons-left-right` (outward/expand)
  rotated 45°, flipping to `chevrons-right-left` (inward/collapse) while the window is
  full-screen. The dots are real buttons wired to `closeWin`/`minimizeWin`/`toggleZoom`.

## Dock — adaptive-behind

`components/Dock/Dock.vue`. The dock auto-hides and apps open maximized by default, so the
dock reveals *over* a window body. A fixed material (opaque tray, frosted glass, scrim) was
rejected on pixels; the chosen behavior is **adapt-behind**:

- **On the bare wallpaper:** trayless — glyphs float with a lift shadow; dividers / dots /
  Launchpad ink follow the wallpaper's darkness.
- **When a non-minimized window covers the dock's bottom-center band:** an opaque light
  "Frappe card" tray fades in (transition on background/box-shadow/border) and the elements
  switch to dark-on-light so they read on the surface.

The `behind` test is computed from `state.windows` × `geoMap` (maximized treated as
full-screen, split as always-behind), so it reacts live — drag a window over the dock and
the tray grows in. App/title icons use the live `app_logo_url` SVGs (`config/apps.ts`).

> Alternatives considered and dropped: a fixed opaque tray, frosted-glass tray, bottom scrim
> (all looked wrong on one backdrop or the other); "reserve a dock lane" (windows stop above
> the dock); "adapt to wallpaper only" (ignores the window behind). Not built: push-window-
> up-on-reveal (animated geometry fights the auto-hide) and a vertical edge rail (layout
> rework).

## Tokens

The traffic-dot trio now maps to espresso `surface-*` tokens directly on the elements
(`surface-gray-5` rest; `surface-red-6` / `surface-yellow-6` / `surface-green-6` on hover) —
no chrome-specific CSS vars.

The Product Duotone gradient stays in `wallpaperDefs()` (its existing data home, alongside
the other wallpapers), not a CSS var. Window surfaces, hairlines and text map to existing
espresso tokens; only `#f8f9fc` (title bar) is kept literal to match pixels.
