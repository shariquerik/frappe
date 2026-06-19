// The backend-facing layer. This barrel exposes the *public* surface — the boot payload
// (boot.ts) and the OS API seam handed to applets (os-api.ts). The two internal slices are
// reached by their narrow paths instead, since their write-through actions (saveDoc/
// createDoc) intentionally shadow api.ts's raw ones and would collide in a flat re-export:
//   - `@/data/api`     — the raw Frappe client (records.ts wraps it; tests mock it)
//   - `@/data/records` — the live reactive caches (desktop/index assembles them into useOS)
export * from './boot'
export * from './os-api'
