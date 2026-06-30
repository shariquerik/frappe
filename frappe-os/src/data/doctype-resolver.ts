// On-demand doctype resolution: fold an uncurated-but-real doctype into the live registry so a
// deep link to any DocType opens its list — the boot registry ships only the curated set
// (REGISTRY_DOCTYPES). This orchestration lives in the data layer because it bridges the network
// seam (resolveDoctype) and the registry index (registerDoctype) the pure route-map can't cross.
import { resolveDoctype } from './api'
import { getMeta, registerDoctype } from '@/registry'

// One resolution per doctype, deduped + cached for the session: getMeta short-circuits a doctype
// already in the index (curated or previously folded), and the in-flight Map both dedupes
// concurrent deep links and caches the outcome — a missing/forbidden doctype stays false with no
// refetch storm. A doctype created mid-session won't re-resolve, an acceptable SPA-lifetime trade.
const resolving = new Map<string, Promise<boolean>>()

async function resolveAndFold(doctype: string): Promise<boolean> {
  const contribs = await resolveDoctype(doctype).catch(() => null)
  if (!contribs || !contribs.length) return false
  registerDoctype(contribs)
  return true
}

// Ensure a doctype is known to the registry, resolving it from the server when uncurated.
// Resolves true once the doctype exists in the index (the route can open its list), false when it
// is missing or forbidden (the route falls back to the app's default window). Never throws.
export function ensureDoctype(doctype: string): Promise<boolean> {
  if (getMeta(doctype)) return Promise.resolve(true)
  let pending = resolving.get(doctype)
  if (!pending) {
    pending = resolveAndFold(doctype)
    resolving.set(doctype, pending)
  }
  return pending
}
