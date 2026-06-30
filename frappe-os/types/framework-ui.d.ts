// `@framework/ui` is a `link:../ui` dependency whose source ships untyped. Without
// this shim, vue-tsc follows the import into ../ui/src and type-checks that entire
// package (hundreds of unrelated errors). Mapped via `paths` in tsconfig.json so the
// dep resolves here and is treated as `any`. Revisit if @framework/ui ships its own types.
declare const whatever: any

export const FormLayout: any
export const useDoctypeLayout: any

// List-view controls (frappe/frappe#40404) — adopted by the list Surface (ADR-0025).
// All resolve through this shim (`@framework/ui/*` is mapped here too), so each control,
// composable, and helper the OS imports must be listed as `any`.
export const useListView: any
export const useListData: any
export const ListViewShell: any
export const Filter: any
export const SortBy: any
export const QuickFilter: any
export const ColumnSettings: any
export const serializeFilters: any
export const parseFilters: any
export const serializeOrderBy: any
export const parseOrderBy: any
export const serializeColumns: any
export const parseColumns: any
export const getDefaultColumns: any

export default whatever
