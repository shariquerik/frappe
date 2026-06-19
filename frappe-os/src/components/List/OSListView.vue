<script setup lang="ts">
// frappe-ui ListView wrapper for Frappe OS. Maps the curated ListColumn config to
// ListView's column/cell shape (./list-columns) and reproduces the four curated
// cell kinds (status pill / avatar / primary / plain). Rows come from the records store
// (the host stays the single coherent cache) — ListView is presentation only. Selection
// is live (selectable) and emitted; bulk actions are deferred. Loading/error are owned
// here; ListView owns only the empty state. Row click opens a form window via `onOpen` —
// the OS opens windows, not router routes, so we use options.onRowClick (not getRowRoute).
import { computed } from 'vue'
import { ListView, Avatar } from 'frappe-ui'
import StatusPill from '../StatusPill.vue'
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
}>(), {
  columns: () => [],
  rows: () => [],
})

const emit = defineEmits<{ 'update:selections': [Set<unknown>] }>()

const listColumns = computed(() => toListViewColumns(props.columns))
const statusThemes = computed(() => props.meta?.statusThemes || {})

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
  <div class="min-h-0 flex-1 overflow-auto">
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
      <template #cell="{ column, item }">
        <template v-for="cell in [cellKind(item, column, statusThemes)]" :key="column.key">
          <StatusPill v-if="cell.kind === 'status'" :value="cell.display" :theme="cell.theme" />
          <span v-else-if="cell.kind === 'primary'" class="font-medium text-ink-gray-8">{{ cell.display }}</span>
          <span v-else-if="cell.kind === 'avatar'" class="inline-flex items-center gap-1.5">
            <Avatar :label="cell.label" size="sm" />{{ cell.label }}
          </span>
          <template v-else>{{ cell.display }}</template>
        </template>
      </template>
    </ListView>
  </div>
</template>
