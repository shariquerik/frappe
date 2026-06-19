// Feature-local types for the Window folder. `Crumb` is one breadcrumb in the window's
// title bar. The view body's prop bundle is the shared `ViewProps` (@/types) — OSWindow
// assembles it from the focused window's surface and hands it to DoctypeView, which fetches
// its own list/doc/field-schema from the store.

export interface Crumb {
  label: string | undefined
  clickable: boolean
  go?: () => void
}
