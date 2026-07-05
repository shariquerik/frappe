<script setup lang="ts">
// The Finder body (ADR-0024): renders the active Location's draggable tiles. Applications and
// Doctypes are tile grids reprojected from the Registry (locations.ts); Favorites is a read-only
// mirror/manager of the viewer's resolved desktop + dock Placements. A left-click launches a tile
// (opens its surface); a drag-out onto the desktop creates a Placement via the one User-layer write
// path (drag.ts → writePlacementOverride). Favorites' remove clears the user's OWN pin.
import { computed } from 'vue'
import { useOS } from '@/desktop'
import { itemsFor, favoritePlacements, type Location, type FinderItem } from './locations'
import { startFinderDrag } from './drag'
import { placementView, placementKey, removeResolvedPlacement } from '@/placements'
import type { ResolvedPlacement } from '@/placements/types'

const props = defineProps<{ location: Location }>()
const os = useOS()

// The framework "Settings" entry pinned to the Applications Location: it isn't an app, so it opens
// the per-user Settings window rather than a Surface (ADR-0024's open question, resolved to Settings).
const SETTINGS_TILE: FinderItem & { settings: true } =
  { key: 'finder:settings', ref: { app: 'frappe' }, label: 'Settings', icon: 'lucide-settings', settings: true }

const tiles = computed<FinderItem[]>(() => {
  const items = itemsFor(props.location)
  return props.location === 'Applications' ? [...items, SETTINGS_TILE] : items
})
const favorites = computed<ResolvedPlacement[]>(() => favoritePlacements())

// Launch a tile: the Settings entry opens the per-user Settings window; every other tile opens
// through the one shared reference-open path (os.openRef) the desktop and tile menu also use.
function launch(item: FinderItem): void {
  if ((item as { settings?: boolean }).settings) return os.openSettings()
  os.openRef(item.ref)
}

// Start a drag-out from a tile: hand its on-screen rect to the shared pointer loop, which on release
// snaps to a desktop grid cell and persists a new desktop Placement. The Settings entry isn't a
// pinnable surface reference, so it doesn't drag out.
function onTilePointerDown(item: FinderItem, e: PointerEvent): void {
  if ((item as { settings?: boolean }).settings) return
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  startFinderDrag(item.ref, rect, e)
}

const view = (p: ResolvedPlacement) => placementView(p)
// Remove a favorite = the same own-vs-inherited path the menu-bar Remove verb uses, so an inherited
// (baseline/Site) pin is tombstoned (it reconstitutes nothing on reload) rather than failing to delete.
const removeFavorite = (p: ResolvedPlacement) => removeResolvedPlacement(p)
const keyOf = placementKey
</script>

<template>
  <div class="flex min-w-0 flex-1 flex-col overflow-auto px-[22px] py-5">
    <!-- Recents starts empty until a record is opened; the other tile Locations are never empty. -->
    <div v-if="location === 'Recents' && !tiles.length" class="py-8 text-center text-[12.5px] text-ink-gray-5">
      No recent records yet. Open a record and it shows up here.
    </div>

    <!-- Applications / Doctypes / Recents — draggable tile grid -->
    <div v-else-if="location !== 'Favorites'" class="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-1">
      <button v-for="item in tiles" :key="item.key"
        class="flex cursor-grab flex-col items-center gap-[7px] rounded-lg border-none bg-transparent px-1 py-2.5 hover:bg-surface-gray-2 active:cursor-grabbing"
        @pointerdown="onTilePointerDown(item, $event)" @click="launch(item)">
        <img v-if="item.logo" :src="item.logo" :alt="item.label" class="h-[44px] w-[44px] rounded-[11px] object-contain shadow-[var(--shadow-sm)]" />
        <span v-else class="inline-flex h-[44px] w-[44px] items-center justify-center rounded-[11px] border border-outline-gray-2 bg-surface-base text-ink-gray-6 shadow-[var(--shadow-sm)]">
          <span :class="item.icon" class="size-[21px]"></span>
        </span>
        <span class="line-clamp-2 max-w-[88px] break-words text-center text-[11.5px] text-ink-gray-7">{{ item.label }}</span>
      </button>
    </div>

    <!-- Favorites — read-only mirror of the viewer's desktop + dock Placements, with a remove affordance -->
    <template v-else>
      <div v-if="!favorites.length" class="py-8 text-center text-[12.5px] text-ink-gray-5">
        Nothing pinned yet. Drag an app or doctype onto the desktop to add it.
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
