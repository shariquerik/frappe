// Extension-point types this client understands (ADR-0004 closed-but-data-driven set).
// The one home for the contribution `type` strings; the seed, the server overlay, and the
// index-builder all fold contributions against these. (classify.ts keeps its own literal
// copy on purpose, so the classifier stays a registry-free unit — see its header.)
export const APP_T = 'app'
export const DISPLAY = 'display-config'
export const VIEW = 'doctype-view'
export const CARD = 'dashboard-card'
export const APPLET = 'applet'
export const COMMAND = 'command'   // the Action model's verb (CONTEXT.md → Command)
export const ACTION = 'action'     // a verb's placement into a Region (CONTEXT.md → Action)
export const DEFAULT_SURFACE = 'default-surface' // an app's declared surface reference (ADR-0021)
export const MENU = 'app-menu'     // an app-declared menu-bar menu, target = the owning app (ADR-0039)
