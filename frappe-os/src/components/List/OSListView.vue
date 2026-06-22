<script setup lang="ts">
// frappe-ui ListView wrapper for Frappe OS. Maps the curated ListColumn config to
// ListView's column/cell shape (./list-columns) and reproduces the four curated
// cell kinds (status pill / avatar / primary / plain). Rows come from the records store
// (the host stays the single coherent cache) — ListView is presentation only. Selection
// is live (selectable) and emitted; bulk actions are deferred. Loading/error are owned
// here; ListView owns only the empty state. Row click opens a form window via `onOpen` —
// the OS opens windows, not router routes, so we use options.onRowClick (not getRowRoute).
import { computed, ref } from 'vue'
import { ListView, Avatar } from 'frappe-ui'
import StatusPill from '../StatusPill.vue'
import OSContextMenu from '../OSContextMenu.vue'
import { toListViewColumns, cellKind } from './list-columns'
// These feed defineProps, so import from concrete modules, not the @/types barrel (its
// `export *` breaks @vue/compiler-sfc's macro resolver — see DoctypeView.vue).
import type { DoctypeMeta, ListColumn } from '@/config/types'
import type { FrappeDoc } from '@/data/types'

const props = withDefaults(defineProps<{
  doctype: string
  columns?: ListColumn[] // curated meta.listColumns
  rows?: FrappeDoc[]
  meta?: DoctypeMeta | null
  loading?: boolean
  error?: string | null
  onOpen?: (doctype: string, name: string) => void
  onOpenNewWindow?: (doctype: string, name: string) => void
}>(), {
  columns: () => [],
  rows: () => [],
})

const emit = defineEmits<{ 'update:selections': [Set<unknown>] }>()

const listColumns = computed(() => toListViewColumns(props.columns))
const statusThemes = computed(() => props.meta?.statusThemes || {})

// Right-click a row → a small menu offering the two built-in opens (ADR-0017): Open (same
// window, identical to the left-click) and Open in New Window (a fresh app instance). Direct
// core row behaviour, deliberately NOT routed through the Command/Action model — Context has
// no selection and Handlers can't carry the clicked row (see ADR-0017).
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
    { label: 'Open', onClick: () => props.onOpen?.(props.doctype, name) },
    { label: 'Open in New Window', onClick: () => props.onOpenNewWindow?.(props.doctype, name) },
  ]
})

const options = computed(() => ({
  selectable: true,
  showTooltip: true,
  onRowClick: (row: FrappeDoc) => props.onOpen?.(props.doctype, row.name),
  emptyState: {
    title: 'No records',
    description: `No ${props.meta?.label || props.doctype} records yet.`,
  },
}))
</script>

<template>
  <div class="min-h-0 flex-1 overflow-auto px-3 py-1" @contextmenu.prevent="onRowContextMenu">
    <div v-if="error" class="px-[14px] py-[34px] text-center text-[13px] text-ink-red-6">{{ error }}</div>
    <div v-else-if="!rows.length && loading" class="px-[14px] py-[34px] text-center text-[13px] text-ink-gray-4">Loading…</div>
    <ListView
      v-else
      :columns="listColumns"
      :rows="rows"
      row-key="name"
      :options="options"
      @update:selections="emit('update:selections', $event)"
    >
      <!-- `data-row-name` on every cell lets the container-level contextmenu resolve the
           clicked record from anywhere in the row (see rowNameFromEvent). -->
      <template #cell="{ column, item, row }">
        <span :data-row-name="row.name" class="contents">
          <template v-for="cell in [cellKind(item, column, statusThemes)]" :key="column.key">
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
