# Wallpapers: a server-backed catalog (global defaults + private uploads) and a roaming selection

> **Status:** Accepted (2026-07-03). Implemented. Introduces the **OS Wallpaper** DocType, the
> `frappe.os_core.wallpapers` resolver, and the `src/wallpapers/` client seam. Retires the hardcoded
> frontend `wallpaperDefs()` gradient list and the localStorage-only selection.

A desktop **wallpaper** is an image or a CSS gradient. The full catalog and the user's current choice
move from the frontend (a hardcoded gradient list + a per-browser localStorage id) onto the server, so
uploads persist and the selection roams across devices — matching how Placements (ADR-0023) and
Recents (ADR-0024) already work.

## One table, two scopes

A single **OS Wallpaper** DocType (module OS Core) holds every wallpaper, distinguished by an
`is_global` flag:

- **Shipped defaults** (`is_global=1`, owned by Administrator) — available to every user. Seeded, not
  user-writable.
- **User uploads** (`is_global=0`, owner-scoped) — private to the uploader; never visible to anyone
  else.

The resolver `get_wallpapers()` reads `is_global=1 OR owner=me` (the new `or_filters` on the shared
`layer_rows` helper) and projects the client shape. Visibility is enforced in the resolver, not by
DocType read perms — the same "reading the config table is not sensitive; the resolver is the gate"
stance as Placements/Recents (ADR-0010). The upload path **forces `is_global=0`**, so a user can never
mint a global row, and delete is guarded to own, non-global rows only (`if_owner` perms + an explicit
guard).

## The catalog lives in the DB, the fallback lives in code

The nine gradient wallpapers migrate **out** of the frontend into seeded global rows, so the catalog
has one source of truth (the DB) — the client no longer ships a parallel list. This is the deliberate
inversion of "baseline-in-code" (APP_DEFAULT_PLACEMENTS): a wallpaper's presentation (its gradient CSS
or image URL) is data an admin can edit in Desk, not code.

The client keeps **one** built-in wallpaper — a FALLBACK "Duotone" ground — used only when the server
ships no catalog (an older server, offline boot; ADR-0008 tolerance), so `currentWp` always resolves
and the desktop is never wallpaper-less. It is a degradation floor, not the catalog.

## The selection roams in `frappe.defaults`, not on a row

The *chosen* wallpaper is a scalar per-user preference, not a catalog entry, so it is stored with
`frappe.defaults.set_user_default("os_wallpaper", name)` — the same primitive as the preferred-shell
choice, and deliberately **not** a new per-user settings DocType (none existed; one wallpaper id does
not justify inventing one). Boot ships the catalog (`wallpapers`) and the selection (`wallpaper`)
separately. `currentWp` resolves selection → the `is_default` global (Duotone) → the first row, so a
fresh user lands on the default and an unpicked/deleted selection falls back cleanly.

Deleting the currently-selected wallpaper clears the default server-side (and the client mirrors it),
so removal never strands the desktop on a dead id.

## Sections come from a `category` field

The picker groups wallpapers into sections rather than one flat grid. Each wallpaper carries a
`category` (seeds set gradients → **Colors**, images → **Photos**); the picker orders known categories
first, then any admin-defined category alphabetically, then a **Your Wallpapers** section holding the
user's uploads and the Upload tile. Grouping is data-driven (a new category just appears) and
extensible — an admin can categorize a wallpaper in Desk with no code change. ("Category/section" here
is a picker grouping, distinct from a Settings *pane*; it does not revive Frappe's form "section".)

## Shipped images are scanned from static assets

Default images live in the app's `public/wallpapers/` (served at `/assets/frappe/wallpapers/…`). The
`after_migrate` seed **scans the folder** and publishes each image as a global row, deriving a label
from the filename — so dropping a file in and re-migrating publishes it, with no per-file code. Migrate
also generates the image's small picker thumbnail if it is missing (see the thumbnail section), so no
separate build step is needed; the desktop image itself is served as committed, so ship it web-sized.
Seeding is idempotent (gradients keyed by label, images by asset path); re-running updates presentation in
place and never touches a user's uploads.

## The picker draws a thumbnail, not the full image

Each image row carries a small `thumbnail` (a web-sized sibling under `wallpapers/thumbnails/`) next
to the full desktop `image`. The picker grid draws the thumbnail; only the *selected* wallpaper loads
its full background. Without this the gallery loaded every full-resolution photo at once — 23 shipped
originals were ~85 MB, so opening Settings ▸ Wallpaper janked the whole shell. Thumbnails are web-sized
WebP (longest edge ~480px, transparency preserved) from one server-side derivation seam
(`frappe/os_core/wallpaper_images.py`). For **shipped** photos `after_migrate` generates any missing
`<stem>.webp` thumbnail — best-effort and tolerant of a read-only asset mount, and it only ever writes the
small thumbnail, never rewriting or deleting the committed desktop image (so ship the desktop image
web-sized at ~3840px so it paints 1:1 on a 4K display). For a **user upload** `upload_wallpaper` runs the
source through the same seam server-side, storing a downscaled `image` (longest edge ~3840px) +
`thumbnail` and discarding the raw original. A
gradient has no thumbnail; the picker's `image` fallback serves a not-yet-generated shipped file or a
legacy row.

## Uploads reuse the standard File flow

Upload rides frappe-ui's `FileUploader` (→ a File `file_url`), then a whitelisted `upload_wallpaper`
catalogs it as a private row. No bespoke upload endpoint. Image wallpapers default to `dark=1` (white
icon labels + shadow read over most photos); darkness can't be auto-detected per image, so an admin
can flip `dark` per row — a future upload UI could offer a light/dark toggle.

## Considered and rejected

- **Keep the selection in localStorage.** Per-browser, doesn't roam; uploads would persist but the
  choice wouldn't follow the user. Rejected — inconsistent with Placements/Recents roaming.
- **A layered override model (like Placements).** Wallpapers are a *catalog* of distinct entities, not
  overrides of a shared identity, so the App<Site<User merge doesn't fit. A simple global ∪ own union
  is the right shape.
- **A new per-user "OS Settings" DocType for the selection.** Over-built for one scalar; `frappe.defaults`
  already carries per-user scalars (preferred shell). Revisit if more roaming scalars accumulate.
- **Gradients stay in code, images in the DB.** Two sources for one concept. Rejected — one catalog,
  one source; only the degradation FALLBACK stays in code.

## Relationship to prior ADRs

- **Mirrors ADR-0023 (Placements) / ADR-0024 (Recents).** Server-resolved, boot-shipped, a small
  reactive client seam whose only writes are the user's own; `layer_rows`/`upsert`/`ref`-style helpers
  reused (`common.py`).
- **Reuses ADR-0010.** Per-row visibility is enforced in the resolver, not DocType read perms.
- **ADR-0008 tolerance.** An older server omitting `wallpapers`/`wallpaper` degrades to the built-in
  FALLBACK ground rather than throwing.
