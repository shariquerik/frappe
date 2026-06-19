// Broker (ADR-0009, Strategy 2): stable-URL re-export of the host's OWN bundled `frappe-ui`,
// so an applet's external `frappe-ui` specifier resolves (via the import map) to the host's
// single instance — one component registry, one style world. See ./vue.ts.
export * from 'frappe-ui'
