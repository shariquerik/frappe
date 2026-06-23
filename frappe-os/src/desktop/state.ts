// The shared reactive desktop state — a module singleton imported by every store
// slice (geometry, windows, palette, persistence). ES modules guarantee one instance,
// so all slices mutate the same object and useOS() exposes it directly. The menu-bar
// clock lives here too (a self-ticking ref) since it has no other home.
import { reactive, ref } from 'vue'
import type { OsState } from '@/types'

export const state = reactive<OsState>({
  windows: [], // { id, surface, back?, fwd? } — id prefix encodes role; surface = content
  geo: {}, // id -> { x, y, w, h, z, min, max }
  activeId: null,
  menu: null,
  split: null, // [rightId, leftId]
  paletteOpen: false,
  paletteQuery: '',
  theme: 'light',
  wallpaper: null,
  toggles: {},
  sidebarHidden: {},
  rowOpenTarget: 'inline', // list-row left-click opens in the same window by default (ADR-0018)
  rememberWindowSize: true, // reopen a window at its last size/position (else always small)
  dockMenu: null, // appId whose dock window-chooser popover is open
})

function clockNow() {
  const d = new Date()
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  let h = d.getHours()
  const m = String(d.getMinutes()).padStart(2, '0')
  const ap = h >= 12 ? 'PM' : 'AM'
  h = h % 12
  if (h === 0) h = 12
  return `${days[d.getDay()]} ${h}:${m} ${ap}`
}

export const clockText = ref(clockNow())
setInterval(() => { clockText.value = clockNow() }, 15000)
