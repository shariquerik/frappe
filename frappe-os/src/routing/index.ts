// The URL side-channel: the vue-router instance (router.ts — an empty catch-all route
// that only owns the path) and the pure focus↔URL projection (route-map.ts). main.ts
// imports both from `@/routing` and wires them to the store (guards, boot, watchers).
export * from './router'
export * from './route-map'
