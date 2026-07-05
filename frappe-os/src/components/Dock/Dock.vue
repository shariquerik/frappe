<script setup lang="ts">
// Auto-hiding dock overlay (reveal handled in store.onPointerMove via setDockEl).
// An app icon may own several windows now (multiple app instances, its settings
// pane). Clicking an icon with >1 window opens a chooser popover above it
// so any one window can be brought to the front; 0 or 1 window focuses directly.
import { computed, ref } from 'vue'
import { useOS } from '@/desktop'
import { orderedDockPins, transientAppIds, reorderDeltas, isPointOutside } from '@/desktop/dock-model'
import { windowRole, systemWindowTitle, isBuiltin, isAppRef, isFinderWindow, placementSurface } from '@/surface'
import { usePlacements, placementView, writePlacementOverride, removeResolvedPlacement } from '@/placements'
import { tileMenuOptions } from '@/placements/tile-menu'
import { dockContextOptions } from '@/actions'
import OSContextMenu from '../OSContextMenu.vue'
import AppIconTile from '../AppIconTile.vue'
import type { OsWindow, BuiltinSurface, SurfaceRef, ResolvedPlacement } from '@/types'
const os = useOS()

// Adaptive backing: the dock floats trayless on the wallpaper, but grows an opaque tray
// the moment a window sits behind it (a maximized list/form would otherwise wash the
// glyphs out). Trayless, the glyphs adapt their ink to the wallpaper's darkness.
const TRAY = 'rounded-[18px] border border-outline-gray-2 bg-surface-base shadow-[var(--shadow-xl)]'
const dark = computed(() => os.currentWp.value.dark)

// Dock placement (ADR-0022). A bottom dock lays its icons out horizontally; a left/right dock
// stacks them vertically. Orientation drives the wrapper anchor, flex axis, hover lift, dot
// placement, popover side, and the divider — all derived from `pos` so the template stays declarative.
const pos = computed(() => os.state.dockPosition)
const vertical = computed(() => pos.value !== 'bottom')

const wrapClass = computed(() => ({
  left: 'left-[3px] top-1/2 -translate-y-1/2',
  right: 'right-[3px] top-1/2 -translate-y-1/2',
  bottom: 'bottom-[3px] left-1/2 -translate-x-1/2',
}[pos.value]))
const trayFlow = computed(() => (vertical.value ? 'flex-col items-center' : 'items-end'))
const hoverLift = computed(() => ({ left: 'hover:translate-x-2', right: 'hover:-translate-x-2', bottom: 'hover:-translate-y-2' }[pos.value]))
// Running dots sit on the dock's outer edge: below a bottom icon, beside a vertical one.
const dotsPlace = computed(() => ({
  left: 'left-[-6px] top-1/2 -translate-y-1/2 flex-col',
  right: 'right-[-6px] top-1/2 -translate-y-1/2 flex-col',
  bottom: 'bottom-[-6px] left-1/2 -translate-x-1/2',
}[pos.value]))
// Window-chooser popover opens away from the dock's edge: above a bottom icon, beside a vertical one.
const popoverPlace = computed(() => ({
  left: 'left-[58px] top-1/2 -translate-y-1/2',
  right: 'right-[58px] top-1/2 -translate-y-1/2',
  bottom: 'bottom-[58px] left-1/2 -translate-x-1/2',
}[pos.value]))
const dividerShape = computed(() => (vertical.value ? 'h-px w-[38px] my-0.5' : 'w-px h-[38px] mx-0.5'))

// The dock's extent along its run (pinned + transient icons + Finder button), clamped to the screen.
const dockSpan = computed(() => {
  const along = (dockItems.value.length + 1) * 53 + 40
  const limit = (vertical.value ? os.desktopRef.h || 800 : os.desktopRef.w || 1280) - 40
  return Math.min(limit, along)
})

// The screen rectangle the dock occupies, given its edge and run-length (ADR-0022).
function dockBand(dw: number, dh: number) {
  const span = dockSpan.value
  if (pos.value === 'left') return { left: 0, right: 80, top: dh / 2 - span / 2, bottom: dh / 2 + span / 2 }
  if (pos.value === 'right') return { left: dw - 80, right: dw, top: dh / 2 - span / 2, bottom: dh / 2 + span / 2 }
  return { left: dw / 2 - span / 2, right: dw / 2 + span / 2, top: dh - 92, bottom: dh }
}

