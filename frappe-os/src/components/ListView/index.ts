// Public surface of the ListView feature folder: the OS list wrapper plus its pure
// column/cell mappers. Importers use `@/components/ListView` (or a relative `./ListView`)
// rather than reaching at the files inside, so the folder's internals stay free to move.
export { default as OSListView } from './OSListView.vue'
export { toListViewColumns, cellKind } from './list-columns'
export type { ListViewColumn, Cell, CellKindName } from './types'
