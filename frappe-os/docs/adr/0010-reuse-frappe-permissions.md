# No parallel OS auth: reuse Frappe permissions, per-user Registry

Frappe OS introduces no permission system of its own. It reuses Frappe's existing model
(roles, doctype/field/document-level permissions, user permissions) end to end.

1. **The Registry is permission-filtered per user, server-side** — after merging
   (ADR-0005), the server also strips contributions whose target (app / doctype / view /
   action) the user cannot read. The client receives a Registry that already is "what you
   may see." Client-side hiding is UX only.
2. **OS-specific visibility** ("only Sales Managers see this widget/menu item") is expressed
   as ordinary Frappe role/permission conditions carried on the contribution and evaluated
   server-side — not a new visibility subsystem.
3. **The enforcement boundary is always the server.** The OS API is a thin client; every
   data read and action it performs is permission-checked server-side, exactly as Frappe's
   REST/RPC already are. A hostile applet calling the OS API hits the same checks. A
   hidden button is never the security boundary.

Accepted consequence: a per-user-filtered Registry is **not a single globally-cacheable
blob** — it is per-user / per-role, so caching keys on the role-set rather than caching once
globally. We accept that cost rather than leak contributions a user can't use (a security
and UX problem).
