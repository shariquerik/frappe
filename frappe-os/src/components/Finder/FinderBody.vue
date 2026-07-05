<script setup lang="ts">
// The Finder body (ADR-0024): renders the active Location's tiles as titled sections (locations.ts) —
// Workspaces group by app, Doctypes by workspace, the flat Locations (Applications/Recents) are one
// heading-less section. Favorites is a read-only mirror/manager of the viewer's resolved desktop +
// dock Placements. A tile behaves like a
// desktop icon (issues #3/#5): a single click SELECTS it, a double-click OPENS it, Enter opens the
// selected tile and Escape clears the selection, a right-click opens a context menu (Open + Add to
// Desktop/Dock), and a drag-out onto the wallpaper creates a Placement (drag.ts →
// writePlacementOverride). Favorites' remove clears the user's OWN pin.
import { computed, watch } from 'vue'
import { useOS } from '@/desktop'
import { sectionsFor, filterSections, favoritePlacements, type Location, type FinderItem, type FinderSection } from './locations'
import { startFinderDrag } from './drag'
import { finderTileMenuOptions } from './tile-menu'
import { selectFinderTile, clearFinderSelection, isFinderTileSelected, selectedFinderTile } from './selection'
import { finderQuery, clearFinderQuery } from './search'
import { placementView, placementKey, removeResolvedPlacement } from '@/placements'
import OSContextMenu, { type ContextMenuOption } from '@/components/OSContextMenu.vue'
import type { ResolvedPlacement } from '@/placements/types'

const props = defineProps<{ location: Location }>()
const os = useOS()

// The framework "Settings" entry pinned to the Applications Location. Its {app:'frappe', view:'settings'}
// reference is a first-class pinnable shortcut (issue #02): openRef routes it to the Settings window, so
// it flows through the SAME open/menu/drag paths as every other tile — click selects, double-click
// opens Settings, its menu offers Add to Desktop/Dock, and it drags out to a pin (label/icon are still
// hardcoded here since Settings has no Registry app entry of its own).
const SETTINGS_TILE: FinderItem =
  { key: 'finder:settings', ref: { app: 'frappe', view: 'settings' }, label: 'Settings', icon: 'lucide-settings' }

// The Location's tiles as titled sections (Workspaces group by app, Doctypes by workspace; the flat
// Locations are one heading-less section), narrowed by the chrome search box (search.ts) to the
// tiles whose label matches. Applications is a single section, so the Settings shortcut is appended
// before filtering (it filters like any other tile). Grouping/filtering change only the layout.
const sections = computed<FinderSection[]>(() => {
  const secs = sectionsFor(props.location)
  const withSettings =
    props.location === 'Applications'
      ? secs.map((section) => ({ ...section, items: [...section.items, SETTINGS_TILE] }))
      : secs
  return filterSections(withSettings, finderQuery())
})
// Every tile flat — the keyboard handler resolves the selected key against this, unaware of sections.
const allTiles = computed<FinderItem[]>(() => sections.value.flatMap((section) => section.items))
// Favorites renders from placements, not sections, so it filters here by the same query.
const favorites = computed<ResolvedPlacement[]>(() => {
  const needle = finderQuery().trim().toLowerCase()
  const all = favoritePlacements()
  return needle ? all.filter((p) => placementView(p).label.toLowerCase().includes(needle)) : all
})

// The message when a tile Location has nothing to show: a no-match line while searching, else the
// Recents hint before any record is opened. Favorites shows its own empty/no-match line below.
const emptyMessage = computed<string | null>(() => {
  if (props.location === 'Favorites' || allTiles.value.length) return null
  const needle = finderQuery().trim()
  if (needle) return `No matches for “${needle}”.`
  if (props.location === 'Recents') return 'No recent records yet. Open a record and it shows up here.'
  return null
})
// Favorites' empty line: a no-match while searching, else the "nothing pinned" hint.
const favoritesEmpty = computed<string>(() => {
  const needle = finderQuery().trim()
  return needle
    ? `No matches for “${needle}”.`
    : 'Nothing pinned yet. Drag an app or doctype onto the desktop to add it.'
})

// Switching Location drops any tile selection (like clicking away) and clears the search — the
// highlighted tile is gone and each Location opens on a clean, unfiltered view.
watch(() => props.location, () => {
  clearFinderSelection()
  clearFinderQuery()
})

// Open a tile (double-click): every tile opens through the one shared reference-open path (os.openRef)
// the desktop and tile menu also use — a settings ref lands on the Settings window, the rest on a surface.
function launch(item: FinderItem): void {
  os.openRef(item.ref)
}

// The tile's right-click menu: Open + Add to Desktop/Dock (Remove when already pinned) — the same for
// every tile, Settings included (it's a real pinnable reference now).
function menuFor(item: FinderItem): ContextMenuOption[] {
  return finderTileMenuOptions(item, os)
}

