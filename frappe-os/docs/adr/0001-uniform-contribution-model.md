# Uniform contribution model — no privileged core

Frappe OS renders every App — including the built-in frappe, crm, and erpnext apps —
through one identical extension mechanism. There is no special fast-path for core apps that
third-party apps lack; the built-ins are simply the first consumers of the public extension
system.

We chose this over the easier "blessed core + weaker plugin API bolted on later" path
because that path reliably produces a second-class extension API (the core never has to use
it, so gaps go unnoticed until a third party hits them). By forcing the framework's own apps
through the public API, the API is proven complete as we build — if CRM's Kanban can't be
expressed as a contribution, we find out immediately, not when a customer does.

The cost we are accepting: the contribution API must be designed *before* even the built-in
apps can render, so the "just hardcode crm for now" shortcut is off the table. The current
hand-curated `src/config/*.ts` is therefore scaffolding to be replaced, not a source of
truth.
