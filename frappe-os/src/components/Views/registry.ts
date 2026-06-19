// The view-renderer seam: maps a doctype-view name to the component that renders it.
// Mirrors the applet resolver (store/registry `resolveApplet`) but for the bundled,
// first-party views. The Registry already declares WHICH views a doctype has (the
// `doctype-view` contributions, `useRegistry().views`); this resolves one to its Vue
// component. Builtin views come from BUILTIN_VIEWS; an applet-backed view contribution
// (payload.appletId) resolves through the same applet loader — so a custom view drops in
// without touching DoctypeView or any view component. Adding a builtin view (kanban,
// report, calendar, …) is a new component plus one BUILTIN_VIEWS entry — never a union edit.
import type { Component } from 'vue'
import { useRegistry, resolveApplet } from '@/registry'
import { OSForm } from '../Form'
import { OSList } from '../List'

const BUILTIN_VIEWS: Record<string, Component> = {
  list: OSList,
  form: OSForm,
}

// Resolve the component that renders `view` of `doctype`. Applet-backed views resolve
// asynchronously; builtins are instant. Falls back to the list view for an unknown name.
export async function resolveView(doctype: string, view: string): Promise<Component> {
  const payload = useRegistry().views(doctype).find((v) => v.view === view)
  if (payload?.appletId) return resolveApplet(payload.appletId)
  return BUILTIN_VIEWS[view] || BUILTIN_VIEWS.list
}
