// Public surface of the Form feature folder: the editable record form plus its pure
// live-schema→FormLayout projection. Importers use `@/components/Form`, never a path into
// the folder, so the internals stay free to move.
export { default as OSForm } from './OSForm.vue'
export { buildFormLayout } from './layout'
export type { SchemaField, LayoutField, LayoutTab, LayoutSection, LayoutColumn } from './types'
