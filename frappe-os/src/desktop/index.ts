// useOS() — the Frappe OS desktop shell state. The window-manager is split into local
// slices (state / geometry / windows / palette / persistence); this module re-assembles
// them — together with the live record caches (`@/data/records`) and the registry
// projections (`@/registry`) — into one composable with a stable public surface. All
// slices are module singletons sharing the one reactive `state`, so useOS() just hands
// back references — every caller sees the same desktop.
//
// The return type is left inferred: `OsStore` (data/types.ts) is `ReturnType<typeof useOS>`,
// so the store surface is derived from this assembly rather than hand-maintained. Adding
// a member here automatically widens OsStore for every consumer (route-map, components).
import { initials, pill } from '@/config/apps'
import { useRegistry, getMeta, appForDoctype, knownApplet, workspaceForSlug, workspaceForDoctype, orderedWorkspaces, defaultWorkspace, workspaceGroups, workspaceDoctypes, appDoctypes, defaultWorkspaceDoctypes, ICON } from '@/registry'
import type { AppDef } from '@/types'

import { state, clockText } from './state'
import {
  geoMap, startDrag, startResize, onPointerMove, onPointerUp,
  setDesktopEl, setDockEl, desktopRef, syncDesktopSize, startIconDrag, iconDragState, dragGhost, droppedOnDock,
} from './geometry'
import {
  presenceFor, winBack, winFwd,
  openApp, newAppWindow, openListGlobal, openRecordGlobal, openWorkspace, openApplet, openSurface, openRef, openList, openRecordInline, openRecordNewWindow, openNew, openAspect, openRow, goHome,
  focusWin, activateWin, restoreWin, closeWin, requestCloseWin, confirmCloseWin, cancelCloseWin, minimizeWin, clearFocus, toggleZoom,
  toggleSidebar, openAppSettings, closeAppSettings, setAppSettingsPane, enterSplit, exitSplit,
  wallpaperDefs, currentWp, setWallpaper, openSettings, closeSettings, setSettingsPane, openFinder, closeFinder, setFinderLocation, setRowOpenTarget, setRememberWindowSize, setDockPosition, setDockAutoHide, tog, isOn,
} from './windows'
import { openPalette, closePalette, paletteResults } from './palette'
import { openAbout, closeAbout } from './about'
import { isFullscreen, toggleFullscreen, fullscreenPromptOpen, dismissFullscreenPrompt } from './fullscreen'
import { selectedRecords, setSelection, selectionKind } from './selection'
import { selectIcon, clearIconSelection, isIconSelected, selectedIcons, soleSelectedIcon } from './icon-selection'
import { publishFocus, focusedKind } from './focus-kind'
import { hydrate, startAutosave } from './persistence'
import {
  recordObj, listFor, docFor, countFor, fieldMetaFor,
  loadList, loadMore, loadDoc, loadCount, loadFieldMeta, saveDoc, createDoc, bulkUpdate, refreshRecords,
} from '@/data/records'
import { ensureDoctype } from '@/data/doctype-resolver'

// Compatibility shape for the registry data components still read by namespace
// (os.DATA.APP / .ICON). The app map + APP_ORDER are projected from useRegistry(); they
// are exposed as GETTERS so a store reference captured before boot still reflects the
// registry seeded at boot (step 4) — the backing flipped to the server with no renderer
// change. Per-doctype display config is read via os.getMeta(doctype). ICON is the atlas.
function appMap(): Record<string, AppDef> {
  return Object.fromEntries(useRegistry().apps().map((a) => [a.id, a]))
}

export function useOS() {
  return {
    state,
    get DATA() { return { APP: appMap(), ICON } },
    get APP_ORDER() { return useRegistry().apps().map((a) => a.id) },
    geoMap, clockText, currentWp, paletteResults,
    initials, pill, getMeta, appForDoctype, knownApplet, workspaceForSlug, workspaceForDoctype, orderedWorkspaces, defaultWorkspace, workspaceGroups, workspaceDoctypes, appDoctypes, defaultWorkspaceDoctypes, ensureDoctype, wallpaperDefs, presenceFor,
    // live records store
    recordObj, listFor, docFor, countFor, fieldMetaFor,
    loadList, loadMore, loadDoc, loadCount, loadFieldMeta, saveDoc, createDoc, bulkUpdate, refreshRecords,
    // window lifecycle + navigation
    openApp, newAppWindow, openListGlobal, openRecordGlobal, openWorkspace, openApplet, openSurface, openRef, openList, openRecordInline, openRecordNewWindow, openNew, openAspect, openRow, goHome,
    winBack, winFwd, restoreWin, hydrate, startAutosave,
    focusWin, activateWin, closeWin, requestCloseWin, confirmCloseWin, cancelCloseWin, minimizeWin, clearFocus, toggleZoom,
    startDrag, startResize, onPointerMove, onPointerUp, startIconDrag, iconDragState, dragGhost, droppedOnDock,
    toggleSidebar, openAppSettings, closeAppSettings, setAppSettingsPane, enterSplit, exitSplit,
    setWallpaper, openSettings, closeSettings, setSettingsPane, openFinder, closeFinder, setFinderLocation, setRowOpenTarget, setRememberWindowSize, setDockPosition, setDockAutoHide, tog, isOn, openPalette, closePalette, openAbout, closeAbout,
    setDesktopEl, setDockEl, desktopRef, syncDesktopSize,
    // browser fullscreen (edge-to-edge, no browser chrome) — the "Enter full screen" action,
    // plus the prompt shown when the green button leaves the bar up
    isFullscreen, toggleFullscreen, fullscreenPromptOpen, dismissFullscreenPrompt,
    // the focus tier (ADR-0038): the front list's selection (kind + values, read by bulk run
    // Handlers) and which widget holds keyboard focus (published through publishFocus)
    selectedRecords, setSelection, selectionKind, publishFocus, focusedKind,
    // the desktop-icon selection (Finder-style): single-click selects, modified click multi-selects,
    // empty-wallpaper click clears; the tile paints its highlight off isIconSelected
    selectIcon, clearIconSelection, isIconSelected, selectedIcons, soleSelectedIcon,
  }
}