// Is a non-minimized window covering the dock's band? (drives the opaque adapt-behind tray)
const behind = computed(() => {
  if (os.state.split) return true
  const dw = os.desktopRef.w || 1280,
    dh = os.desktopRef.h || 800
  const band = dockBand(dw, dh)
  return os.state.windows.some((w) => {
    const g = os.geoMap.value[w.id] || {}
    if (g.min) return false
    let x = g.x ?? 0,
      y = g.y ?? 0,
      ww = g.w ?? 0,
      hh = g.h ?? 0
    if (g.max) {
      x = 0
      y = 32
      ww = dw
      hh = dh
    }
    return x < band.right && x + ww > band.left && y < band.bottom && y + hh > band.top
  })
})

// Behind a window → opaque light tray + dark ink. On the bare wallpaper → floating
// glyphs whose ink follows the wallpaper's darkness.
const trayClass = computed(() => (behind.value ? TRAY : ''))
// Drop shadow for the icon tiles as a drop-shadow filter (AppIconTile is filter-based): smaller when
// the dock sits on an opaque tray, larger when floating on the wallpaper.
const iconShadow = computed(() =>
  behind.value ? 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))' : 'drop-shadow(0 3px 6px rgba(0,0,0,0.38))',
)
const dividerClass = computed(() =>
  behind.value ? 'bg-[var(--outline-gray-2)]' : dark.value ? 'bg-white/25' : 'bg-black/10',
)
const dotClass = computed(() =>
  !behind.value && dark.value ? 'bg-white/70' : 'bg-[var(--ink-gray-6)]',
)
const finderButtonClass = computed(() => {
  if (behind.value) return 'bg-surface-gray-3 text-ink-gray-7'
  return dark.value
    ? 'bg-white/15 text-white [backdrop-filter:blur(12px)]'
    : 'bg-black/10 text-ink-gray-8 [backdrop-filter:blur(12px)]'
})

// A window's surface is always builtin in step 1 (applet windows come later).
const sf = (w: OsWindow) => w.surface as BuiltinSurface

function winTitle(w: OsWindow): string | undefined {
  const role = windowRole(w.id), s = sf(w)
  const sysTitle = systemWindowTitle(role, s.view, os.DATA.APP[s.appId!].name)
  if (sysTitle) return sysTitle
  if (s.view === 'form') {
    // Title field comes live from the form's field-meta fetch (ADR-0028); the record name is
    // the fallback until it loads (a form window always fetches it, so the title upgrades).
    const titleField = os.fieldMetaFor(s.doctype!).data?.title_field
    const r = os.recordObj(s.doctype!, s.recordName!)
    return (r && (r[titleField || ''] || r.name)) || s.recordName!
  }
  if (s.view === 'list') return s.doctype
  return os.DATA.APP[s.appId!].name
}
function winSub(w: OsWindow): string {
  const role = windowRole(w.id), s = sf(w)
  if (role === 'settings') return 'Settings'
  if (role === 'system') return s.view === 'finder' ? 'Navigator' : 'Settings'
  if (s.view === 'form') return s.doctype!
  if (s.view === 'list') return 'List'
  return 'Dashboard'
}

// The dock is no longer APP_ORDER. It is the resolved `dock` Placements (pinned, ordered by their
// 1-D `order`) ∪ a separator ∪ the running-but-unpinned apps (transient — they vanish when their
// last window closes). Each item carries enough to render its icon, its running dots, and its
// window chooser; presentation is derived from the reference (placementView) / the app (registry).
const dockPins = computed(() => orderedDockPins(usePlacements().dock()))

// Open app ids in first-opened order — the transient partition's input. A window's app is its
// surface's owning app (builtin surfaces only in this slice, mirroring the chooser below). Filtered
// to KNOWN apps: a window whose surface has no/unknown appId can't render a sensible dock tile (no
// name, no logo), so it yields no transient item rather than a blank one.
const openAppIds = computed(() =>
  os.state.windows
    .filter((w) => isBuiltin(w.surface) && windowRole(w.id) !== 'system')
    .map((w) => (w.surface as BuiltinSurface).appId)
    .filter((id): id is string => !!id && !!os.DATA.APP[id]),
)

