// Public surface of the CommandPalette feature folder: the ⌘K spotlight overlay. The
// result projection it renders lives in store/palette.ts (os.paletteResults); this folder
// owns the overlay chrome. Importers use `@/components/CommandPalette`.
export { default as CommandPalette } from './CommandPalette.vue'
