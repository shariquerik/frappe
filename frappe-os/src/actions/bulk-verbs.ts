// "Set as Open" over selected rows — the ADR-0032 bulk-action-as-data tracer. The verb (a Command)
// and its placement (a View-scoped Action into `list:selection`) are DATA in ToDo's `os/list.json`
// manifest, delivered on live meta and folded into the registry; only THIS imperative half — what
// the verb does — is bundled, registered into the open RUN_HANDLERS map the same way the File
// menu's and placement verbs' own defaults are (registerRunHandlers — no privileged core). This
// replaces desk's `listview_settings` `onload` bulk grab-bag: the declarative half is reachable by
// merge, the imperative half is a `run` Handler ref resolved lazily on invoke (ADR-0007).
import { registerRunHandlers } from './contributions'
import type { Invocation } from './types'

// Set the front list's selected rows to status "Open" through the records store's bulk-update write
// seam (which refreshes the list when the write runs inline; a 20+-row selection is enqueued in the
// background and refreshed later — see records.bulkUpdate). This is the ADR-0037 motivating case:
// it reads the `context` and `selection` straight off the Invocation the resolver already gated on,
// instead of re-digging focus state — the doctype and rows are the snapshot the user saw. A
// no-selection invoke is a clean no-op (the Region gate already hid the verb). Fire-and-forget
// (ADR-0007). The status field/value are hard-coded here; a data-parameterised bulk-set verb is
// deferred (.scratch/deferred-hardcoded/issues/16-parameterised-bulk-set-field-verb).
function setSelectedOpen({ context, selection, os }: Invocation): void {
  const doctype = context.doctype
  if (!doctype || !selection.length) return
  // Fire-and-forget, but own the error path — a rejected write is logged loudly, never left as an
  // unhandled rejection (this is the first async run Handler; the File-menu verbs are synchronous).
  os.bulkUpdate(doctype, selection, { status: 'Open' }).catch((error) => {
    console.error(`[actions] bulk "Set as Open" failed for ${doctype}`, error)
  })
}

// The bulk verbs as run Handlers, registered into the OPEN RUN_HANDLERS map the same way the File
// menu's own defaults are (registerRunHandlers) — the general app seam, no privileged core.
export const BULK_RUN_HANDLERS = { 'todo-set-open': setSelectedOpen }

// Wire the verbs into the open RUN_HANDLERS map on import (like placement-verbs.ts), so the
// server-delivered `todo-set-open` Command becomes invocable. project.ts pulls this module in.
registerRunHandlers(BULK_RUN_HANDLERS)
