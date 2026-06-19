// frappe-ui (beta) ships raw .ts source — its `exports.types` points at src/index.ts,
// not prebuilt .d.ts — so vue-tsc would type-check the entire library (which doesn't
// pass under our strict config). Mapped via `paths` in tsconfig.json so frappe-ui
// resolves here as `any`.
//
// FOLLOW-UP: this trades away frappe-ui's own types. When migrating a component to
// `<script lang="ts">` that imports a frappe-ui symbol not listed below, add it here.
// Remove this shim once frappe-ui ships prebuilt declarations.
declare const whatever: any

export const Button: any
export const Avatar: any
export const ListView: any
export const Dropdown: any
export const Badge: any
export const Switch: any
export const FormControl: any
export const toast: any
export const ToastProvider: any
export default whatever
