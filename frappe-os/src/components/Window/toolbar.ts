import type { InjectionKey, ShallowRef } from "vue";

// Per-window teleport target for a view's primary actions (list "New", form "Save"/menu).
// OSWindow provides it — it's the common ancestor of the chrome bar and the view body — and
// AppToolbar binds it to its right-hand action zone, so one bar carries both the breadcrumb
// chrome and the view's actions instead of stacking a second toolbar underneath. The ref is
// null when the window has no chrome action zone (record/settings/applet windows have no
// AppToolbar); views then fall back to rendering their actions inline via Teleport `disabled`.
export const TOOLBAR_SLOT: InjectionKey<ShallowRef<HTMLElement | null>> =
	Symbol("os-toolbar-slot");
