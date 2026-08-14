# What `page` promises

The compatibility policy for the Record page customization API — the `page` object
every handler receives. Three audiences program against it, and they carry very
different risk:

- **File scripts** are compiled into a frontend's own bundle. They are rebuilt with
  the host, so a break is caught at build time by the person who caused it. Cheapest
  to break.
- **Extensions** are separately built ESM files loaded at runtime through the host's
  import map. They are deployed on their own schedule against a host they did not
  build. The exposed audience.
- **Page Scripts** are text stored in a site's database. Nobody rebuilds them. They
  survive every upgrade, on sites with no developer watching. The audience that pays
  for a break.

## Start with the version reality

`@framework/ui` is version `0.0.0`, and every line of this API lives under
`src/experimental/`, whose own README says nothing in there is production ready. Two
of the four shared dependencies scripts may reach — `frappe-ui` and `@framework/ui` —
carry no stability guarantee at all.

So this document does not make a guarantee. It states an **intent**: which parts of
`page` are designed to outlive the implementation underneath them, which parts are
explicitly not, and how you find out when one moves. Everything below should be read
in that voice.

## The stable idea: verbs and events

What `page` is _for_ is a small, closed vocabulary:

- **Four surfaces** — `quickActions`, `headerActions`, `tabs`, `panelSections` — each
  speaking the same **seven verbs**: `add`, `hide`, `show`, `update`, `move`, `has`,
  `order`.
- **A fifth, `fields`**, speaking a strict subset of them — `hide`, `show`, `update`,
  `has`, `get`. The subset is the point: the other four arrange items a script may
  also create, while fields are authored elsewhere and a script only overrides their
  properties, so there is no `add`, `move` or `order` to mean anything.
- **A closed event list** — `refresh`, `before_save`, `after_save`, `on_tab_change`,
  `<fieldname>`, `<tablefield>_add`, `<tablefield>_remove`.
- **A handful of contracts**: every `page.dialog` verb resolves `null` when the reader
  dismissed the dialog, so `if (!result) return` is always the idiom; a throw in
  `before_save` blocks the save; a handler that throws is isolated, half-applied, and
  does not take other scripts down with it.

These are deliberately small, closed, and shaped like frappe rather than like the
component library beneath them. They are what we would fight hardest to preserve.

## The line: `page` never passes your options through

The important half of this policy is not the verb list. It is the boundary between
`page` and the unstable things reachable _through_ it.

**The rule: no `page` verb forwards an options object, a nested option shape, or a
callback argument straight to a dependency.** Everything a script hands `page` is
picked apart by the engine and forwarded key by key; everything the engine hands a
script's callback is the engine's own object.

This costs something real, and the cost is deliberate. It means a new option that
frappe-ui adds does **not** reach your script for free — somebody has to add it to
`page` and release it. "frappe-ui got better" and "scripts got better" are unrelated
events, on purpose.

What we bought for that cost is the thing a script author cannot otherwise see: an
option whose _meaning_ a dependency changes cannot silently change what a stored Page
Script does on an upgrade nobody reviewed. If `page` accepted the object and passed it
on, every such change would arrive invisibly, and the author holding the script would
have no way to tell which of their options were safe and which were borrowed.

A key `page` does not forward is **dropped, with a dev-mode warning naming it**. It
does not silently do nothing.

### The same line, outbound

The rule above governs what goes _in_ to `page`. The symmetric one governs what comes
back out:

**Every object `page` hands back is read-only.** A script may not mutate `page`'s
return values into shared state; a write throws, names the member, and points at the
supported verb. `page.doc` is the one exception, and it is one by design — mutating the
document is the API.

This is a rule about `page`, not a list of members, and it binds every member added
after it without anyone re-deriving the argument. The reason it has to be a rule is
that almost nothing `page` returns belongs to your record: `page.roles` is the
session's roles array, shared by the entire application; `page.perms` is a view shared
by every source on the page; `page.meta` is a cached document that outlives navigating
to another record — and to another doctype. A script that sorted `page.roles` in place
was corrupting all three for everyone, permanently, with no error and no way to trace
it.

Only writes are refused. **Reads, `find`, `filter`, `map`, `includes` and spreads all
keep working**, and a script that legitimately wants to reorder or edit copies first:

```js
const sorted = [...page.roles].sort();
const visible = page.meta.fields.filter((field) => !field.hidden);
```

Both allocate something new, and what you do to it afterwards is your business.

## Asking what a host has

`page` carries **no version number**, and will not get one. A version number invites
`if (page.version >= 3)` branches inside stored scripts that nobody will ever prune,
and it implies a contract this document has just declined to make.

Ask with plain JavaScript instead:

```js
if (typeof page.dialog.form === "function") {
  // …
}
```

Feature detection is the supported way, and it is the only tool a Page Script has — it
cannot pin a host version the way a file script or an extension can.

## When something is removed

A removed verb is **tombstoned for one major version**: the name stays, as a function
that throws a message naming the removal and what replaces it, and is deleted a major
later. So a script that breaks tells you _why_ it broke rather than only that it did.

Names that were removed but never tombstoned are caught by a second net: reading one
off `page` warns in the console, by name. Reading a name that never existed stays
quiet — probing with `typeof` is legitimate and must not be punished.

Where you hear about it:

- **Tombstone hit** — console error, an **Error Log** row through the customization
  error reporter, and a toast shown once per script per session to users who can edit
  Page Scripts. A removal that fires on a live site is an upgrade breaking a
  customer's customization; it is not a developer-console matter, and it is not gated
  to dev builds.
- **Unknown-member warning** — console only, always on. Advisory, and too frequent to
  put in the Error Log.

## Forward compatibility is not a goal

A script written against a newer host, run on an older one, is not supported. A
handler key this host has never heard of warns once and never fires; a verb it does
not have simply is not there. Target the host you run on. Extensions and file scripts
are rebuilt against a host, and a Page Script is authored in an editor connected to
the very site it runs on, so there is no path we are closing off here — only one we
are declining to invent.

## What is not promised, in exactly those words

- **No version, no negotiation.** `page` carries no version number and never will. Ask
  with `typeof`, not with a number.
- **Nothing reachable _through_ `page` is stable.** frappe-ui components you pass to
  `add()` or `open()`, and anything you import from the four shared deps, move on
  their own cadence. `page` being unchanged does not mean your script still works.
- **New frappe-ui features do not reach your script for free.** Every `page` verb is
  an allowlist.
- **No forward compatibility.** A script using an event this host has never heard of
  warns once and never fires.
- **A removed verb will break your script.** We tombstone it for one major so the
  error names the removal, and we tell you in the Error Log. We do not keep it
  working.
- **You may not write to what `page` hands you.** Every return value is read-only
  except `page.doc`; a write throws and names the verb to use instead. Copy it if you
  need to change it.
- **No migration tooling for stored scripts.** A Page Script is text in a table.
  Nothing rewrites it for you.
- **None of this is a security boundary.** Error isolation is not sandboxing, and
  anything a script hides is hidden from the eye, not from the server.
