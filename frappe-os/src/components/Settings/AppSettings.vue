<script setup lang="ts">
// Per-app Settings — a custom centered/blurred overlay (frappe-ui Dialog can't
// reproduce the exact macOS-style two-pane settings sheet), composed from
// frappe-ui Switch / FormControl / Button. Panes: General / Members /
// Notifications / Integrations / Customize. Desktop-global prefs (theme, window
// behavior, wallpaper) live in the per-user Settings window, not here.
import { computed, watch } from 'vue'
import { Switch, Button } from 'frappe-ui'
import { useOS } from '@/desktop'
import { initials } from '@/config/apps'
import { surfacePane, APP_SETTINGS_PANES } from '@/surface'
// OsWindow feeds defineProps, so import it from the concrete module (the @/types barrel's
// `export *` breaks @vue/compiler-sfc's macro resolver — see DoctypeView.vue).
import type { OsWindow } from '@/surface/types'

const props = defineProps<{ win: OsWindow }>()
const os = useOS()
const appId = computed(() => (props.win.surface as { appId?: string }).appId!)
const app = computed(() => os.DATA.APP[appId.value])
const ICON = os.DATA.ICON

const panes = APP_SETTINGS_PANES
const paneIcon: Record<string, string> = { General: ICON.cog, Members: ICON.users, Notifications: ICON.bell, Integrations: ICON.plug, Customize: ICON.sliders }
const pane = computed(() => surfacePane(props.win.surface))

const generalFields = computed(() => [
  { label: 'Workspace name', value: app.value.name, select: false },
  { label: 'Default landing', value: app.value.hasDashboard ? 'Dashboard' : 'List view', select: true },
  { label: 'Records per page', value: '20', select: true },
  { label: 'Time zone', value: 'Asia/Kolkata', select: true },
])
// Members are the live site users (loaded when the Members pane is opened).
const members = computed(() =>
  (os.listFor('User').data || []).map((u) => ({ name: u.full_name || u.name, email: u.email || u.name, role: u.role_profile || 'Member' })),
)
watch(pane, (p) => { if (p === 'Members') os.loadList('User') }, { immediate: true })
const notifToggles = [
  { label: 'Email me on mentions', sub: 'When someone @mentions you', key: 'notif_mention', def: true },
  { label: 'Daily digest', sub: 'A summary every morning at 9:00', key: 'notif_digest', def: false },
  { label: 'Desktop notifications', sub: 'Show alerts on this device', key: 'notif_desktop', def: true },
  { label: 'Assignment alerts', sub: 'When a record is assigned to you', key: 'notif_assign', def: true },
]
const integrations = computed(() => [
  { label: 'Slack', sub: 'Post updates to a channel', icon: ICON.bell, key: 'intg_0', def: true },
  { label: 'Google Workspace', sub: 'Calendar & contacts sync', icon: ICON.calendar, key: 'intg_1', def: true },
  { label: 'Webhooks', sub: 'Send events to a URL', icon: ICON.plug, key: 'intg_2', def: false },
  { label: 'API keys', sub: 'Programmatic access', icon: ICON.shield, key: 'intg_3', def: false },
])
const customizeRows = computed(() => {
  const rows: { label: string; sub: string; key: string; def: boolean }[] = []
  ;(app.value.modules || []).forEach((mod) => mod.doctypes.forEach((dt) => rows.push({ label: dt, sub: mod.name, key: 'cust_' + dt, def: true })))
  return rows
})
const k = (key: string) => appId.value + ':' + key
function toggleVal(key: string, def: boolean) { return os.isOn(k(key), def) }
function flip(key: string, def: boolean) { os.tog(k(key), def) }
</script>

