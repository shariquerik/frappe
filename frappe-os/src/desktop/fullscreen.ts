// Browser fullscreen (the "Enter full screen" action). Uses the JS Fullscreen API to take
// the app edge-to-edge with NO browser chrome — no title bar, no PWA toolbar, no traffic
// lights. Deliberately different from the macOS green button (native window fullscreen),
// which keeps the browser's PWA toolbar above the app. Only the OS menu bar stays.
//
// The catch: the Fullscreen API only runs from a user gesture, so the green button can't
// trigger it. We bridge that: when the OS window goes full-size but the page isn't chromeless
// yet, we raise `fullscreenPromptOpen` — a dialog whose button IS a gesture.
import { ref } from 'vue'

// True while the page is in the Fullscreen API (chromeless). Tracks enter/exit however it
// happened — the menu action, Esc, or the ⌃⌘F shortcut — so the menu label can flip.
export const isFullscreen = ref(false)

// Offer the chromeless switch: the window is full-size but the bar is still showing.
export const fullscreenPromptOpen = ref(false)

// The OS window fills (essentially) the whole display. Catches native fullscreen and maximized
// states across browsers. Chrome flips the `display-mode: fullscreen` media query; Safari dock
// apps keep a bar and DON'T, so window size is the reliable cross-browser tell. Called only from
// real DOM events (never at import), so `screen`/`window` are always present here.
function windowFillsScreen(): boolean {
  const byMode = window.matchMedia?.('(display-mode: fullscreen)').matches
  const bySize = window.innerWidth >= screen.width - 2 && screen.height - window.innerHeight <= 160
  return !!byMode || bySize
}

// Offer only on a genuine transition INTO a filled window (green button / maximize). The window
// stays filled continuously through native-fullscreen → chromeless → the exit animation, so this
// false→true edge fires once per real maximize — never while shrinking back to a small window,
// and never on the native→chromeless handoff. Dismissing ("Not now") then sticks until the window
// actually leaves fullscreen. The `!fullscreenElement` guard skips the menu-driven path (already
// chromeless), so "View ▸ Enter full screen" never prompts.
let wasFilled = false
function reviewFullscreenOffer() {
  const filled = windowFillsScreen()
  if (filled && !wasFilled && !document.fullscreenElement) fullscreenPromptOpen.value = true
  if (!filled) fullscreenPromptOpen.value = false
  wasFilled = filled
}

if (typeof document !== 'undefined') {
  document.addEventListener('fullscreenchange', () => {
    isFullscreen.value = !!document.fullscreenElement
    // Going chromeless answers the prompt.
    if (document.fullscreenElement) fullscreenPromptOpen.value = false
  })
}

if (typeof window !== 'undefined') {
  // `resize` fires on maximize/fullscreen in every browser (including Safari); the display-mode
  // media query does not (Safari). Re-checking size on resize covers both; also react to the
  // media query where it exists for an instant response in Chrome.
  window.addEventListener('resize', reviewFullscreenOffer)
  window.matchMedia?.('(display-mode: fullscreen)').addEventListener('change', reviewFullscreenOffer)
}

export function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
  else document.documentElement.requestFullscreen().catch(() => {})
}

export function dismissFullscreenPrompt() {
  fullscreenPromptOpen.value = false
}
