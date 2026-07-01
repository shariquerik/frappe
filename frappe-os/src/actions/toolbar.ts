// Project a surface-embedded Region (list toolbar, selection/bulk bar, form toolbar) into a flat
// button list — the render contract the toolbar components draw, the sibling of menubar.ts's
// fileMenuOptions (vitest excludes .vue, so this pure projector is the tested seam). The shared
// resolve/join/gate lives in project.ts; a toolbar is just its flat mapping, so the selection/bulk
// bar returns [] until a selection exists (its Region gate) with no per-Action `when` (ADR-0032).
import { invoke } from './contributions'
import { projectRegion } from './project'
import type { OsStore } from '@/types'

// One rendered toolbar button: its label (a winning Action's commandPatch title overrides the
// Command's, ADR-0007) and its click, which fires the resolved Command's Handler by ref — the same
// invoke the File menu uses, so a run Handler stays fire-and-forget and reference-resolved.
export interface ToolbarItem {
  label: string
  onClick: () => void
}

export function toolbarItems(regionId: string, os: OsStore): ToolbarItem[] {
  return projectRegion(regionId, os).map(({ action, command }) => ({
    label: action.commandPatch?.title ?? command.title,
    onClick: () => invoke(command, os),
  }))
}
