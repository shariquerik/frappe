// The About-this-workspace dialog's open flag lives on the shared state (like `paletteOpen`); these
// two verbs are its only mutators, exposed through useOS() so the System-menu "About this workspace"
// command opens it and the dialog's own close dismisses it. The dialog content is read live by
// AboutDialog.vue (registry apps + boot), so there is nothing to load or cache here.
import { state } from './state'

export const openAbout = () => { state.aboutOpen = true; state.menu = null }
export const closeAbout = () => { state.aboutOpen = false }
