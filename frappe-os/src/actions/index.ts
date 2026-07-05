// Public surface of the `actions` module — the Action/extension model engine (CONTEXT.md →
// Command / Action / Region / Handler / Context / Eligibility). The resolver is pure data
// (no `eval`, no handler loading); only `invoke` reaches a run Handler, by id. Every menu-bar
// menu renders from contributions through the one menuOptions path (menubar.ts) — no menu is a
// literal array.
export { resolve } from './resolve'
export { isEligible } from './eligibility'
export { specificity, compareSpecificity } from './specificity'
export { scopeWhen, effectiveWhen, SCOPE_TIERS } from './scope'
export { contextForOS } from './context'
export { menuOptions, fileMenuOptions, registerMenuSelection } from './menubar'
export type { MenuGroup, MenuItem } from './menubar'
export { toolbarItems } from './toolbar'
export type { ToolbarItem } from './toolbar'
export { projectRegion } from './project'
export {
  REGIONS, regionById, regionRenders, MENUBAR_REGIONS,
  SYSTEM_REGION, APP_REGION, FILE_REGION, EDIT_REGION, VIEW_REGION, WINDOW_REGION, HELP_REGION,
  LIST_TOOLBAR, LIST_SELECTION, FORM_TOOLBAR, DESKTOP_CONTEXT_REGION, DOCK_CONTEXT_REGION,
  APP_MENU_PREFIX, appMenuRegion, parseAppMenuRegion,
} from './regions'
export type { Region } from './regions'
export { MENUBAR_COMMANDS, MENUBAR_ACTIONS, suppressedToggleCommands, THEME_COMMAND, THEME_SUBMENU } from './menu-contributions'
export { desktopContextItems, dockContextOptions } from './context-menus'
export { invoke, registerRunHandlers } from './contributions'
export {
  dispatchShortcut, pickShortcut, shortcutIndex, canonicalBinding, eventBinding,
  formatShortcut, isTextEntry,
} from './shortcuts'
export { PLACEMENT_COMMANDS, PLACEMENT_ACTIONS, surfaceToRef, liveVerb, suppressedPlacementCommands } from './placement-verbs'
export { BULK_RUN_HANDLERS } from './bulk-verbs'
