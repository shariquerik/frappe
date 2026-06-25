<script setup lang="ts">
// Auto-hiding dock overlay (reveal handled in store.onPointerMove via setDockEl).
// An app icon may own several windows now (multiple app instances, its settings
// pane). Clicking an icon with >1 window opens a chooser popover above it
// so any one window can be brought to the front; 0 or 1 window focuses directly.
import { computed, ref } from 'vue'
import { useOS } from '@/desktop'
import { windowRole, isBuiltin } from '@/surface'
import OSDropdown from '../OSDropdown.vue'
import type { OsWindow, BuiltinSurface } from '@/types'
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

// The dock's extent along its run (icon count + launchpad), clamped to the screen.
const dockSpan = computed(() => {
  const along = (os.APP_ORDER.length + 1) * 53 + 40
  const limit = (vertical.value ? os.deskRef.h || 800 : os.deskRef.w || 1280) - 40
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
  const dw = os.deskRef.w || 1280,
    dh = os.deskRef.h || 800
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
const iconShadow = computed(() => (behind.value ? 'shadow-[var(--shadow-sm)]' : 'shadow-[var(--shadow-lg)]'))
const dividerClass = computed(() =>
  behind.value ? 'bg-[var(--outline-gray-2)]' : dark.value ? 'bg-white/25' : 'bg-black/10',
)
const dotClass = computed(() =>
  !behind.value && dark.value ? 'bg-white/70' : 'bg-[var(--ink-gray-6)]',
)
const launchpadClass = computed(() => {
  if (behind.value) return 'bg-surface-gray-3 text-ink-gray-7'
  return dark.value
    ? 'bg-white/15 text-white [backdrop-filter:blur(12px)]'
    : 'bg-black/10 text-ink-gray-8 [backdrop-filter:blur(12px)]'
})

// A window's surface is always builtin in step 1 (applet windows come later).
const sf = (w: OsWindow) => w.surface as BuiltinSurface

function winTitle(w: OsWindow): string | undefined {
  const role = windowRole(w.id), s = sf(w)
  if (role === 'settings') return os.DATA.APP[s.appId!].name + ' settings'
  if (role === 'system') return 'System Settings'
  if (s.view === 'form') {
    const m = os.getMeta(s.doctype!), r = os.recordObj(s.doctype!, s.recordName!)
    return (r && (r[m?.titleField || ''] || r.name)) || s.recordName!
  }
  if (s.view === 'list') return s.doctype
  return os.DATA.APP[s.appId!].name
}
function winSub(w: OsWindow): string {
  const role = windowRole(w.id), s = sf(w)
  if (role === 'settings') return 'Settings'
  if (role === 'system') return 'Settings'
  if (s.view === 'form') return s.doctype!
  if (s.view === 'list') return 'List'
  return 'Dashboard'
}

const dockApps = computed(() =>
  os.APP_ORDER.map((id) => {
    const a = os.DATA.APP[id]
    const wins = os.state.windows.filter((w) => isBuiltin(w.surface) && w.surface.appId === id)
    return {
      id, name: a.name, logo: a.logo, count: wins.length,
      windows: wins.map((w) => ({
        id: w.id, title: winTitle(w), sub: winSub(w),
        min: !!(os.geoMap.value[w.id] || {}).min, active: os.state.activeId === w.id,
      })),
    }
  }),
)
type DockApp = (typeof dockApps)['value'][number]

function onIconClick(d: DockApp) {
  if (d.count === 0) { os.openApp(d.id); os.state.dockMenu = null; return }
  if (d.count === 1) { os.activateWin(d.windows[0].id); os.state.dockMenu = null; return }
  os.state.dockMenu = os.state.dockMenu === d.id ? null : d.id
}
function pick(winId: string) { os.activateWin(winId); os.state.dockMenu = null }
const closeMenu = () => { os.state.dockMenu = null }

// Right-click dock settings (macOS-style). A Dropdown opens on a click, so to anchor it at the
// cursor we drive it in controlled mode against a 1px trigger parked where the user right-clicked
// — reusing OSDropdown (frappe-ui) for its submenu + #os-popover-layer portaling, rather than
// hand-rolling a menu. The "Position on Screen" submenu mirrors the Settings ▸ Dock control.
const ctxAt = ref({ x: 0, y: 0 })
function onDockContext(e: MouseEvent) {
  e.preventDefault()
  ctxAt.value = { x: e.clientX, y: e.clientY }
  os.state.dockContextOpen = true
}

// "Dock Settings…" opens the System Settings window straight to its Dock pane.
function openDockSettings() { os.openSystemSettings('Dock') }

const ctxOptions = computed(() => [
  {
    hideLabel: true,
    group: 'dock',
    options: [
      { label: os.state.dockAutoHide ? 'Turn Hiding Off' : 'Turn Hiding On', onClick: () => os.setDockAutoHide(!os.state.dockAutoHide) },
      {
        label: 'Position on Screen',
        submenu: [
          { label: 'Left', selected: pos.value === 'left', onClick: () => os.setDockPosition('left') },
          { label: 'Bottom', selected: pos.value === 'bottom', onClick: () => os.setDockPosition('bottom') },
          { label: 'Right', selected: pos.value === 'right', onClick: () => os.setDockPosition('right') },
        ],
      },
    ],
  },
  { hideLabel: true, group: 'settings', options: [{ label: 'Dock Settings…', onClick: openDockSettings }] },
])
</script>

<template>
  <!-- click-catcher so the open chooser dismisses on an outside click -->
  <div v-if="os.state.dockMenu" class="fixed inset-0 z-[89999]" @pointerdown="closeMenu"></div>

  <div class="absolute z-[90000]" :class="wrapClass">
    <!-- Trayless by default; an opaque tray fades in when a window sits behind the dock. -->
    <div :ref="(el) => os.setDockEl(el as HTMLElement | null)" class="flex gap-[7px] px-2.5 py-2 [transition:transform_.28s_cubic-bezier(0.4,0,0.2,1),background-color_.2s,box-shadow_.2s,border-color_.2s]" :class="[trayClass, trayFlow]" @contextmenu="onDockContext">
      <div v-for="d in dockApps" :key="d.id" class="relative flex items-end">
        <button class="relative inline-flex h-[46px] w-[46px] cursor-pointer items-center justify-center rounded-xl border-none bg-transparent p-0 [transition:transform_.15s]" :class="hoverLift" :title="d.name" @click="onIconClick(d)">
          <img :src="d.logo" :alt="d.name" class="h-[46px] w-[46px] rounded-xl object-contain" :class="iconShadow" />
          <!-- running indicator: a second dot hints at multiple windows -->
          <span v-if="d.count" class="absolute flex items-center gap-[3px]" :class="dotsPlace">
            <span class="h-1 w-1 rounded-full" :class="dotClass"></span>
            <span v-if="d.count>1" class="h-1 w-1 rounded-full" :class="dotClass"></span>
          </span>
        </button>

        <!-- window chooser popover -->
        <div v-if="os.state.dockMenu===d.id" class="absolute flex min-w-[210px] max-w-[280px] flex-col rounded-xl border border-outline-gray-2 bg-surface-base p-[5px] shadow-[var(--shadow-2xl)]" :class="popoverPlace" @pointerdown.stop>
          <div class="px-[9px] pb-[6px] pt-[5px] text-[11px] font-semibold text-ink-gray-5">{{ d.name }} — {{ d.count }} windows</div>
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
      <button class="inline-flex h-[46px] w-[46px] cursor-pointer items-center justify-center rounded-xl border-none shadow-[var(--shadow-sm)] [transition:transform_.15s]" :class="[launchpadClass, hoverLift]" title="Launchpad" @click="os.openPalette()">
        <span class="lucide-layout-grid size-[20px]"></span>
      </button>
    </div>
  </div>

  <!-- Right-click dock menu: a Dropdown driven open against a 1px anchor parked at the cursor. -->
  <OSDropdown :options="ctxOptions" :open="os.state.dockContextOpen" side="top" align="start" @update:open="os.state.dockContextOpen = $event">
    <div class="fixed h-px w-px" :style="{ left: ctxAt.x + 'px', top: ctxAt.y + 'px' }"></div>
  </OSDropdown>
</template>
