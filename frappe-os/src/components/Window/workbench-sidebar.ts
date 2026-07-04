// The workbench window's sidebar items (ADR-0042): a workspace's derived doctypes turned into
// nav rows. The doctype list is derived + permission-filtered server-side (os_core/workspaces.py);
// this is the pure client half that maps each name into a rendered item and, crucially, degrades
// gracefully — a doctype the client can't build a row for is SKIPPED with a console.warn, never
// crashing the whole sidebar. One bad or edge doctype must not blank the workbench.

// Build the sidebar's items from a workspace's derived doctypes. `build` produces one item per
// doctype; a doctype it can't place (returns null/undefined, or throws) is dropped with a warning,
// so the rest of the sidebar still renders. Input order is preserved.
export function workbenchItems<T>(doctypes: string[], build: (doctype: string) => T | null | undefined): T[] {
  const items: T[] = []
  for (const doctype of doctypes) {
    try {
      const item = doctype ? build(doctype) : null
      if (item) items.push(item)
      else console.warn(`Workbench sidebar: skipping unresolvable doctype "${doctype}"`)
    } catch (error) {
      console.warn(`Workbench sidebar: skipping doctype "${doctype}"`, error)
    }
  }
  return items
}
