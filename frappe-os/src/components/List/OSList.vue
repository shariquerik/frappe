<script setup lang="ts">
// The list view: a self-fetching collection screen, wired to the live records store. Owns
// the list chrome (toolbar with count/presence/New, saved-view chips, footer) and composes
// the table over OSListView. Display config (label/icon/columns/saved views) comes from the
// curated `meta` prop; the rows, count and create-permission are live. Symmetric with
// Form/OSForm — both are full view components DoctypeView resolves and renders.
import { computed, inject, shallowRef, watch } from 'vue'
import { Button } from 'frappe-ui'
import OSListView from './OSListView.vue'
import { useOS } from '@/desktop'
import { TOOLBAR_SLOT } from '@/components/Window/toolbar'
// defineProps type from the concrete module (barrel's `export *` breaks the SFC macro
// resolver — see DoctypeView.vue).
import type { ViewProps } from '@/config/types'

const props = withDefaults(defineProps<ViewProps>(), {
  presence: () => [],
})

const os = useOS()
const doctype = computed(() => props.doctype)

// The "New" button needs create permission, which rides on the live field schema.
const fieldMeta = computed(() => os.fieldMetaFor(doctype.value))
watch(doctype, (dt) => { if (dt) os.loadFieldMeta(dt) }, { immediate: true })
const canCreate = computed(() => !!fieldMeta.value.data?.can_create)

// Live rows + count.
const listState = computed(() => os.listFor(doctype.value))
const records = computed(() => listState.value.data || [])
const countState = computed(() => os.countFor(doctype.value))
const total = computed(() => (countState.value.data == null ? records.value.length : countState.value.data))

watch(doctype, (dt) => { if (dt) { os.loadList(dt); os.loadCount(dt) } }, { immediate: true })

const savedViews = computed(() => props.meta?.savedViews || [{ label: 'All' }])

// The window chrome's action zone: "New" teleports up next to the breadcrumb, so the list's
// title/count/presence no longer need a toolbar bar of their own (count rides the breadcrumb,
// presence rides the chrome). Filter/Sort drop down into the saved-view row below.
const toolbarSlot = inject(TOOLBAR_SLOT, shallowRef<HTMLElement | null>(null))
</script>

<template>
  <div class="flex h-full flex-col">
    <!-- "New" rides the window chrome's action zone (next to the breadcrumb); inline fallback
         only for a chromeless window. -->
    <Teleport :to="toolbarSlot" :disabled="!toolbarSlot">
      <Button v-if="canCreate" variant="solid" size="sm" label="New" @click="onNew?.(doctype)">
        <template #prefix><span class="lucide-plus size-[14px]"></span></template>
      </Button>
    </Teleport>
    <!-- saved view chips + filter/sort -->
    <div class="flex flex-shrink-0 items-center gap-1.5 border-b border-outline-gray-1 bg-surface-gray-1 px-[14px] py-[7px]">
      <span class="lucide-bookmark size-[13px] text-ink-gray-4 mr-0.5"></span>
      <button v-for="(v, i) in savedViews" :key="i"
        class="inline-flex h-[26px] cursor-pointer items-center rounded-[7px] px-[11px] text-[12px]" :style="{
          border: i===0 ? '1px solid var(--outline-gray-2)' : '1px solid transparent',
          background: i===0 ? 'var(--surface-base)' : 'transparent',
          color: i===0 ? 'var(--ink-gray-8)' : 'var(--ink-gray-5)',
          fontWeight: i===0 ? 500 : 400, boxShadow: i===0 ? 'var(--shadow-sm)' : 'none' }">
        {{ v.label }}<span v-if="v.count != null" class="ml-[5px] opacity-60">{{ v.count }}</span>
      </button>
      <div class="flex-1"></div>
      <Button variant="subtle" size="sm" label="Filter">
        <template #prefix><span class="lucide-filter size-[13px]"></span></template>
      </Button>
      <Button variant="subtle" size="sm" label="Sort" />
    </div>
    <!-- table -->
    <OSListView
      :doctype="doctype"
      :columns="meta?.listColumns || []"
      :rows="records"
      :meta="meta"
      :loading="listState.loading"
      :error="listState.error"
      :on-open="onOpen"
      :on-open-inline="onOpenInline"
      :on-open-new-window="onOpenNewWindow"
    />
    <!-- footer -->
    <div class="flex flex-shrink-0 items-center gap-3 border-t border-outline-gray-1 bg-surface-gray-1 px-[14px] py-[7px] text-[12px] text-ink-gray-5">
      <span>{{ records.length }} of {{ total }}</span>
      <div class="flex-1"></div>
      <span class="text-ink-gray-4">Rows per page: 100</span>
    </div>
  </div>
</template>