<template>
  <div class="flex min-h-0 flex-1">
    <!-- panes -->
        <div class="w-[182px] flex-shrink-0 overflow-auto border-r border-outline-gray-1 bg-surface-sidebar px-2 py-2.5">
          <div v-for="t in panes" :key="t" class="my-px flex h-8 cursor-pointer items-center gap-2.5 rounded-[7px] px-2.5 text-[12.5px]" @click="os.setAppSettingsPane(win.id, t)"
            :style="{ color: pane===t ? 'var(--ink-gray-9)' : 'var(--ink-gray-6)', fontWeight: pane===t ? 600 : 400,
              background: pane===t ? 'var(--surface-gray-3)' : 'transparent' }">
            <span :class="paneIcon[t]" class="size-[15px] flex-shrink-0"></span>{{ t }}
          </div>
        </div>
        <!-- body -->
        <div class="min-w-0 flex-1 overflow-auto px-[22px] py-5">
          <template v-if="pane==='General'">
            <div class="mb-3 mt-1.5 text-[11px] font-semibold tracking-[0.02em] text-ink-gray-5">APP PREFERENCES</div>
            <div v-for="(f, i) in generalFields" :key="i" class="mb-4">
              <div class="mb-[5px] text-[12px] text-ink-gray-6">{{ f.label }}</div>
              <div class="flex h-[34px] items-center rounded-lg border border-outline-gray-2 bg-surface-base px-[11px] text-[13px] text-ink-gray-8">
                <span class="flex-1">{{ f.value }}</span>
                <span class="lucide-chevron-down size-[13px] text-ink-gray-4"></span>
              </div>
            </div>
          </template>

          <template v-else-if="pane==='Members'">
            <div class="mb-3 mt-1.5 text-[11px] font-semibold tracking-[0.02em] text-ink-gray-5">MEMBERS & PERMISSIONS</div>
            <div v-for="(m, i) in members" :key="i" class="flex items-center gap-2.5 border-b border-outline-gray-1 py-[9px]">
              <span class="inline-flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-full bg-[var(--ink-gray-5)] text-[11px] font-semibold text-white">{{ initials(m.name) }}</span>
              <div class="flex min-w-0 flex-1 flex-col"><span class="text-[13px] text-ink-gray-8">{{ m.name }}</span><span class="text-[11.5px] text-ink-gray-5">{{ m.email }}</span></div>
              <span class="flex-shrink-0 rounded-full bg-surface-gray-2 px-[9px] py-[3px] text-[11.5px] text-ink-gray-5">{{ m.role }}</span>
            </div>
          </template>

          <template v-else-if="pane==='Notifications'">
            <div class="mb-3 mt-1.5 text-[11px] font-semibold tracking-[0.02em] text-ink-gray-5">NOTIFICATIONS</div>
            <div v-for="(t, i) in notifToggles" :key="i" class="flex items-center gap-3 border-b border-outline-gray-1 py-[11px]">
              <div class="flex min-w-0 flex-1 flex-col gap-0.5"><span class="text-[13px] text-ink-gray-8">{{ t.label }}</span><span class="text-[11.5px] text-ink-gray-5">{{ t.sub }}</span></div>
              <Switch :modelValue="toggleVal(t.key, t.def)" @update:modelValue="flip(t.key, t.def)" />
            </div>
          </template>

          <template v-else-if="pane==='Integrations'">
            <div class="mb-3 mt-1.5 text-[11px] font-semibold tracking-[0.02em] text-ink-gray-5">INTEGRATIONS</div>
            <div v-for="(it, i) in integrations" :key="i" class="flex items-center gap-3 border-b border-outline-gray-1 py-3">
              <span class="inline-flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-[9px] bg-surface-gray-2 text-ink-gray-6">
                <span :class="it.icon" class="size-[17px]"></span>
              </span>
              <div class="flex min-w-0 flex-1 flex-col"><span class="text-[13px] text-ink-gray-8">{{ it.label }}</span><span class="text-[11.5px] text-ink-gray-5">{{ it.sub }}</span></div>
              <Button size="sm" :variant="toggleVal(it.key, it.def) ? 'subtle' : 'outline'"
                :theme="toggleVal(it.key, it.def) ? 'green' : 'gray'"
                :label="toggleVal(it.key, it.def) ? 'Connected' : 'Connect'" @click="flip(it.key, it.def)" />
            </div>
          </template>

          <template v-else-if="pane==='Customize'">
            <div class="mb-3 mt-1.5 text-[11px] font-semibold tracking-[0.02em] text-ink-gray-5">SHOW IN SIDEBAR</div>
            <div v-for="(r, i) in customizeRows" :key="i" class="flex items-center gap-3 border-b border-outline-gray-1 py-[11px]">
              <div class="flex min-w-0 flex-1 flex-col gap-0.5"><span class="text-[13px] text-ink-gray-8">{{ r.label }}</span><span class="text-[11.5px] text-ink-gray-5">{{ r.sub }}</span></div>
              <Switch :modelValue="toggleVal(r.key, r.def)" @update:modelValue="flip(r.key, r.def)" />
            </div>
          </template>
        </div>
  </div>
</template>
