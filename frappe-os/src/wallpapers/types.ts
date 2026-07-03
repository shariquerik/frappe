// Wallpaper seam shapes (ADR-0036). The server resolves the catalog (global defaults ∪ the caller's
// own uploads) and delivers it in boot.wallpapers, with the chosen wallpaper name in boot.wallpaper
// (the selection roams per-user in frappe.defaults). This is the RAW server row; the seam maps it to
// the client WallpaperDef (config/types.ts). Re-exported via @/types.
export interface ServerWallpaper {
  // The OS Wallpaper row name — the id the selection stores and the picker keys on.
  name: string
  label: string
  // An image wallpaper carries `image` (an /assets or /files URL); a gradient carries `background`
  // (a CSS background). Exactly one is set; the other is null.
  image: string | null
  // A small sibling of `image` the picker grid draws instead of the full background (ADR-0036 perf);
  // null for a gradient or a user upload, where the picker falls back to `image`.
  thumbnail: string | null
  background: string | null
  // The picker section this wallpaper is grouped under (e.g. Colors, Photos); null for a user upload.
  category: string | null
  // The wallpaper is dark, so desktop chrome reads in the light palette over it.
  dark: boolean
  // A shipped default (available to everyone) vs the user's own upload (which the picker lets them
  // remove); `isDefault` marks the fallback applied before the user picks one.
  isGlobal: boolean
  isDefault: boolean
}
