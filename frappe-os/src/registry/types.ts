// Registry contribution + boot payload shapes (surface-and-registry.md §2). The index
// logic lives in ./index.ts; the boot payload that seeds it is fetched in data/boot.ts.
// Re-exported via @/types.

// A single Registry contribution. Identity tuple (type,target,name,sourceApp) is unique
// across the merged registry (ADR-0007); `payload` is type-specific (AppDef for 'app',
// DoctypeMeta for 'display-config', DoctypeViewPayload for 'doctype-view', Card for
// 'dashboard-card'). `order` orders collections / breaks singleton patch ties.
export interface Contribution {
  type: string
  target: string
  name: string
  sourceApp: string
  payload: unknown
  order?: number
}

// The server-merged, permission-filtered Registry the boot payload carries
// (ADR-0005/0010). `schemaVersion` is tolerant (ADR-0008): the client indexes the
// contribution types it knows and ignores the rest, so newer/older servers degrade.
export interface OsRegistryData {
  schemaVersion: number
  contributions: Contribution[]
}

// What www/os.py injects (or the whitelisted boot() returns): the logged-in user, the
// CSRF token used to sign writes, the user's roles, the merged Registry, and the
// permission map. Read from untrusted globals / JSON, so everything is best-effort:
// `registry` may be a legacy bare array, so registry/index.ts guards the shape before use.
export interface BootData {
  user: string | null
  csrf_token: string
  roles: string[]
  registry: OsRegistryData | unknown[]
  permissions: Record<string, Record<string, boolean>>
}
