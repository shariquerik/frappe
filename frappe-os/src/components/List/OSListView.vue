<script setup lang="ts">
// frappe-ui ListView wrapper for Frappe OS. Renders the render-ready columns it is given
// (the library's Meta-derived `view.columns.wire`, ADR-0025) and classifies each cell via
// `cellKind`. The four curated kinds (status pill / avatar / primary / plain) stay in the
// tree but are dormant: Meta-derived columns carry raw Frappe fieldtypes, so cells render
// plain/typed until the deferred Display-config enrichment layer returns. Rows come from
// the records store (the host stays the single coherent cache) — ListView is presentation
// only. Selection is live (selectable) and emitted; bulk actions are deferred. Loading/
// error are owned here; ListView owns only the empty state. Row click opens a form window
// via `onOpen` — the OS opens windows, not router routes, so we use options.onRowClick.
import { computed, ref } from 'vue'
import { ListView, ListHeader, ListRows, ListSelectBanner, Avatar } from 'frappe-ui'
import StatusPill from '../StatusPill.vue'
import OSContextMenu from '../OSContextMenu.vue'
import { cellKind } from './list-columns'
// These feed defineProps, so import from concrete modules, not the @/types barrel (its
// `export *` breaks @vue/compiler-sfc's macro resolver — see DoctypeView.vue).
import type { DoctypeMeta } from '@/config/types'
import type { IndicatorSpec } from '@/indicators/types'
import type { ListViewColumn } from './types'
import type { FrappeDoc } from '@/data/types'

const props = withDefaults(defineProps<{
  doctype: string
  columns?: ListViewColumn[] // render-ready columns (view.columns.wire)
  rows?: FrappeDoc[]
  meta?: DoctypeMeta | null
  spec?: IndicatorSpec | null // live Record-indicator spec (ADR-0028) — themes the status cell
  titleField?: string // live meta title_field — its column renders primary
  loading?: boolean
  error?: string | null
  onOpen?: (doctype: string, name: string) => void // left-click: follows the row open-target preference
  onOpenInline?: (doctype: string, name: string) => void // context-menu "Open": always same window
  onOpenNewWindow?: (doctype: string, name: string) => void
}>(), {
  columns: () => [],
  rows: () => [],
})

const emit = defineEmits<{
  'update:selections': [Set<unknown>]
  // A column-header drag-resize, re-emitted up to the host's shared column state (ADR-0006).
  'column-width-updated': [{ key: string; width: string }]
  // Double-click a resizer → clear that column's fixed width so it flexes to fill again.
  'column-width-reset': [{ key: string }]
  // The row scroller's live scrollTop, so the host can persist it as ephemeral Working state
  // (ADR-0029) and reopen the list where the user left it after visiting a record.
  scroll: [number]
}>()

// frappe-ui's ListRows is the sole scroller (its root `.overflow-y-auto`) but exposes no ref or
// scroll event, so the host reaches it through this wrapper: query the scroller under our container,
// re-emit its scrollTop (scroll doesn't bubble — the template uses a CAPTURE listener), and expose
// an imperative restore the host calls once the persisted window has loaded.
const container = ref<HTMLElement | null>(null)
const scroller = (): HTMLElement | null => container.value?.querySelector('.overflow-y-auto') ?? null
function onScroll() { emit('scroll', scroller()?.scrollTop ?? 0) }
function restoreScroll(top: number): void { const el = scroller(); if (el) el.scrollTop = top }
defineExpose({ restoreScroll })

// frappe-ui's `ListHeaderItem` binds drag-resize to the resizer's `mousedown` but exposes
// neither a dblclick nor its `startResizing`, so we delegate the double-click-to-reset
// gesture on the header grid: map the double-clicked resizer to its column by index (the
// selectable checkbox has no resizer, so resizers run 1:1 with `columns`) and ask the host
// to drop that column's width.
function onResizerDoubleClick(event: MouseEvent) {
  const resizer = (event.target as HTMLElement).closest('.cursor-col-resize')
  const header = resizer?.closest('.grid')
  if (!resizer || !header) return
  const index = Array.from(header.querySelectorAll('.cursor-col-resize')).indexOf(resizer)
  const column = props.columns[index]
  if (column) emit('column-width-reset', { key: column.key })
}

// The per-record cell context (ADR-0028): the status field the pill resolves against, the
// title field that renders primary, and the spec `indicatorFor` reads. Derived live, not curated.
const cellContext = computed(() => ({
  statusField: props.spec?.statusField,
  titleField: props.titleField,
  spec: props.spec,
}))

