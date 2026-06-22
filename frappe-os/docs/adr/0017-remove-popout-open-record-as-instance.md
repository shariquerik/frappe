# Remove pop-out windows; open a record in a new window as an app instance

We removed the `rec:` "pop-out" window kind (role `record`). Opening a record in a new
window now mints an ordinary app **Instance** whose Surface starts on that record's form
(`newAppWindow(appForDoctype(dt), formSurface(dt, name))`), and a list row exposes the
choice via a right-click context menu: **Open** (same window, the existing inline
navigation) and **Open in New Window** (a new instance). Left-click is unchanged (same
window). The form-toolbar "Pop out" button is deleted with no replacement.

## Why

A pop-out and its inline form differed *only by container* — identical content, identical
URL — so they shared a path and could be distinguished only by `history.state.osWin`. That
made them the one window kind browser back/forward couldn't toggle and reload couldn't
restore (the gap ADR-0016 deferred). The two ways to close that gap were: (a) give pop-outs
a second OS-reserved query key (`?popout=1`) mirroring `?instance=n`, or (b) remove the
pop-out concept entirely. We chose (b): a pop-out's "pinned, this-record-only" feel was a
niche nobody asked for, and a new app instance already delivers "this record in its own
window" while being fully addressable. Removing the kind deletes code *and* dissolves the
deferred problem — there is now no window kind that shares a content-path, so `instance`
stays the sole shared-path discriminator.

## The list-row menu is direct core behaviour, not the action model

CONTEXT.md lists "a context menu" as a **Region** that hosts **Actions**, so a purist
reading would make "Open in New Window" a Command placed by an Action and resolved by the
pure-data engine. We deliberately did **not** do that yet, because the action model can't
express a row-targeted action today: **Context excludes `selection`** (depth-3: global →
window → surface — `actions/types.ts`), and the Handler kinds (`navigate` a *fixed* Surface,
`run` a `(os) => void`) can't carry "the record I clicked." Routing row opens through the
resolver would mean building selection-into-Context *and* parameterized handlers — turning a
cleanup into a major action-model expansion.

So the two built-in opens are treated as **core OS row interaction** (like click-to-open
already is), wired straight to `openRecordInline` / `newAppWindow` — the same way MenuBar.vue
still renders six menus literally while only `menubar:file` is migrated. When an *app* later
wants to contribute its own row actions ("Convert Lead"), **that** is the slice that forces
selection-into-Context and a real `contextmenu:listrow` Region. The built-in opens may fold
into that Region then, or stay core; either way the deviation here is intentional, not debt.
