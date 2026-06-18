# Compatibility policy: additive-only contracts, per-app version gating

Third-party apps pin themselves to four contracts: the OS API (applets + scripts call
it), the event surface (scripts attach to it), the Registry schema (server produces, client
consumes), and the patch shapes (customizations are stored against them). To keep year-1
apps working on year-3 internals, the policy is:

1. **OS API and event surface are additive-only**, governed by a published deprecation
   policy: add freely; deprecate with runtime warnings; remove only across a major OS
   version after a long, predictable window. This is the central promise that lets an
   ecosystem trust us not to break it.
2. **Every applet/script declares the minimum OS API version it needs.** If incompatible,
   the OS refuses to load it with a clear message — never a silent crash inside the app's
   bundle.
3. **The Registry schema is versioned and tolerant** — unknown fields ignored, missing
   fields defaulted — so a newer server and an older (cached) client, or vice-versa, degrade
   gracefully instead of erroring.
4. **The OS API exposes capability flags** so scripts can feature-detect the optional surface
   instead of hardcoding version numbers.

Accepted cost: additive-only means carrying deprecated API surface for years (the OS API
accretes baggage that can't be deleted quickly), and the *initial* OS API shape must be
reasonably right because it can't be casually reshaped. That tax is the price of ecosystem
trust, and we choose to pay it.
