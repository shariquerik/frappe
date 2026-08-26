// PROTOTYPE stub. Reads the Python-assembled build manifest and enforces singletons.
//
// The manifest: [{ app, app_route, source_dir, deps }] (#42069 §1).
//
// enforceSingletons fails HERE -- before vite starts -- naming the offending app and
// dependency, and exits non-zero. Six packages: the charter's four plus reka-ui and
// dompurify, which are on today's SINGLETONS list (ui/vite/index.js:21) because
// duplicate instances broke provide/inject in real bugs.

export function readManifest() {}
export function enforceSingletons(manifest) {}
