// The Finder's Locations (ADR-0024) — the pure projections behind the sidebar. The Finder is the
// OS's cross-app navigator and the principal drag-source for Placements; each Location is a list of
// draggable items, every item expressed as the SAME app-qualified surface reference (ADR-0021)
// Placements and Default surface use. Kept Vue-free so vitest covers the reprojection without a DOM.
//
// Most Locations REPROJECT data that already lives elsewhere rather than introduce a new store:
// Doctypes flattens each app's boot workspace-doctype catalog, Workspaces flattens the per-app
// workspace catalog, Recents mirrors the recents log, and Favorites mirrors the viewer's resolved
// desktop + dock Placements. Only Applications is assembled fresh, from the permission-filtered app list.
import { useRegistry, appDoctypes, orderedWorkspaces } from '@/registry'
import { placementView, usePlacements, type PlacementView } from '@/placements'
import { useRecents } from '@/recents'
import type { ResolvedPlacement, SurfaceRef } from '@/types'

// One draggable Finder tile: a surface reference plus its derived presentation. Presentation is
// reused from placementView (the Registry-derived label/icon the desktop + dock already use), so a
// Finder tile and the pin it creates look identical.
export interface FinderItem extends PlacementView {}

// The Locations (ADR-0024). Open list, not a closed union — additive. Recents leads the rail (the
// macOS Finder shape: what you touched last is the fastest thing to reach); Applications stays the
// default open Location so a deep-link / dock launcher lands on the launcher.
export const LOCATIONS = ['Recents', 'Applications', 'Workspaces', 'Doctypes', 'Favorites'] as const
export type Location = (typeof LOCATIONS)[number]

// Project a surface reference to a Finder tile, reusing the desktop/dock presentation deriver so a
// tile and the placement a drag-out creates share one label/icon. `region` is irrelevant to the
// view, so a throwaway desktop placement is built purely to drive placementView.
function itemFor(ref: SurfaceRef): FinderItem {
  return placementView({ region: 'desktop', ref })
}

// Applications — every app the viewer may see (the Registry is permission-filtered server-side, so
// presence IS the permission signal, ADR-0010) as a bare-app reference, plus a Settings entry that
// opens the per-user Settings window. The launcher and the primary drag-source.
export function applicationItems(): FinderItem[] {
  return useRegistry().apps().map((app) => itemFor({ app: app.id }))
}

// Doctypes — a flattened cross-app catalog REPROJECTED from each app's boot workspace doctypes
// (ADR-0042: appDoctypes is the deduped union across an app's boot-delivered workspaces). Each
// doctype becomes a list reference; the catalog is
// de-duped cross-app (a doctype in several apps appears once) and stably ordered by registry app
// order. Drag one out → a list Placement.
export function doctypeItems(): FinderItem[] {
  const seen = new Set<string>()
  const out: FinderItem[] = []
  for (const app of useRegistry().apps()) {
    for (const doctype of appDoctypes(app.id)) {
      if (seen.has(doctype)) continue
      seen.add(doctype)
      out.push(itemFor({ doctype, view: 'list' }))
    }
  }
  return out
}

// Workspaces — a flattened cross-app catalog REPROJECTED from each app's boot workspaces (ADR-0042:
// orderedWorkspaces is the seeded, sequence-ordered workspace list). Each workspace becomes an
// {app, workspace} reference (issue #02), stably ordered by registry app order then workspace order.
// NOT de-duped like Doctypes: a workspace is app-scoped, and the `app` in the reference keeps two apps'
// same-slug workspaces distinct. Drag one out → a workspace Placement that reopens that workbench.
export function workspaceItems(): FinderItem[] {
  const out: FinderItem[] = []
  for (const app of useRegistry().apps())
    for (const ws of orderedWorkspaces(app.id)) out.push(itemFor({ app: app.id, workspace: ws.id }))
  return out
}

// Recents — the per-user, server-resolved log of recently opened records (ADR-0024), newest-first,
// deduped by reference and capped server-side. Each entry is a form reference, so a tile labels by
// its record name (placementView) and a drag-out → a form Placement. Reprojects the live recents
// store (useRecents), so a record opened this session shows here without a reload.
export function recentItems(): FinderItem[] {
  return useRecents().map((recent) => itemFor(recent.ref))
}

// Favorites — a read-only MIRROR of the viewer's resolved desktop + dock Placements (see what you've
// pinned). It is NOT a third placement region; drag-out still targets desktop/dock only, and the
// "remove" affordance clears the user's own pin (removePlacementOverride). Mirrors the live resolved
// list, so a pin added/removed elsewhere reflects here without a reload.
export function favoritePlacements(): ResolvedPlacement[] {
  const places = usePlacements()
  return [...places.desktop(), ...places.dock()]
}

// The items for a Location name (Favorites is rendered from its placements, so it returns []).
export function itemsFor(location: Location): FinderItem[] {
  if (location === 'Applications') return applicationItems()
  if (location === 'Workspaces') return workspaceItems()
  if (location === 'Doctypes') return doctypeItems()
  if (location === 'Recents') return recentItems()
  return []
}
