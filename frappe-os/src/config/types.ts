// The shapes the curated display config (apps.ts / doctypes.ts / icons.ts) instantiates,
// plus the view-layer prop bundle. Display + structure only; no records — list/count
// values come live from the records store. Re-exported via @/types.
import type { BuiltinView } from '@/surface/types'

// A list filter value: either an equality (`'Open'`) or an operator tuple
// (`['in', ['Unpaid', 'Overdue']]`), matching Frappe's filter syntax.
export type FilterValue = string | [string, unknown[]]

// A dashboard card definition (the value is fetched live, not stored here).
export interface Card {
  label: string
  sub: string
  doctype: string
  filters?: Record<string, FilterValue>
  fieldname?: string
}

// A module groups doctypes under an app; the first module to list a doctype owns it.
export interface AppModule {
  name: string
  doctypes: string[]
}

export interface AppDef {
  id: string
  name: string
  glyph: string
  hex: string
  logo: string
  hasDashboard: boolean
  dashTitle: string
  recentDoctype: string
  cards: Card[]
  modules: AppModule[]
}

// A desktop wallpaper option (id + label + CSS background; `dark` flips chrome to the
// dark palette). The full set lives in desktop/windows.ts's wallpaperDefs().
export interface WallpaperDef {
  id: string
  label: string
  bg: string
  dark: boolean
}

// One command-palette result: a label/subtitle/icon row plus the action it runs when
// chosen. Built live in desktop/palette.ts from the curated apps + their doctypes.
export interface PaletteItem {
  label: string
  sub: string
  icon: string
  kindLabel: string
  run: () => void
}

// A themed pill's resolved CSS custom-property values.
export interface Pill {
  bg: string
  fg: string
}

// Curated per-doctype IDENTITY the boot Registry carries (ADR-0028): label, look (color/
// icon), and the authoring marker. Presentation semantics — title field, status field/colors,
// list columns — are NOT here; they come live from get_doctype_meta (the Record indicator
// spec + title_field), resolved per record. Field schemas are live too.
export interface DoctypeMeta {
  label: string
  color: string
  icon: string
  // Authoring marker (config/doctypes.ts): true for the placeholder `defineGeneric` metas,
  // false/absent for hand-tuned bespoke ones. Kept for the app-kind classification.
  generic?: boolean
  // Optional curated list "saved views" chips. None of the current curated metas set this,
  // so the list falls back to a single "All" chip; typed here so the OSList projection that
  // reads it stays checked.
  savedViews?: { label: string; count?: number }[]
}

// One way a doctype can be presented (list/form/report/kanban/…). A COLLECTION member
// per ADR-0007: ordered, labelled, and flagged builtin (generic renderer) vs
// applet-backed (resolves to an AppletSurface via `appletId`). The Registry's
// `views(doctype)` projection (surface-and-registry.md §2). `defaults` carries default
// filters/sort/group for the view.
export interface DoctypeViewPayload {
  view: BuiltinView
  label: string
  builtin?: boolean
  appletId?: string
  defaults?: Record<string, unknown>
}

// The uniform prop bundle every view component (builtin OSList/OSForm or an applet-backed
// custom view) receives from DoctypeView: the doctype + active view name + optional record,
// the curated display config, viewer presence, and the OS navigation callbacks. Assembled by
// OSWindow from the focused window's surface; `recordName` is absent/`'new'` for a blank
// create form. A view component declares the whole bundle and reads only what it needs.
export interface ViewProps {
  doctype: string
  view: BuiltinView
  recordName?: string | null
  meta: DoctypeMeta | null
  presence: { label: string }[]
  onOpen?: (doctype: string, name: string) => void // primary open (left-click): follows the user's row open-target preference
  onOpenInline?: (doctype: string, name: string) => void // explicit same-window open (context-menu "Open")
  onOpenNewWindow?: (doctype: string, name: string) => void // open a record in a fresh app instance
  onNew?: (doctype: string) => void // start a blank create form
  onCreated?: (doctype: string, name: string) => void // after a create succeeds
}
