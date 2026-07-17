// Guard against a cyclic CHUNK graph — the failure mode that silently kills the OS at boot.
//
// A cycle inside a chunk is fine: the bundler owns the module order there. A cycle BETWEEN
// chunks is not — chunks are ESM modules, so the browser picks the evaluation order, and one
// chunk inevitably runs while its partner is still un-evaluated. Every binding it reads from
// that partner is then a `var`-hoisted `undefined` (not a TDZ ReferenceError, so nothing
// throws at the read site). It only blows up further along, at the first call:
//
//     TypeError: at is not a function     // `at` = Vue's `_export_sfc`, still undefined
//
// The message names a mangled local in a hashed chunk, so it points nowhere near the cause.
// Vite/rolldown emit such graphs without warning, so we assert on the bundle instead. See the
// `advancedChunks` groups in vite.config.js for the fix this protects.

/**
 * Find static-import cycles in an emitted bundle.
 *
 * Only static `imports` count — a dynamic import is a lazy edge that the browser resolves
 * after both chunks have evaluated, so it can't produce this failure.
 *
 * @param {Record<string, { type?: string, imports?: string[] }>} bundle
 * @returns {string[][]} one entry per cycle, each a closed path (first === last)
 */
export function findChunkCycles(bundle) {
  const importsOf = (name) => (bundle[name]?.type === 'chunk' && bundle[name].imports) || []
  const cycles = []
  const state = new Map()
  const path = []

  const visit = (name) => {
    if (state.get(name) === 'done') return
    if (state.get(name) === 'active') {
      cycles.push([...path.slice(path.indexOf(name)), name])
      return
    }
    state.set(name, 'active')
    path.push(name)
    for (const next of importsOf(name)) visit(next)
    path.pop()
    state.set(name, 'done')
  }

  for (const name of Object.keys(bundle)) if (bundle[name].type === 'chunk') visit(name)
  return cycles
}

/** Fail the build if any two chunks statically import each other. */
export function assertNoChunkCycles() {
  return {
    name: 'os-assert-no-chunk-cycles',
    generateBundle(_options, bundle) {
      const cycles = findChunkCycles(bundle)
      if (!cycles.length) return
      const drawn = cycles.map((c) => `  ${c.join(' → ')}`).join('\n')
      this.error(
        `${cycles.length} cyclic chunk import(s) — the OS would die at boot with a ` +
          `"not a function" TypeError on a hoisted binding:\n${drawn}\n\n` +
          `Fix by grouping the cycle's modules into one chunk via ` +
          `build.rollupOptions.output.advancedChunks in vite.config.js.`,
      )
    },
  }
}
