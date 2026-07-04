// The URL side-channel's parsed shape. Re-exported via @/types.

// The route's path params, as parsed by the router. Any segment may be absent
// (a bare desktop has none); dead doctype/record names degrade gracefully downstream.
// `instance` is the parsed `?instance=n` query discriminator naming a non-canonical app
// window instance (`app:<id>#n`); absent/null means the canonical instance.
export interface RouteParams {
  app?: string
  // The optional workspace segment between app and doctype (ADR-0040), resolved by parseSegments
  // from the raw path only when it names a known workspace of `app` — else the segment is the
  // doctype and this stays absent (honest disambiguation, no doctype-name guessing).
  workspace?: string
  doctype?: string
  name?: string
  // The trailing path segment after the record name — read as a form Aspect id only when it
  // matches a known Aspect (ADR-0018); otherwise ignored (no phantom Aspect).
  aspect?: string
  instance?: number | null
}

// What `pathForFocus` projects the focused window to: a content path plus a derived
// query (only the reserved `instance` key today). Kept structured rather than a glued
// string so the query composes safely with any future store-derived query (e.g. list
// filters) instead of being concatenated onto a path that may already carry a `?`.
export interface FocusLocation {
  path: string
  query: Record<string, string>
}
