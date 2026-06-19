// Broker (ADR-0009, Strategy 2): a stable-URL entry that re-exports the host's OWN bundled
// `vue`. The frappe-os build dedupes this re-export onto the single Vue chunk it already
// ships, so the import map can point a separately-built applet's external `vue` specifier
// here and the applet binds to the host's ONE Vue runtime — never its own second copy.
// Separate file per specifier so the three brokers never namespace-merge.
export * from 'vue'
