// useWallpapers(): the client Wallpaper seam (ADR-0036). A wallpaper is an image or a CSS gradient;
// the server owns the catalog (global defaults ∪ the caller's own uploads) and delivers the resolved
// list in boot.wallpapers, with the chosen name in boot.wallpaper. This module holds them and owns the
// user's three write paths — choose (roams the per-user selection), upload (a new private wallpaper),
// and delete (an own upload). Mirrors placements/index.ts and recents/index.ts: seeded once at boot
// (initWallpapers), so useWallpapers() / wallpaperSelection() stay synchronous lookups for the picker
// and desktop. It never re-orders the catalog; an optimistic append/remove keeps the UI live.
import { reactive } from 'vue'
import { callPost } from '@/data/api'
import type { BootData, WallpaperDef } from '@/types'
import type { ServerWallpaper } from './types'

// The built-in ground applied before boot resolves, or when the server ships no catalog (an older
// server, ADR-0008). Mirrors the seeded is_default global (Duotone) so the desktop is never
// wallpaper-less and currentWp always resolves.
const FALLBACK: WallpaperDef = {
  id: 'duotone',
  label: 'Duotone',
  bg: 'radial-gradient(150% 130% at 12% -10%, #5b54e6 0%, #2c3a9e 42%, #0f7d78 100%)',
  category: 'Colors',
  dark: true,
  isGlobal: true,
  isDefault: true,
}

// Reactive so an optimistic upload/delete and a selection change re-render the desktop and picker
// without a reload. Boot replaces the catalog wholesale (initWallpapers).
const store = reactive<{ catalog: WallpaperDef[]; selection: string | null }>({ catalog: [], selection: null })

// One raw server row → the client WallpaperDef the desktop renders. `name` is the id the selection
// stores; empty image/background collapse to undefined so the renderer can branch on presence.
function toDef(row: ServerWallpaper): WallpaperDef {
  return {
    id: row.name,
    label: row.label,
    bg: row.background || undefined,
    image: row.image || undefined,
    thumbnail: row.thumbnail || undefined,
    category: row.category || undefined,
    dark: !!row.dark,
    isGlobal: !!row.isGlobal,
    isDefault: !!row.isDefault,
  }
}

// Read the resolved catalog off the boot payload, tolerating a missing/legacy key (ADR-0008): an
// older server with no `wallpapers` key, or junk, degrades to an empty catalog (→ the FALLBACK ground).
function readCatalog(boot?: BootData | null): WallpaperDef[] {
  const list = (boot as { wallpapers?: unknown } | null | undefined)?.wallpapers
  return Array.isArray(list) ? (list as ServerWallpaper[]).map(toDef) : []
}

export function initWallpapers(boot?: BootData | null): void {
  store.catalog = readCatalog(boot)
  store.selection = (boot as { wallpaper?: string | null } | null | undefined)?.wallpaper ?? null
}

// The resolved catalog (globals first, then the user's own) — the synchronous seam the picker reads.
// Falls back to the built-in ground so the desktop always offers at least one wallpaper.
export function useWallpapers(): WallpaperDef[] {
  return store.catalog.length ? store.catalog : [FALLBACK]
}

// The user's chosen wallpaper name (reactive read) — the input desktop/windows.ts resolves currentWp
// from. null when unchosen, so the resolver falls back to the default global.
export function wallpaperSelection(): string | null {
  return store.selection
}

// Choose a wallpaper (ADR-0036): apply it at once (optimistic) then persist the per-user selection.
// The server validates the name is visible to the caller; a rejected write leaves the local state
// ahead, corrected on the next boot.
export function setSelection(id: string): void {
  store.selection = id
  void callPost('frappe.os_core.wallpapers.set_wallpaper', { name: id })
}

// Upload a new private wallpaper from an already-uploaded image URL (ADR-0036): catalog it server-side
// (always owner-scoped, non-global), append it to the local catalog, and select it. Returns the new id.
export async function uploadWallpaper(label: string, image: string, dark = false): Promise<string> {
  const row = (await callPost('frappe.os_core.wallpapers.upload_wallpaper', {
    label,
    image,
    dark: dark ? 1 : 0,
  })) as ServerWallpaper
  const def = toDef(row)
  store.catalog.push(def)
  setSelection(def.id)
  return def.id
}

// Remove one of the user's own wallpapers (ADR-0036): delete it server-side and drop it from the
// catalog. If it was selected, the server clears the selection; mirror that so the default re-applies.
export async function deleteWallpaper(id: string): Promise<void> {
  await callPost('frappe.os_core.wallpapers.delete_wallpaper', { name: id })
  store.catalog = store.catalog.filter((w) => w.id !== id)
  if (store.selection === id) store.selection = null
}