// The app a dock item is "about", so its open windows light its running dots and feed its chooser.
// A bare-app / transient item is that app; a doctype/applet pin resolves to its surface's owner.
function refAppId(ref: SurfaceRef): string {
  if (isAppRef(ref)) return ref.app || ''
  const surface = placementSurface(ref)
  return (surface && isBuiltin(surface) && surface.appId) || ref.app || ''
}

// An app tile owns its app windows AND its per-app settings pane, but never a desktop-wide SYSTEM
// singleton (the Finder / the per-user Settings): those borrow the frappe app id only for chrome
// scoping, so gating on `windowRole !== 'system'` keeps their dot off the frappe tile.
function winsFor(appId: string) {
  const wins = os.state.windows.filter(
    (w) => isBuiltin(w.surface) && (w.surface as BuiltinSurface).appId === appId && windowRole(w.id) !== 'system',
  )
  return wins.map((w) => ({
    id: w.id, title: winTitle(w), sub: winSub(w),
    min: !!(os.geoMap.value[w.id] || {}).min, active: os.state.activeId === w.id,
  }))
}

// The Finder is a desktop-wide singleton, not an app tile, so its running/minimized dot rides its
// own launcher button — present iff the Finder window is open (minimized or not, like an app dot).
const finderWindow = computed(() => os.state.windows.find((w) => isFinderWindow(w)))

interface DockItem {
  key: string
  name: string
  logo?: string
  icon?: string
  ref?: SurfaceRef // present on a pinned item (drives open); absent on a transient app item
  pin?: ResolvedPlacement // present on a pinned item — the target of its Remove-from-Dock menu
  appId: string
  windows: ReturnType<typeof winsFor>
}

const pinnedItems = computed<DockItem[]>(() =>
  dockPins.value.map((p) => {
    const view = placementView(p)
    const appId = refAppId(p.ref)
    return { key: view.key, name: view.label, logo: view.logo, icon: view.icon, ref: p.ref, pin: p, appId, windows: winsFor(appId) }
  }),
)

const transientItems = computed<DockItem[]>(() =>
  transientAppIds(usePlacements().dock(), openAppIds.value).map((id) => {
    const a = os.DATA.APP[id]
    return { key: 'transient:' + id, name: a?.name || id, logo: a?.logo, appId: id, windows: winsFor(id) }
  }),
)

// All items along the run (pinned then transient) — the span estimate and v-for both read this.
const dockItems = computed(() => [...pinnedItems.value, ...transientItems.value])

function openItem(d: DockItem) {
  // A pinned non-app reference opens its surface; an app reference (pinned or transient) opens the
  // app's default surface — the same routing the desktop pins use (App.vue's openPlacement).
  if (d.ref && !isAppRef(d.ref)) {
    const surface = placementSurface(d.ref)
    if (surface) os.openSurface(surface)
    return
  }
  os.openApp(d.appId)
}

function onIconClick(d: DockItem) {
  const count = d.windows.length
  if (count === 0) { openItem(d); os.state.dockMenu = null; return }
  if (count === 1) { os.activateWin(d.windows[0].id); os.state.dockMenu = null; return }
  os.state.dockMenu = os.state.dockMenu === d.key ? null : d.key
}
function pick(winId: string) { os.activateWin(winId); os.state.dockMenu = null }
const closeMenu = () => { os.state.dockMenu = null }

// Reorder a pinned item to a new slot: persist one User-layer `order` override per pin whose
// position changed (the whole new arrangement), through the write seam — the current user's own
// rows only; baseline / Site rows are untouched. Optimistic, so the row re-sorts without a reload.
function reorderPin(fromKey: string, toIndex: number) {
  for (const { placement, order } of reorderDeltas(usePlacements().dock(), fromKey, toIndex)) {
    void writePlacementOverride({ region: 'dock', ref: placement.ref, position: { order } })
  }
}

// Native drag-to-reorder of the pinned set: pick up a pin, drop it on another pinned slot, and
// the write seam persists the new order. Transient items aren't draggable — they aren't pinned.
const draggingKey = ref<string | null>(null)
function onPinDrop(targetIndex: number) {
  if (draggingKey.value) reorderPin(draggingKey.value, targetIndex)
  draggingKey.value = null
}

