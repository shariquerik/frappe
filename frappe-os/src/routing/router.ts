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
  // Single catch-all. `:app` is redundant for list/form (derivable from doctype)
  // but kept so the URL is self-describing and dashboards have a path.
  routes: [{ path: '/:app?/:doctype?/:name?', component: Empty }],
})
