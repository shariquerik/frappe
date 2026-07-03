// Frappe OS service worker.
//
// This is deliberately minimal: its only job is to make the /os/ shell installable
// as a desktop PWA. Chrome will not offer "Install" without a registered service
// worker that has a fetch handler, so we register one that does nothing but pass
// every request straight through to the network. There is no offline cache yet —
// the shell always talks to the live Frappe backend (ADR: installable-only PWA).
//
// Served at /os/sw.js (see website_route_rules in hooks.py) so its scope covers the
// whole /os/ app; a service worker can only control URLs at or below its own path.

self.addEventListener("install", () => {
	// Take over as the active worker as soon as this version installs, so an updated
	// shell does not wait for every /os/ tab to close first.
	self.skipWaiting();
});

self.addEventListener("activate", (event) => {
	// Start controlling already-open /os/ clients immediately after activation.
	event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", () => {
	// Pass-through: no interception, no cache. Present only to satisfy the
	// installability requirement. Offline caching is a deliberate future step.
});
