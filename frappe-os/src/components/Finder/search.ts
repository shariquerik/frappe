// The Finder's search query (the chrome search box) — a module singleton, mirroring selection.ts.
// The Finder is a singleton system window, so one query is the whole story. FinderToolbar (in the
// title bar) writes it; FinderBody reads it to narrow each pane's tiles by label. The box's clear
// button, an Escape in the input, or a Location change all empty it.
import { reactive } from 'vue'

const state = reactive<{ query: string }>({ query: '' })

// The current search text, or '' when the box is empty. Read by the body's filter and the toolbar input.
export function finderQuery(): string {
  return state.query
}

// Set the search text (the toolbar input's v-model) — narrows the body's tiles live.
export function setFinderQuery(query: string): void {
  state.query = query
}

// Empty the search box — the clear button, an Escape in the input, or a Location change. Idempotent.
export function clearFinderQuery(): void {
  state.query = ''
}
