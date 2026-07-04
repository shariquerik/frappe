// The OS router is a URL *side-channel*, not the renderer. <router-view> renders
// nothing; the desktop draws its windows from the store. The router only mirrors
// the focused window into the URL (replaceState-only) and turns cold deep-links /
// browser back into store actions. See main.js for the store <-> router bridge.
import { createRouter, createWebHistory } from 'vue-router'
import type { Component } from 'vue'

// Empty component: the route exists purely to parse/own the URL path segments.
const Empty: Component = { render: () => null }

export const router = createRouter({
  // createWebHistory normalizes the base by stripping any trailing slash, so the
  // bare-desktop route ('/') always yields the URL `/os` (no slash). Vite's dev
  // server expects the `/os/` base, so a hard reload of `/os` is redirected back to
  // `/os/` by the `os-base-slash-redirect` middleware in vite.config.js.
  history: createWebHistory('/os'),
  // Single catch-all capturing the raw path segments as an array (`:segments*`, zero-or-more).
  // The positional scheme is /<app>/<workspace?>/<doctype?>/<name?>/<aspect?>: the optional
  // workspace segment between app and doctype (ADR-0040) makes the shape variable-length, so
  // route-map's `parseSegments` reshapes the array — resolving workspace-vs-doctype by lookup —
  // rather than the router binding fixed positions (which can't express the optional middle slot).
  routes: [{ path: '/:segments*', component: Empty }],
})
