// Public surface of the Form feature folder: the editable record form. It renders the
// FormLayout that @framework/ui's useDoctypeLayout builds from the doctype meta. Importers
// use `@/components/Form`, never a path into the folder, so the internals stay free to move.
export { default as OSForm } from './OSForm.vue'
