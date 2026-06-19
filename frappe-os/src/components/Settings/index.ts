// Public surface of the Settings feature folder: the per-app settings sheet and the
// wallpaper picker (wallpaper choice is a settings concern). Importers use
// `@/components/Settings`, never a path into the folder, so the internals stay free to move.
export { default as SettingsDialog } from './SettingsDialog.vue'
export { default as WallpaperPicker } from './WallpaperPicker.vue'
