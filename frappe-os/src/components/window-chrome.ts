import type { InjectionKey, Ref, ShallowRef } from "vue";

// The injection contract between an OSWindow and the view body it hosts — shared across the
// Window, Form and List feature folders, so it lives at the components root rather than inside
// Window/ (a view body reaching past the Window barrel into the folder would break the seam;
// re-exporting it from that barrel would drag OSWindow.vue into a Window→Views→Form→Window
// import cycle). A leaf module: it imports only Vue, so any component may inject from it.

// Per-window teleport target for a view's primary actions (list "New", form "Save"/menu).
// OSWindow provides it — it's the common ancestor of the chrome bar and the view body — and
// AppToolbar binds it to its right-hand action zone, so one bar carries both the breadcrumb
// chrome and the view's actions instead of stacking a second toolbar underneath. The ref is
// null when the window has no chrome action zone (record/settings/applet windows have no
// AppToolbar); views then fall back to rendering their actions inline via Teleport `disabled`.
export const TOOLBAR_SLOT: InjectionKey<ShallowRef<HTMLElement | null>> =
	Symbol("os-toolbar-slot");

// Whether the host window is the focused one. OSWindow provides its `focused` computed so a
// view body can quiet its primary action when the window is in the background — the list
// "New" button rides solid while focused, subtle otherwise. Absent for chromeless mounts;
// views default to the focused (solid) look when unprovided.
export const WINDOW_FOCUSED: InjectionKey<Ref<boolean>> = Symbol("os-window-focused");
