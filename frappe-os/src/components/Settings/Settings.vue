<script setup lang="ts">
// Settings — the per-user, desktop-wide preferences window (a singleton system pane, OSWindow's
// 'system' role supplies the chrome/title bar). A macOS-style two-pane sheet: a left nav rail
// picks the pane, the right body renders it. Panes are global, not app-scoped: General
// (window behavior — list-row open target ADR-0018, remember window size ADR-0019), Appearance
// (light/dark theme), Wallpaper (the gallery) and Dock (placement + reveal, ADR-0022). The
// active pane rides the singleton window's surface params so a deep-link / dock "Dock Settings…"
// can open straight to it. The nav rows are frappe-ui SidebarItem (like AppSidebar), so Settings,
// the Finder rail, and the app window's sidebar all share one row treatment.
import { computed } from 'vue'
import { Switch, Select, SidebarItem, useTheme } from 'frappe-ui'
import { useOS } from '@/desktop'
import { AccountSection, WallpaperPicker } from '@/components/Settings'
import { SETTINGS_PANES } from '@/surface'
// OsWindow feeds defineProps, so import it from the concrete module (the @/types barrel's
// `export *` breaks @vue/compiler-sfc's macro resolver — see DoctypeView.vue).
import type { OsWindow } from '@/surface/types'
import type { DockPosition } from '@/desktop/types'

const props = defineProps<{ win: OsWindow }>()
const os = useOS()
const ICON = os.DATA.ICON

const panes = SETTINGS_PANES
const paneIcon: Record<string, string> = { Account: ICON.user, General: ICON.cog, Appearance: ICON.palette, Wallpaper: ICON.image, Dock: ICON.sliders }
const pane = computed(() => ((props.win.surface as { params?: { pane?: string } }).params?.pane) || 'General')

const dockPositions: { label: string; value: DockPosition }[] = [
  { label: 'Bottom', value: 'bottom' },
  { label: 'Left', value: 'left' },
  { label: 'Right', value: 'right' },
]

// Appearance as a Select (System / Light / Dark). useTheme owns the <html data-theme> attribute
// and persists the choice, so the model just reads currentTheme and writes through setTheme.
const themeOptions = [
  { label: 'System', value: 'system' },
  { label: 'Light', value: 'light' },
  { label: 'Dark', value: 'dark' },
]
const { currentTheme, setTheme } = useTheme()
const theme = computed<string>({ get: () => currentTheme.value, set: (value) => setTheme(value) })
</script>

<template>
  <div class="flex min-h-0 flex-1">
    <!-- pane nav — rows are frappe-ui SidebarItem, so they match the app window's AppSidebar -->
    <div class="flex w-[182px] flex-shrink-0 flex-col gap-1 overflow-auto border-r border-outline-gray-1 bg-surface-sidebar p-2">
      <SidebarItem
        v-for="s in panes"
        :key="s"
        class="shrink-0"
        :label="s"
        :icon="paneIcon[s]"
        :active="pane === s"
        :onClick="() => os.setSettingsPane(s)"
      />
    </div>
    <!-- body -->
    <div class="flex min-w-0 flex-1 flex-col overflow-auto">
      <template v-if="pane==='Account'">
        <!-- The logged-in user's own identity (ADR-0027), at the top above the preference panes. -->
        <AccountSection />
      </template>

      <template v-else-if="pane==='Appearance'">
        <div class="px-[22px] py-5">
          <!-- Global light/dark/system theme, as a Select (System / Light / Dark). -->
          <div class="flex items-center gap-3 py-[11px]">
            <div class="flex min-w-0 flex-1 flex-col gap-0.5">
              <span class="text-[13px] text-ink-gray-8">Appearance</span>
              <span class="text-[11.5px] text-ink-gray-5">Choose a light, dark, or system-matched interface.</span>
            </div>
            <Select class="flex-shrink-0" :options="themeOptions" v-model="theme" />
          </div>
        </div>
      </template>

      <template v-else-if="pane==='Wallpaper'">
        <WallpaperPicker />
      </template>

      <template v-else-if="pane==='Dock'">
        <div class="px-[22px] py-5">
          <!-- Dock placement & reveal (ADR-0022), like macOS "Desktop & Dock". Position is a
               segmented control; auto-hide off pins the dock so it never slides away. -->
          <div class="flex items-center gap-3 border-b border-outline-gray-1 py-[11px]">
            <div class="flex min-w-0 flex-1 flex-col gap-0.5">
              <span class="text-[13px] text-ink-gray-8">Position on screen</span>
              <span class="text-[11.5px] text-ink-gray-5">Which edge the dock sits on</span>
            </div>
            <div class="flex flex-shrink-0 rounded-lg border border-outline-gray-2 bg-surface-gray-2 p-0.5">
              <button v-for="op in dockPositions" :key="op.value" @click="os.setDockPosition(op.value)" class="cursor-pointer rounded-[6px] border-none bg-transparent px-2.5 py-1 text-[12px]"
                :style="{ color: os.state.dockPosition===op.value ? 'var(--ink-gray-9)' : 'var(--ink-gray-6)', fontWeight: os.state.dockPosition===op.value ? 600 : 400,
                  background: os.state.dockPosition===op.value ? 'var(--surface-base)' : 'transparent', boxShadow: os.state.dockPosition===op.value ? 'var(--shadow-sm)' : 'none' }">{{ op.label }}</button>
            </div>
          </div>
          <div class="flex items-center gap-3 py-[11px]">
            <div class="flex min-w-0 flex-1 flex-col gap-0.5">
              <span class="text-[13px] text-ink-gray-8">Automatically hide the dock</span>
              <span class="text-[11.5px] text-ink-gray-5">Slide the dock away until you move to its edge; off keeps it always visible</span>
            </div>
            <Switch
              :modelValue="os.state.dockAutoHide"
              @update:modelValue="os.setDockAutoHide($event)"
            />
          </div>
        </div>
      </template>

      <template v-else-if="pane==='General'">
        <div class="px-[22px] py-5">
          <!-- Window behavior, desktop-global (moved out of per-app Settings). -->
          <div class="mb-3 mt-1.5 text-[11px] font-semibold tracking-[0.02em] text-ink-gray-5">BEHAVIOR</div>
          <!-- Per-user list-row open-target (ADR-0018): plain left-click opens inline (same
               window) by default, flippable to a new window. The right-click menu still offers both. -->
          <div class="flex items-center gap-3 border-b border-outline-gray-1 py-[11px]">
            <div class="flex min-w-0 flex-1 flex-col gap-0.5">
              <span class="text-[13px] text-ink-gray-8">Open list rows in a new window</span>
              <span class="text-[11.5px] text-ink-gray-5">Left-click a row to open it in a new window instead of the same one</span>
            </div>
            <Switch
              :modelValue="os.state.rowOpenTarget === 'new-window'"
              @update:modelValue="os.setRowOpenTarget($event ? 'new-window' : 'inline')"
            />
          </div>
          <!-- Windows always open small; when this is on (default) a window reopens at the
               size/position it was last left at (ADR-0019). -->
          <div class="flex items-center gap-3 py-[11px]">
            <div class="flex min-w-0 flex-1 flex-col gap-0.5">
              <span class="text-[13px] text-ink-gray-8">Remember window size</span>
              <span class="text-[11.5px] text-ink-gray-5">Reopen each window at the size and position you last left it</span>
            </div>
            <Switch
              :modelValue="os.state.rememberWindowSize"
              @update:modelValue="os.setRememberWindowSize($event)"
            />
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
