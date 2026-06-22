/// <reference types="vite/client" />
/// <reference types="unplugin-icons/types/vue" />

// Lets TS understand `*.vue` imports and Vite's `import.meta.env` / `?`-suffixed
// asset imports once components start using `<script lang="ts">`.
declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}
