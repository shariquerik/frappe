// Public surface of the Settings feature folder: the per-app settings sheet, the desktop-wide
// System Settings window, and the wallpaper picker it embeds. Importers use
// `@/components/Settings`, never a path into the folder, so the internals stay free to move.
export { default as SettingsDialog } from './SettingsDialog.vue'
export { default as SystemSettings } from './SystemSettings.vue'
export { default as WallpaperPicker } from './WallpaperPicker.vue'
