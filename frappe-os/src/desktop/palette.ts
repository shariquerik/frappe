// Command palette: open/close + the result list. Results are the curated surface — every
// app, applet, doctype list, Settings pane, and desktop Command — plus LIVE server hits
// for the current query: records from the global-search index and doctype lists from the
// caller's FULL readable set, so every list on the site is one ⌘K away, not just the
// curated apps' (palette-search.ts owns that query→hits machine; this slice maps hits to
// rows). With no query the palette leads with the user's Recents, Spotlight-style. The
// store mutates state.paletteOpen directly when opening a window, so this slice only owns
// the overlay flag and the result projection.
import { computed, watch } from 'vue'
import fuzzysort from 'fuzzysort'
import { useRegistry, appForDoctype, listApplets, appDoctypes } from '@/registry'
import { ICON, dtIcon } from '@/registry'
import { SETTINGS_PANES } from '@/surface'
import { useRecents } from '@/recents'
import { state } from './state'
import {
  openApp, openListGlobal, openApplet, openRecordGlobal,
  openSettings, openAppSettings, openFinder, enterSplit,
} from './windows'
import { queueRecordSearch, recordHits, doctypeHits, resetRecordSearch } from './palette-search'
import type { PaletteItem } from '@/types'

export const openPalette = () => { state.paletteOpen = true; state.paletteQuery = ''; resetRecordSearch(); state.menu = null }
export const closePalette = () => { state.paletteOpen = false }

// Typing in the palette drives the debounced server searches alongside the synchronous
// curated filter below. Module-level watcher, like the store's other singleton effects.
watch(() => state.paletteQuery, (q) => queueRecordSearch(q))

const RESULT_CAP = 30
const EMPTY_QUERY_CURATED = 8
const EMPTY_QUERY_RECENTS = 5

function ownedDoctypes(): string[] {
  const owned: string[] = []
  useRegistry().apps().forEach((a) => appDoctypes(a.id).forEach((dt) => {
    if (owned.indexOf(dt) < 0) owned.push(dt)
  }))
  return owned
}

const SETTINGS_PANE_ICON: Record<string, string> = {
  Account: ICON.user, General: ICON.sliders, Appearance: ICON.palette, Wallpaper: ICON.image, Dock: ICON.grid,
}

// Every Settings destination: the per-user Settings window's panes plus each app's own
// settings window — "wall" lands on Wallpaper, "crm set" on CRM's settings.
function settingItems(reg: ReturnType<typeof useRegistry>): PaletteItem[] {
  const items: PaletteItem[] = SETTINGS_PANES.map((pane) => ({
    label: pane, sub: 'Settings', icon: SETTINGS_PANE_ICON[pane] || ICON.cog, kindLabel: 'Setting',
    run: () => { openSettings(pane); closePalette() },
  }))
  reg.apps().forEach((a) => items.push({
    label: a.name + ' settings', sub: 'App settings', icon: ICON.cog, kindLabel: 'Setting',
    run: () => { openAppSettings(a.id); closePalette() },
  }))
  return items
}

// Desktop-wide verbs the palette runs directly. The theme toggle imports frappe-ui
// lazily so the desktop store's module graph stays frappe-ui-free for unit tests.
function commandItems(): PaletteItem[] {
  return [
    { label: 'Toggle Dark Mode', sub: 'Appearance', icon: ICON.palette, kindLabel: 'Command',
      run: () => { closePalette(); void import('frappe-ui').then((m) => m.useTheme().toggleTheme()) } },
    { label: 'Change Wallpaper', sub: 'Settings', icon: ICON.image, kindLabel: 'Command',
      run: () => { openSettings('Wallpaper'); closePalette() } },
    { label: 'Open Finder', sub: 'Navigate', icon: ICON.grid, kindLabel: 'Command',
      run: () => { openFinder(); closePalette() } },
    { label: 'Enter Split View', sub: 'Windows', icon: ICON.sliders, kindLabel: 'Command',
      run: () => { enterSplit(); closePalette() } },
  ]
}

// The user's newest record opens (ADR-0024), leading the empty-query palette.
function recentItems(): PaletteItem[] {
  return useRecents().slice(0, EMPTY_QUERY_RECENTS).flatMap(({ ref }) => {
    const { doctype, name } = ref as { doctype?: string; name?: string }
    if (!doctype || !name) return []
    return [{
      label: name, sub: doctype, icon: dtIcon(doctype), kindLabel: 'Recent',
      run: () => { openRecordGlobal(doctype, name); closePalette() },
    }]
  })
}

export const paletteResults = computed(() => {
  const reg = useRegistry()
  const q = state.paletteQuery.trim()
  const items: PaletteItem[] = []
  reg.apps().forEach((a) => {
    items.push({ label: 'Open ' + a.name, sub: 'Application', icon: ICON.grid, kindLabel: 'App', run: () => { openApp(a.id); closePalette() } })
  })
  listApplets().forEach((c) => {
    const appName = reg.app(c.appId)?.name || ''
    items.push({ label: c.label, sub: appName + ' · applet', icon: ICON.grid, kindLabel: 'Applet', run: () => { openApplet(c.appId, c.appletId); closePalette() } })
  })
  const owned = ownedDoctypes()
  owned.forEach((dt) => {
    const m = reg.displayConfig(dt)
    const appName = reg.app(appForDoctype(dt))?.name || ''
    items.push({ label: dt, sub: appName + ' · list', icon: m ? m.icon : ICON.table, kindLabel: 'List', run: () => { openListGlobal(dt); closePalette() } })
  })
  items.push(...settingItems(reg))
  items.push(...commandItems())
  if (!q) return recentItems().concat(items.slice(0, EMPTY_QUERY_CURATED))
  // Curated items match fuzzily (Gameplan-style — typos and partial words still hit);
  // server hits arrive already ranked and append after.
  const matched = fuzzysort.go(q, items, { keys: ['label', 'sub'], limit: RESULT_CAP }).map((result) => result.obj)
  return matched.concat(doctypeItems(new Set(owned)), recordItems())
})

// Doctype-name hits from the caller's FULL readable set — any list on the site, opened
// through the on-demand resolver. Curated doctypes are dropped: the fuzzy pass above
// already surfaces them with their app branding.
function doctypeItems(owned: Set<string>): PaletteItem[] {
  return doctypeHits(state.paletteQuery).filter((dt) => !owned.has(dt)).map((dt) => ({
    label: dt, sub: 'List', icon: dtIcon(dt), kindLabel: 'List',
    run: () => { openListGlobal(dt); closePalette() },
  }))
}

// Live record hits for the current query, as palette rows after everything else.
// Identity (icon) comes from the registry's display config when the doctype is known;
// a hit from a doctype outside the curated apps still renders with the generic icon.
function recordItems(): PaletteItem[] {
  const reg = useRegistry()
  return recordHits(state.paletteQuery).map((hit) => {
    const m = reg.displayConfig(hit.doctype)
    const appName = reg.app(appForDoctype(hit.doctype))?.name || ''
    return {
      label: hit.title,
      sub: (appName ? appName + ' · ' : '') + hit.doctype,
      icon: m ? m.icon : ICON.table,
      kindLabel: 'Record',
      run: () => { openRecordGlobal(hit.doctype, hit.name); closePalette() },
    }
  })
}
