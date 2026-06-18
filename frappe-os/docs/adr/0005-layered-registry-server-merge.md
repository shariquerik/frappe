# Customization is layered contributions, merged on the server

There is no separate "customization" subsystem. Customization is just higher-precedence
contributions to the same Registry. Declarative contributions come from three layered
sources, resolved with strict precedence:

```
App-default      (files shipped with the app: hooks.py / JSON)   — versioned, deployed
   ↓ overridden by
Site customization (DB records: admin edits, scripts, property-setter-style patches)
   ↓ overridden by
User preference   (DB records scoped to a user: personal columns/sort/view choices)
   = effective Registry
```

- A **custom app** extends the OS by shipping files → App-default layer.
- A **site customization** is a DB record that patches an existing contribution (e.g. add a
  column to ERPNext's Sales Invoice list) without forking the app → wins over App-default.
- A **personal tweak** is a DB record scoped to the user → wins over both.

This deliberately mirrors Frappe's existing model (doctype JSON overridden by Property
Setter; Client Scripts layered on top), so we reuse existing infrastructure and mental
models rather than inventing a parallel one.

**The merge happens on the server.** The frontend receives one already-resolved effective
Registry and never knows layers exist — keeping every client-side read simple. Shipping all
layers to merge in the browser was rejected as the default; live "preview my change before
saving" will be handled as a deliberate, bounded exception later, not by pushing merge
logic into the client.
