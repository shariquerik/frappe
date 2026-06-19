// Command palette: open/close + the result list. Results are the curated surface —
// every app, and every doctype the apps own (live record search is a later add). The
// store mutates state.paletteOpen directly when opening a window, so this slice only
// owns the overlay flag and the result projection.
import { computed } from 'vue'
import { useRegistry, appForDoctype, listApplets } from '@/registry'
import { ICON } from '@/config/icons'
import { state } from './state'
import { openApp, openListGlobal, openApplet } from './windows'
import type { PaletteItem } from '@/types'

export const openPalette = () => { state.paletteOpen = true; state.paletteQuery = ''; state.menu = null }
export const closePalette = () => { state.paletteOpen = false }

function ownedDoctypes(): string[] {
  const owned: string[] = []
  useRegistry().apps().forEach((a) => (a.modules || []).forEach((mod) => mod.doctypes.forEach((dt) => {
    if (owned.indexOf(dt) < 0) owned.push(dt)
  })))
  return owned
}

export const paletteResults = computed(() => {
  const reg = useRegistry()
  const q = state.paletteQuery.trim().toLowerCase()
  const items: PaletteItem[] = []
  reg.apps().forEach((a) => {
    items.push({ label: 'Open ' + a.name, sub: 'Application', icon: ICON.grid, kindLabel: 'App', run: () => { openApp(a.id); closePalette() } })
  })
  listApplets().forEach((c) => {
    const appName = reg.app(c.appId)?.name || ''
    items.push({ label: c.label, sub: appName + ' · applet', icon: ICON.grid, kindLabel: 'Applet', run: () => { openApplet(c.appId, c.appletId); closePalette() } })
  })
  ownedDoctypes().forEach((dt) => {
    const m = reg.displayConfig(dt)
    const appName = reg.app(appForDoctype(dt))?.name || ''
    items.push({ label: dt, sub: appName + ' · list', icon: m ? m.icon : ICON.table, kindLabel: 'List', run: () => { openListGlobal(dt); closePalette() } })
  })
  const filtered = q ? items.filter((it) => (it.label + ' ' + it.sub).toLowerCase().includes(q)) : items.slice(0, 8)
  return filtered.slice(0, 30)
})