// The dock tray element (also handed to the store for auto-hide), read live to hit-test a drag-end.
let trayEl: HTMLElement | null = null
const setTrayEl = (el: HTMLElement | null) => { trayEl = el; os.setDockEl(el) }

// Drag a pin clear of the dock to remove it. A drop onto another tile reorders (onPinDrop already
// cleared draggingKey), a release still over the dock is a no-op; only a pin whose drag ends more
// than DROP_OFF_PAD px OFF the tray is removed — the same primitive as the right-click "Remove".
const DROP_OFF_PAD = 30
function onPinDragEnd(d: DockItem, e: DragEvent) {
  const rect = trayEl?.getBoundingClientRect()
  const off = !!rect && isPointOutside(rect, e.clientX, e.clientY, DROP_OFF_PAD)
  if (draggingKey.value === d.key && d.pin && off) void removeResolvedPlacement(d.pin)
  draggingKey.value = null
}

// The dock right-click (tray) menu renders through OSContextMenu — the shell's one context-menu
// primitive — wrapping the dock tray as its trigger, so reka opens it at the cursor natively (no
// hand-anchored popover). Its entries render from the resolver (the `dock:context` Region), not a
// literal array — the auto-hide toggle, the position submenu (with the live selection), and Dock
// Settings are all Commands+Actions competed by the same engine, so an app can customize them
// (ADR-0001). While ANY dock menu is open (this tray menu or a tile menu) the dock keeps itself
// revealed via `dockContextOpen` — both wire it from OSContextMenu's `update:open`.
const ctxOptions = computed(() => dockContextOptions(os))
</script>

