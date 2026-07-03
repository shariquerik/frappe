<script setup lang="ts">
// The Finder (ADR-0024) — the OS's cross-app navigator and the principal drag-source for Placements.
// A singleton `system`-role window (OSWindow supplies the chrome/title bar), mirroring System
// Settings: respawned-from-URL, never persisted, deep-linkable. A macOS-style two-pane sheet: a left
// Locations rail picks the Location, the right body renders its draggable tiles. The active Location
// rides the window's surface params so a deep-link / dock launcher can open straight to it.
//
// It is NOT a file browser. Each tile is a surface reference (ADR-0021); launching opens it and
// dragging it out onto the desktop creates a Placement via the one User-layer write path.
import { computed } from 'vue'
import { useOS } from '@/desktop'
import { LOCATIONS, type Location } from './locations'
import FinderBody from './FinderBody.vue'
// OsWindow feeds defineProps, so import it from the concrete module (the @/types barrel's
// `export *` breaks @vue/compiler-sfc's macro resolver — see Settings.vue).
import type { OsWindow } from '@/surface/types'

const props = defineProps<{ win: OsWindow }>()
const os = useOS()
const ICON = os.DATA.ICON

const locationIcon: Record<Location, string> = {
  Applications: ICON.grid,
  Doctypes: ICON.table,
  Recents: 'lucide-clock',
  Favorites: 'lucide-star',
}
const location = computed<Location>(() =>
  (((props.win.surface as { params?: { location?: string } }).params?.location) as Location) || 'Applications')
</script>

<template>
  <div class="flex min-h-0 flex-1">
    <!-- Locations rail -->
    <div class="w-[182px] flex-shrink-0 overflow-auto border-r border-outline-gray-1 bg-surface-sidebar px-2 py-2.5">
      <div class="mb-1 px-2.5 text-[11px] font-semibold tracking-[0.02em] text-ink-gray-5">LOCATIONS</div>
      <div v-for="loc in LOCATIONS" :key="loc" class="my-px flex h-8 cursor-pointer items-center gap-2.5 rounded-[7px] px-2.5 text-[12.5px]" @click="os.setFinderLocation(loc)"
        :style="{ color: location===loc ? 'var(--ink-gray-9)' : 'var(--ink-gray-6)', fontWeight: location===loc ? 600 : 400,
          background: location===loc ? 'var(--surface-gray-3)' : 'transparent' }">
        <span :class="locationIcon[loc]" class="size-[15px] flex-shrink-0"></span>{{ loc }}
      </div>
    </div>
    <!-- body -->
    <FinderBody :location="location" />
  </div>
</template>
