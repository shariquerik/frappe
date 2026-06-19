// Public surface of the Views feature folder: the registry-resolved view dispatcher
// (DoctypeView) and the resolver that maps a doctype-view name to its component
// (resolveView). Importers use `@/components/Views` rather than reaching at the files inside.
export { default as DoctypeView } from './DoctypeView.vue'
export { resolveView } from './registry'