<template>
  <!-- click-catcher so the open chooser dismisses on an outside click -->
  <div v-if="os.state.dockMenu" class="fixed inset-0 z-[89999]" @pointerdown="closeMenu"></div>

  <div class="absolute z-[90000]" :class="wrapClass">
    <!-- Right-click the tray (empty area) → the dock settings menu; a tile's own menu stops the
         event first so it wins over its icon. Keeps the dock revealed while open (update:open). -->
    <OSContextMenu :options="ctxOptions" @update:open="os.state.dockContextOpen = $event">
    <!-- Trayless by default; an opaque tray fades in when a window sits behind the dock. -->
    <div :ref="(el) => setTrayEl(el as HTMLElement | null)" class="flex gap-[7px] px-2.5 py-2 [transition:transform_.28s_cubic-bezier(0.4,0,0.2,1),background-color_.2s,box-shadow_.2s,border-color_.2s]" :class="[trayClass, trayFlow]">
      <!-- pinned dock placements (ADR-0023), draggable to reorder → a User-layer order override -->
      <div v-for="(d, i) in pinnedItems" :key="d.key" class="relative flex items-end" draggable="true"
        @dragstart="draggingKey = d.key" @dragend="onPinDragEnd(d, $event)"
        @dragover.prevent @drop.prevent="onPinDrop(i)">
        <!-- Right-click a pinned tile → Remove from Dock. `.stop` keeps it from bubbling to the
             tray's own right-click (dock settings), so the tile menu wins over its own icon. -->
        <OSContextMenu :options="tileMenuOptions(d.pin!)" @update:open="os.state.dockContextOpen = $event">
          <button class="relative inline-flex h-[46px] w-[46px] cursor-pointer items-center justify-center rounded-xl border-none bg-transparent p-0 [transition:transform_.15s]" :class="hoverLift" :title="d.name" @click="onIconClick(d)" @contextmenu.stop>
            <AppIconTile :logo="d.logo" :icon="d.icon" :label="d.name" radius="rounded-xl" glyph="size-[20px]" :shadow="iconShadow" />
            <!-- running indicator: a second dot hints at multiple windows -->
            <span v-if="d.windows.length" class="absolute flex items-center gap-[3px]" :class="dotsPlace">
              <span class="h-1 w-1 rounded-full" :class="dotClass"></span>
              <span v-if="d.windows.length>1" class="h-1 w-1 rounded-full" :class="dotClass"></span>
            </span>
          </button>
        </OSContextMenu>

        <!-- window chooser popover -->
        <div v-if="os.state.dockMenu===d.key" class="absolute flex min-w-[210px] max-w-[280px] flex-col rounded-xl border border-outline-gray-2 bg-surface-base p-[5px] shadow-[var(--shadow-2xl)]" :class="popoverPlace" @pointerdown.stop>
          <div class="px-[9px] pb-[6px] pt-[5px] text-[11px] font-semibold text-ink-gray-5">{{ d.name }} — {{ d.windows.length }} windows</div>
          <button v-for="w in d.windows" :key="w.id" class="flex w-full cursor-pointer items-center gap-2.5 rounded-lg border-none bg-transparent px-[9px] py-[7px] text-left hover:!bg-surface-gray-2" @click="pick(w.id)"
            :style="{ background: w.active ? 'var(--surface-gray-3)' : 'transparent' }">
            <span class="inline-flex h-[7px] w-[7px] flex-shrink-0 rounded-full" :style="{ background: w.min ? 'var(--outline-gray-3)' : 'var(--surface-green-5)' }"></span>
            <span class="flex min-w-0 flex-1 flex-col">
              <span class="overflow-hidden text-ellipsis whitespace-nowrap text-[12.5px] text-ink-gray-8">{{ w.title }}</span>
              <span class="text-[11px] text-ink-gray-5">{{ w.sub }}{{ w.min ? ' · minimized' : '' }}</span>
            </span>
          </button>
        </div>
      </div>

      <!-- separator between pinned and the running-but-unpinned (transient) set -->
      <div v-if="transientItems.length" class="self-center" :class="[dividerShape, dividerClass]"></div>

      <!-- transient running-but-unpinned apps: gone when their last window closes -->
      <div v-for="d in transientItems" :key="d.key" class="relative flex items-end">
        <button class="relative inline-flex h-[46px] w-[46px] cursor-pointer items-center justify-center rounded-xl border-none bg-transparent p-0 [transition:transform_.15s]" :class="hoverLift" :title="d.name" @click="onIconClick(d)">
          <AppIconTile :logo="d.logo" :label="d.name" radius="rounded-xl" :shadow="iconShadow" />
          <span v-if="d.windows.length" class="absolute flex items-center gap-[3px]" :class="dotsPlace">
            <span class="h-1 w-1 rounded-full" :class="dotClass"></span>
            <span v-if="d.windows.length>1" class="h-1 w-1 rounded-full" :class="dotClass"></span>
          </span>
        </button>

        <div v-if="os.state.dockMenu===d.key" class="absolute flex min-w-[210px] max-w-[280px] flex-col rounded-xl border border-outline-gray-2 bg-surface-base p-[5px] shadow-[var(--shadow-2xl)]" :class="popoverPlace" @pointerdown.stop>
          <div class="px-[9px] pb-[6px] pt-[5px] text-[11px] font-semibold text-ink-gray-5">{{ d.name }} — {{ d.windows.length }} windows</div>
          <button v-for="w in d.windows" :key="w.id" class="flex w-full cursor-pointer items-center gap-2.5 rounded-lg border-none bg-transparent px-[9px] py-[7px] text-left hover:!bg-surface-gray-2" @click="pick(w.id)"
            :style="{ background: w.active ? 'var(--surface-gray-3)' : 'transparent' }">
            <span class="inline-flex h-[7px] w-[7px] flex-shrink-0 rounded-full" :style="{ background: w.min ? 'var(--outline-gray-3)' : 'var(--surface-green-5)' }"></span>
            <span class="flex min-w-0 flex-1 flex-col">
              <span class="overflow-hidden text-ellipsis whitespace-nowrap text-[12.5px] text-ink-gray-8">{{ w.title }}</span>
              <span class="text-[11px] text-ink-gray-5">{{ w.sub }}{{ w.min ? ' · minimized' : '' }}</span>
            </span>
          </button>
        </div>
      </div>

      <div class="self-center" :class="[dividerShape, dividerClass]"></div>
      <button class="relative inline-flex h-[46px] w-[46px] cursor-pointer items-center justify-center rounded-xl border-none shadow-[var(--shadow-sm)] [transition:transform_.15s]" :class="[finderButtonClass, hoverLift]" title="Finder" @click="os.openFinder()">
        <span class="lucide-layout-grid size-[20px]"></span>
        <!-- the Finder's own running dot (it borrows no app tile's) -->
        <span v-if="finderWindow" class="absolute flex items-center" :class="dotsPlace">
          <span class="h-1 w-1 rounded-full" :class="dotClass"></span>
        </span>
      </button>
    </div>
    </OSContextMenu>
  </div>
</template>
