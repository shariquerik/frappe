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
export const Dialog: any
export const ListView: any
export const ListHeader: any
export const ListRows: any
export const ListSelectBanner: any
export const ListFooter: any
export const Dropdown: any
export const Badge: any
export const Tooltip: any
export const SidebarItem: any
export const SidebarSection: any
export const Switch: any
export const Select: any
export const FormControl: any
export const Password: any
export const FileUploader: any
export const LoadingIndicator: any
export const toast: any
export const ToastProvider: any
export const ThemeSwitcher: any
export const useTheme: any
export default whatever
