# Extension-point types are a closed-but-data-driven set; app-defined points deferred

The set of extension-point *types* (the kinds of slots apps can fill) is defined by the OS,
not by apps. Apps fill OS-defined slots; they cannot (yet) invent new slot *types* that
other apps plug into. App-defined extension points are explicitly deferred — they add real
complexity (discovery, ordering, conflict resolution) that nothing in the near term needs.

Crucially, the set is **data-driven, not hardcoded**: the registry/collection machinery
treats "slot type" as just a key, so adding a new OS-defined slot type later is an additive
change, not a refactor. This keeps the door open to app-defined extension points without
paying for them now.

Initial OS-defined extension-point types (grouped; implement by leverage, not completeness):

- **App-level:** App (icon/name/color/order), Workspace/Dashboard (app landing surface).
- **Doctype-level:** Doctype view (list, form, report, kanban, calendar, gantt, tree, …),
  Display config (label/color/icon/columns/status/filters/sort), Form scripting
  (buttons/actions/validation), List & bulk actions.
- **OS-chrome:** Menu-bar item, Dock item, Command-palette command, Notification source,
  Global search provider, Settings pane, Desktop widget.
- **Cross-cutting:** Background service, Keyboard shortcut, File-type handler.

First five to actually implement (gives a usable OS where any app's doctypes appear and
navigate): **App, Doctype view (list+form), Display config, Dashboard, Command-palette
command.** Everything else is an additive contribution type into the same registry.
