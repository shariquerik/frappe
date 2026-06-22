<script setup lang="ts">
// Auto-hiding dock overlay (reveal handled in store.onPointerMove via setDockEl).
// An app icon may own several windows now (multiple app instances, its settings
// pane). Clicking an icon with >1 window opens a chooser popover above it
// so any one window can be brought to the front; 0 or 1 window focuses directly.
import { computed } from 'vue'
import { useOS } from '@/desktop'
import { windowRole, isBuiltin } from '@/surface'
import type { OsWindow, BuiltinSurface } from '@/types'
const os = useOS()

// Adaptive backing: the dock floats trayless on the wallpaper, but grows an opaque tray
// the moment a window sits behind it (a maximized list/form would otherwise wash the
// glyphs out). Trayless, the glyphs adapt their ink to the wallpaper's darkness.
const TRAY = 'rounded-[18px] border border-outline-gray-2 bg-surface-base shadow-[var(--shadow-xl)]'
const dark = computed(() => os.currentWp.value.dark)

// Is a non-minimized window covering the dock's bottom-center band?
const behind = computed(() => {
  if (os.state.split) return true
  const dw = os.deskRef.w || 1280,
    dh = os.deskRef.h || 800
  const cx = dw / 2
  const dockW = Math.min(dw - 40, (os.APP_ORDER.length + 1) * 53 + 40)
  const left = cx - dockW / 2,
    right = cx + dockW / 2,
    bandTop = dh - 92
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
    return x < right && x + ww > left && y + hh > bandTop
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
  if (role === 'wallpaper') return 'Wallpaper'
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
  if (role === 'wallpaper') return 'Appearance'
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
</script>

<template>
  <!-- click-catcher so the open chooser dismisses on an outside click -->
  <div v-if="os.state.dockMenu" class="fixed inset-0 z-[89999]" @pointerdown="closeMenu"></div>

  <div class="absolute bottom-[10px] left-1/2 z-[90000] -translate-x-1/2">
    <!-- Trayless by default; an opaque tray fades in when a window sits behind the dock. -->
    <div :ref="(el) => os.setDockEl(el as HTMLElement | null)" class="flex items-end gap-[7px] px-2.5 py-2 [transition:transform_.28s_cubic-bezier(0.4,0,0.2,1),background-color_.2s,box-shadow_.2s,border-color_.2s]" :class="trayClass">
      <div v-for="d in dockApps" :key="d.id" class="relative flex items-end">
        <button class="relative inline-flex h-[46px] w-[46px] cursor-pointer items-center justify-center rounded-xl border-none bg-transparent p-0 [transition:transform_.15s] hover:-translate-y-2" :title="d.name" @click="onIconClick(d)">
          <img :src="d.logo" :alt="d.name" class="h-[46px] w-[46px] rounded-xl object-contain" :class="iconShadow" />
          <!-- running indicator: a second dot hints at multiple windows -->
          <span v-if="d.count" class="absolute bottom-[-6px] left-1/2 flex -translate-x-1/2 items-center gap-[3px]">
            <span class="h-1 w-1 rounded-full" :class="dotClass"></span>
            <span v-if="d.count>1" class="h-1 w-1 rounded-full" :class="dotClass"></span>
          </span>
        </button>

        <!-- window chooser popover -->
        <div v-if="os.state.dockMenu===d.id" class="absolute bottom-[58px] left-1/2 flex min-w-[210px] max-w-[280px] -translate-x-1/2 flex-col rounded-xl border border-outline-gray-2 bg-surface-base p-[5px] shadow-[var(--shadow-2xl)]" @pointerdown.stop>
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
      <div class="mx-0.5 h-[38px] w-px self-center" :class="dividerClass"></div>
      <button class="inline-flex h-[46px] w-[46px] cursor-pointer items-center justify-center rounded-xl border-none shadow-[var(--shadow-sm)] [transition:transform_.15s] hover:-translate-y-2" :class="launchpadClass" title="Launchpad" @click="os.openPalette()">
        <span class="lucide-layout-grid size-[20px]"></span>
      </button>
    </div>
  </div>
</template>
