// The panes the Settings windows can present, and their URL slug<->name mapping. Like
// FORM_ASPECTS this is a pure leaf (no store/registry deps) so route-map can read the id sets
// without pulling the desktop graph in. Two parallel pane sets live here:
//   • SETTINGS_PANES — the per-user Settings window (ADR-0027): /settings/<pane>
//   • APP_SETTINGS_PANES — the per-app settings window: /<app>/settings/<pane>
// Each has a default pane that projects to the bare path (no trailing segment), so existing
// URLs are unchanged. Every pane name is a single word, so the lowercase slug round-trips.

// The per-user Settings panes: Account (the logged-in user's identity), General (window
// behavior), Appearance (theme), Wallpaper, Dock. The order is the left-nav order.
export const SETTINGS_PANES = ['Account', 'General', 'Appearance', 'Wallpaper', 'Dock'] as const
export type SettingsPane = (typeof SETTINGS_PANES)[number]

// The default pane — a bare /settings URL (no trailing segment) resolves to this, so the
// existing Settings URL is unchanged.
export const DEFAULT_SETTINGS_PANE: SettingsPane = 'General'

// The per-app settings panes (the /<app>/settings window). Same slug<->name contract as the
// per-user panes above; General is the default and projects to the bare /<app>/settings path.
export const APP_SETTINGS_PANES = ['General', 'Members', 'Notifications', 'Integrations', 'Customize'] as const
export type AppSettingsPane = (typeof APP_SETTINGS_PANES)[number]

export const DEFAULT_APP_SETTINGS_PANE: AppSettingsPane = 'General'

// The URL slug for a pane (lowercase; every pane is a single word, so this round-trips through
// paneForSlug). Used to build the /settings/<slug> path segment.
export const slugForPane = (pane: string): string => pane.toLowerCase()

// Resolve a URL slug back to a canonical pane name within `panes`, or undefined when it matches
// none — the whitelist guard (like isAspectId), so a junk segment degrades to the default pane
// instead of opening a blank one.
export const paneForSlug = (panes: readonly string[], slug?: string | null): string | undefined =>
  panes.find((pane) => pane.toLowerCase() === slug)