// Keyboard on a focused tile (Finder-style): Enter opens the selected tile, Escape drops the
// selection. It fires on the focused tile button and stops propagation so the desktop's global
// Enter/F2 (rename) and Escape handlers in App.vue never double-fire while the Finder is in use.
function onTileKey(e: KeyboardEvent): void {
  if (e.key === 'Enter') {
    const key = selectedFinderTile()
    const item = key ? allTiles.value.find((t) => t.key === key) : undefined
    if (!item) return
    e.preventDefault() // else the focused button also fires its own Enter-activation (a click)
    e.stopPropagation()
    launch(item)
  } else if (e.key === 'Escape') {
    e.stopPropagation()
    clearFinderSelection()
  }
}

// Start a drag-out from a tile: hand its on-screen rect to the shared pointer loop, which on release
// snaps to a desktop grid cell and persists a new desktop Placement. Every tile (Settings included) is
// a pinnable reference now, so any of them can drag out.
function onTilePointerDown(item: FinderItem, e: PointerEvent): void {
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  startFinderDrag(item, rect, e)
}

const view = (p: ResolvedPlacement) => placementView(p)
// Remove a favorite = the same own-vs-inherited path the menu-bar Remove verb uses, so an inherited
// (baseline/Site) pin is tombstoned (it reconstitutes nothing on reload) rather than failing to delete.
const removeFavorite = (p: ResolvedPlacement) => removeResolvedPlacement(p)
const keyOf = placementKey
</script>

<template>
  <div class="flex min-w-0 flex-1 flex-col overflow-auto px-[22px] py-5">
    <!-- Empty tile Location: no search matches, or Recents before any record is opened. -->
    <div v-if="emptyMessage" class="py-8 text-center text-[12.5px] text-ink-gray-5">
      {{ emptyMessage }}
    </div>

    <!-- Applications / Workspaces / Doctypes / Recents — titled sections of a draggable tile grid.
         Grouped Locations (Workspaces by app, Doctypes by workspace) draw a heading per section; the
         flat ones are one heading-less section. A click on empty space clears the selection (like
         clicking the Finder background); .self so a click on a tile doesn't. -->
    <div v-else-if="location !== 'Favorites'" class="flex flex-col gap-4" @click.self="clearFinderSelection()">
      <div v-for="(section, si) in sections" :key="section.label || si" class="flex flex-col gap-1.5"
        @click.self="clearFinderSelection()">
        <div v-if="section.label" class="px-0.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-ink-gray-5">
          {{ section.label }}
        </div>
        <div class="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-1" @click.self="clearFinderSelection()">
          <OSContextMenu v-for="item in section.items" :key="item.key" :options="menuFor(item)">
            <button
              :class="[
                'flex cursor-grab flex-col items-center gap-[7px] rounded-lg border-none px-1 py-2.5 active:cursor-grabbing',
                isFinderTileSelected(item.key) ? 'bg-surface-gray-3' : 'bg-transparent hover:bg-surface-gray-2',
              ]"
              @pointerdown="onTilePointerDown(item, $event)"
              @click="selectFinderTile(item.key)"
              @dblclick="launch(item)"
              @keydown="onTileKey">
              <img v-if="item.logo" :src="item.logo" :alt="item.label" class="h-[44px] w-[44px] rounded-[11px] object-contain shadow-[var(--shadow-sm)]" />
              <span v-else class="inline-flex h-[44px] w-[44px] items-center justify-center rounded-[11px] border border-outline-gray-2 bg-surface-base text-ink-gray-6 shadow-[var(--shadow-sm)]">
                <span :class="item.icon" class="size-[21px]"></span>
              </span>
              <span class="line-clamp-2 max-w-[88px] break-words text-center text-[11.5px] text-ink-gray-7">{{ item.label }}</span>
            </button>
          </OSContextMenu>
        </div>
      </div>
    </div>

    <!-- Favorites — read-only mirror of the viewer's desktop + dock Placements, with a remove affordance -->
    <template v-else>
      <div v-if="!favorites.length" class="py-8 text-center text-[12.5px] text-ink-gray-5">
        {{ favoritesEmpty }}
      </div>
      <div v-for="p in favorites" :key="keyOf(p)" class="group flex items-center gap-2.5 rounded-lg px-2 py-[7px] hover:bg-surface-gray-2">
        <img v-if="view(p).logo" :src="view(p).logo" :alt="view(p).label" class="h-[26px] w-[26px] flex-shrink-0 rounded-md object-contain" />
        <span v-else class="inline-flex h-[26px] w-[26px] flex-shrink-0 items-center justify-center rounded-md border border-outline-gray-2 bg-surface-base text-ink-gray-6">
          <span :class="view(p).icon" class="size-[14px]"></span>
        </span>
        <span class="min-w-0 flex-1 truncate text-[12.5px] text-ink-gray-8">{{ view(p).label }}</span>
        <span class="flex-shrink-0 rounded-md bg-surface-gray-3 px-1.5 py-0.5 text-[10.5px] uppercase text-ink-gray-5">{{ p.region }}</span>
        <button class="flex-shrink-0 cursor-pointer rounded-md border-none bg-transparent p-1 text-ink-gray-5 opacity-0 hover:!bg-surface-gray-4 hover:text-ink-gray-8 group-hover:opacity-100"
          title="Remove from your view" @click="removeFavorite(p)">
          <span class="lucide-x size-[14px]"></span>
        </button>
      </div>
    </template>
  </div>
</template>
