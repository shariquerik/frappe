// The URL side-channel's parsed shape. Re-exported via @/types.

// The route's path params, as parsed by the router. Any segment may be absent
// (a bare desktop has none); dead doctype/record names degrade gracefully downstream.
export interface RouteParams {
  app?: string
  doctype?: string
  name?: string
}
