// Public surface of the `actions` module — the Action/extension model engine (CONTEXT.md →
// Command / Action / Region / Handler / Context / Eligibility). The resolver is pure data
// (no `eval`, no handler loading); only `invoke` reaches a run Handler, by id. This slice
// renders just the File menu from contributions (fileMenuOptions); the other six menus in
// MenuBar.vue stay literal pending later incremental migration.
export { resolve } from './resolve'
export { isEligible } from './eligibility'
export { specificity, compareSpecificity } from './specificity'
export { scopeWhen, effectiveWhen, SCOPE_TIERS } from './scope'
export { contextForOS } from './context'
export { fileMenuOptions } from './menubar'
export { toolbarItems } from './toolbar'
export type { ToolbarItem } from './toolbar'
export { projectRegion } from './project'
export {
  REGIONS, regionById, regionRenders,
  FILE_REGION, LIST_TOOLBAR, LIST_SELECTION, FORM_TOOLBAR,
} from './regions'
export type { Region } from './regions'
export { FILE_COMMANDS, FILE_ACTIONS, invoke } from './contributions'
export { PLACEMENT_COMMANDS, PLACEMENT_ACTIONS, surfaceToRef, liveVerb, suppressedPlacementCommands } from './placement-verbs'
export { BULK_RUN_HANDLERS } from './bulk-verbs'
