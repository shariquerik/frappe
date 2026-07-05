// The Finder's Locations (ADR-0024) — the pure projections behind the sidebar. The Finder is the
// OS's cross-app navigator and the principal drag-source for Placements; each Location is a list of
// draggable items, every item expressed as the SAME app-qualified surface reference (ADR-0021)
// Placements and Default surface use. Kept Vue-free so vitest covers the reprojection without a DOM.
//
// Most Locations REPROJECT data that already lives elsewhere rather than introduce a new store:
// Doctypes groups the boot doctype catalog into a section per workspace, Workspaces groups the
// per-app workspace catalog into a section per app, Recents mirrors the recents log, and Favorites
// mirrors the viewer's resolved desktop + dock Placements. Only Applications is assembled fresh, from
// the permission-filtered app list. A Location projects to sections (grouped Locations carry real
// headings; flat ones are one heading-less section); the tiles within a section are all draggable.
import { useRegistry, orderedWorkspaces, workspaceDoctypes } from '@/registry'
import { placementView, usePlacements, type PlacementView } from '@/placements'
import { useRecents } from '@/recents'
import type { ResolvedPlacement, SurfaceRef } from '@/types'

// One draggable Finder tile: a surface reference plus its derived presentation. Presentation is
// reused from placementView (the Registry-derived label/icon the desktop + dock already use), so a
// Finder tile and the pin it creates look identical.
export interface FinderItem extends PlacementView {}

// A titled group of tiles within a Location. Workspaces group by app, Doctypes group by workspace; a
// flat Location (Applications / Recents) is one section with an empty `label` (rendered heading-less).
// An empty `label` is the "no heading" signal, so the same render path serves flat and grouped alike.
export interface FinderSection {
  label: string
  items: FinderItem[]
}

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

// Doctypes — a cross-app catalog REPROJECTED from boot workspace data, GROUPED into a section per
// workspace (ADR-0042: workspaceDoctypes is a workspace's boot-delivered doctype set). Each doctype
// becomes a list reference; sections are ordered by registry app order then workspace order, each
// labelled by its workspace. Unlike a flat catalog it is NOT de-duped across workspaces — a doctype
// that belongs to several workspaces appears under each, since the grouping IS by workspace. A
// workspace with no doctypes is skipped. Drag one out → a list Placement.
export function doctypeSections(): FinderSection[] {
  const out: FinderSection[] = []
  for (const app of useRegistry().apps()) {
    for (const ws of orderedWorkspaces(app.id)) {
      const doctypes = workspaceDoctypes(app.id, ws.id)
      if (!doctypes.length) continue
      out.push({ label: ws.label, items: doctypes.map((doctype) => itemFor({ doctype, view: 'list' })) })
    }
  }
  return out
}

// Workspaces — every app's boot workspaces (ADR-0042: orderedWorkspaces is the seeded, sequence-
// ordered list) as {app, workspace} references (issue #02), GROUPED into a section per app and
// labelled by the app's name. Ordered by registry app order then workspace order. An app with no
// workspaces contributes no section. Drag one out → a workspace Placement that reopens that workbench.
export function workspaceSections(): FinderSection[] {
  const out: FinderSection[] = []
  for (const app of useRegistry().apps()) {
    const workspaces = orderedWorkspaces(app.id)
    if (!workspaces.length) continue
    out.push({ label: app.name, items: workspaces.map((ws) => itemFor({ app: app.id, workspace: ws.id })) })
  }
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

// The sections for a Location: grouped ones (Workspaces by app, Doctypes by workspace) return their
// real headings; flat ones (Applications, Recents) return a single heading-less section. Favorites is
// rendered from its placements, not tiles, so it has none.
export function sectionsFor(location: Location): FinderSection[] {
  if (location === 'Applications') return [{ label: '', items: applicationItems() }]
  if (location === 'Workspaces') return workspaceSections()
  if (location === 'Doctypes') return doctypeSections()
  if (location === 'Recents') return [{ label: '', items: recentItems() }]
  return []
}

// The flat tile list for a Location — every section's tiles concatenated. The render path uses
// sectionsFor (to draw headings); this is the flat view for consumers that only need the tiles.
export function itemsFor(location: Location): FinderItem[] {
  return sectionsFor(location).flatMap((section) => section.items)
}