// Right-click a row → a small menu offering the two built-in opens (ADR-0017): Open (same
// window) and Open in New Window (a fresh app instance). Both are explicit and ALWAYS offered
// regardless of the left-click open-target preference (ADR-0018) — the context menu is the
// per-row escape hatch. Direct core row behaviour, deliberately NOT routed through the Command/
// Action model — Context has no selection and Handlers can't carry the clicked row (see ADR-0017).
const rowMenu = ref<{ x: number; y: number; name: string } | null>(null)

// Resolve the record under a right-click anywhere in the list — cell text, an empty "—"
// cell, or the gaps/padding between cells — without coupling to ListView's internal markup.
// Every cell carries `data-row-name`; climb from the event target to the first ancestor whose
// cells all share ONE name (that element IS a single row's grid). The multi-row scroll
// container holds many names, so a click below the rows resolves to nothing.
function rowNameFromEvent(e: MouseEvent): string | null {
  let el = e.target as HTMLElement | null
  const stop = e.currentTarget as HTMLElement
  while (el && el !== stop) {
    if (el.dataset?.rowName) return el.dataset.rowName
    const cells = el.querySelectorAll<HTMLElement>('[data-row-name]')
    if (cells.length) {
      const names = new Set([...cells].map((c) => c.dataset.rowName))
      if (names.size === 1) return [...names][0]!
    }
    el = el.parentElement
  }
  return null
}
function onRowContextMenu(e: MouseEvent) {
  const name = rowNameFromEvent(e)
  if (name) rowMenu.value = { x: e.clientX, y: e.clientY, name }
}
const rowMenuItems = computed(() => {
  const name = rowMenu.value?.name
  if (!name) return []
  return [
    { label: 'Open', onClick: () => (props.onOpenInline || props.onOpen)?.(props.doctype, name) },
    { label: 'Open in New Window', onClick: () => props.onOpenNewWindow?.(props.doctype, name) },
  ]
})

const options = computed(() => ({
  selectable: true,
  showTooltip: true,
  resizeColumn: true,
  onRowClick: (row: FrappeDoc) => props.onOpen?.(props.doctype, row.name),
  emptyState: {
    title: 'No records',
    description: `No ${props.meta?.label || props.doctype} records yet.`,
  },
}))
</script>

<template>
  <!-- Bounded flex column so only the rows scroll (CRM-parity, matches ListViewShell): the
       table region takes the remaining height and clips, and the list's own `ListRows`
       (`overflow-y-auto`) is the sole scroller — the `ListHeader` above it stays fixed. -->
  <div ref="container" class="flex min-h-0 flex-1 flex-col overflow-hidden px-3 py-1"
       @contextmenu.prevent="onRowContextMenu" @scroll.capture.passive="onScroll">
    <div v-if="error" class="px-[14px] py-[34px] text-center text-[13px] text-ink-red-6">{{ error }}</div>
    <div v-else-if="!rows.length && loading" class="px-[14px] py-[34px] text-center text-[13px] text-ink-gray-4">Loading…</div>
    <ListView
      v-else
      :columns="columns"
      :rows="rows"
      row-key="name"
      :options="options"
      class="min-h-0"
      @update:selections="emit('update:selections', $event)"
    >
      <!-- Explicit composition: frappe-ui's `ListView` does NOT re-emit `columnWidthUpdated`,
           so we place `ListHeader` to catch the header drag-resize ourselves and re-emit it
           up to the host's shared column state (ADR-0006). `ListRows` keeps the default row
           rendering, which still consumes the `#cell` slot below via `ListView`'s provide. -->
      <ListHeader
        @column-width-updated="emit('column-width-updated', $event)"
        @dblclick="onResizerDoubleClick"
      />
      <ListRows />
      <!-- Overriding the default slot drops frappe-ui's built-in selection banner, so we
             re-add it here; it reads the shared `list` provide and shows on selection. -->
      <ListSelectBanner />
      <!-- `data-row-name` on every cell lets the container-level contextmenu resolve the
           clicked record from anywhere in the row (see rowNameFromEvent). -->
      <template #cell="{ column, item, row }">
        <span :data-row-name="row.name" class="contents">
          <template v-for="cell in [cellKind(row, column, cellContext)]" :key="column.key">
            <StatusPill v-if="cell.kind === 'status'" :value="cell.display" :theme="cell.theme" />
            <span v-else-if="cell.kind === 'primary'" class="text-base font-medium text-ink-gray-8">{{ cell.display }}</span>
            <span v-else-if="cell.kind === 'avatar'" class="inline-flex items-center gap-1.5 text-base text-ink-gray-7">
              <Avatar :label="cell.label" size="sm" />{{ cell.label }}
            </span>
            <span v-else class="text-base text-ink-gray-7">{{ cell.display }}</span>
          </template>
        </span>
      </template>
    </ListView>
    <OSContextMenu v-if="rowMenu" :x="rowMenu.x" :y="rowMenu.y" :items="rowMenuItems" @close="rowMenu = null" />
  </div>
</template>
