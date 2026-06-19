// Feature-local types for the Window folder. `Crumb` is one breadcrumb in the window's
// title bar; `DocProps` is the prop bundle OSWindow hands to DocView (DocView fetches its
// own list/doc/field-schema from the store, so these are just the window-level wiring).
import type { DocViewDoc, DoctypeMeta } from '@/types'

export interface Crumb {
  label: string | undefined
  clickable: boolean
  go?: () => void
}

export interface DocProps {
  doc: DocViewDoc
  meta: DoctypeMeta | null
  presence: { label: string }[]
  onOpen?: (doctype: string, name: string) => void
  onNew?: (doctype: string) => void
  onCreated?: (doctype: string, name: string) => void
}
