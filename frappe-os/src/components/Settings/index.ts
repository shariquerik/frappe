// Public surface of the Settings feature folder: the per-app settings sheet (AppSettings), the
// per-user desktop-wide Settings window, and the wallpaper picker it embeds. Importers use
// `@/components/Settings`, never a path into the folder, so the internals stay free to move.
export { default as AppSettings } from './AppSettings.vue'
export { default as Settings } from './Settings.vue'
export { default as WallpaperPicker } from './WallpaperPicker.vue'
