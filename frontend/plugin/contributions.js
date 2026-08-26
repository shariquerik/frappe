// The vite plugin that synthesises `virtual:frappe/contributions`.
//
// Modelled directly on ui/vite/extensionHost.js, which already emits virtual modules
// in this tree (#42068 §9). PROTOTYPE: the globbing is sketched, not written.

const VIRTUAL_ID = 'virtual:frappe/contributions'

export default function contributions(manifest) {
  return {
    name: 'frappe-contributions',
    resolveId: (id) => (id === VIRTUAL_ID ? '\0' + VIRTUAL_ID : undefined),
    load(id) {
      if (id !== '\0' + VIRTUAL_ID) return
      return generate(manifest)
    },
  }
}

// `manifest` is the Python-assembled {app, app_route, source_dir, deps} list from
// #42069 §1. It is what makes this NOT a wildcard glob: only INSTALLED apps are
// swept, and each entry carries its app name, so identity survives into the emitted
// source. A literal `import.meta.glob('../../*/**/frontend/record.js')` could do
// neither -- the pattern must be a static literal and a raw glob loses the app.
function generate(manifest) {
  const lines = []
  for (const { app, source_dir } of manifest) {
    // <source_dir>/<module>/doctype/<scrubbed>/frontend/{record,list}.js
    // <source_dir>/<module>/custom/<scrubbed>/{record,list}.js
    // <source_dir>/<module>/frontend/pages/<slug>.js     <-- scaffold's invention
    //
    // App, module, doctype and kind all fall out of the path. Nothing is parsed out
    // of file contents, so a file that fails to import cannot break discovery.
    lines.push(`// ...emit one entry per matched file for ${app}, tagged app: '${app}'`)
  }
  // slugs is emitted here too, over ALL doctypes regardless of can_read (#42068 §2).
  // It is build-time data, which is what makes resolveSlug synchronous in the router
  // where CRM needs a server round-trip today.
  return lines.join('\n')
}

// The one thing this cannot do, and #42105 owns it: the manifest is assembled from
// installed apps, and an app mid-install is not yet installed.
