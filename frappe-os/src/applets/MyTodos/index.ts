// Public surface of the MyTodos applet. The default export IS the SFC — that's the applet
// loader's contract (`load()` resolves to a module whose `default` is the component, see
// store/registry.ts `loadApplet`). The pure projection (todo-groups) is exported for tests
// and reuse. Importers use `@/applets/MyTodos`, never a path into the folder.
export { default } from './MyTodos.vue'
export { groupByDueDate, asText, toDateKey, priorityTheme } from './todo-groups'
export type { TodoGroup } from './types'
