// Public surface of the `actions` module — the Action/extension model engine (CONTEXT.md →
// Command / Action / Region / Handler / Context / Eligibility). The resolver is pure data
// (no `eval`, no handler loading); only `invoke` reaches a run Handler, by id. This slice
// renders just the File menu from contributions (fileMenuOptions); the other six menus in
// MenuBar.vue stay literal pending later incremental migration.
export { resolve } from './resolve'
export { isEligible } from './eligibility'
export { specificity, compareSpecificity } from './specificity'
export { contextForOS } from './context'
export { fileMenuOptions } from './menubar'
export { FILE_COMMANDS, FILE_ACTIONS, FILE_REGION, invoke } from './contributions'
export { PLACEMENT_COMMANDS, PLACEMENT_ACTIONS, surfaceToRef, liveVerb, suppressedPlacementCommands } from './placement-verbs'
