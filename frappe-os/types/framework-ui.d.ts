// `@framework/ui` is a `link:../ui` dependency whose source ships untyped. Without
// this shim, vue-tsc follows the import into ../ui/src and type-checks that entire
// package (hundreds of unrelated errors). Mapped via `paths` in tsconfig.json so the
// dep resolves here and is treated as `any`. Revisit if @framework/ui ships its own types.
declare const whatever: any

export const FormLayout: any
export const useDoctypeLayout: any
export default whatever
