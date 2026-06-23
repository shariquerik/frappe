<script setup lang="ts">
// Editable, meta-driven record form wired to the live records store. Fetches the real field
// schema (loadFieldMeta, for permissions) and the live doc (loadDoc), renders the tabs →
// sections → columns FormLayout that useDoctypeLayout builds from the full doctype meta,
// and writes through Save (saveDoc) / Create (createDoc).
// Display config (label, title/status fields, themes) comes from the curated `meta` prop;
// the record and field schema are live. DoctypeView resolves this as the 'form' view.
import { ref, computed, inject, shallowRef, watch } from 'vue'
import { Button, Avatar, Dropdown } from 'frappe-ui'
import { FormLayout, useDoctypeLayout } from '@framework/ui/FormLayout'
import StatusPill from '@/components/StatusPill.vue'
import { useOS } from '@/desktop'
import { TOOLBAR_SLOT } from '@/components/Window/toolbar'
// defineProps type comes from the concrete module (the @/types barrel's `export *` breaks
// @vue/compiler-sfc's macro type resolver — see DoctypeView.vue).
import type { ViewProps } from '@/config/types'

const props = withDefaults(defineProps<ViewProps>(), {
  presence: () => [],
})

const os = useOS()
const doctype = computed(() => props.doctype)
const isNew = computed(() => !props.recordName || props.recordName === 'new')

// ---------- live field schema + permissions ----------
const fieldMeta = computed(() => (doctype.value ? os.fieldMetaFor(doctype.value) : { loading: false, data: null, error: null }))
watch(doctype, (dt) => { if (dt) os.loadFieldMeta(dt) }, { immediate: true })
const canCreate = computed(() => !!fieldMeta.value.data?.can_create)
const canWrite = computed(() => !!fieldMeta.value.data?.can_write)

// ---------- live doc ----------
const docState = computed(() =>
  doctype.value && props.recordName && !isNew.value
    ? os.docFor(doctype.value, props.recordName)
    : { loading: false, data: null, error: null },
)
watch([doctype, () => props.recordName, isNew], () => {
  if (!isNew.value && doctype.value && props.recordName) os.loadDoc(doctype.value, props.recordName)
}, { immediate: true })
const record = computed<Record<string, any> | null>(() => (isNew.value ? {} : docState.value.data))

// Editable working copy, reset whenever the loaded record (or new/edit mode) changes.
const formDoc = ref<Record<string, any>>({})
watch([record, isNew], () => { formDoc.value = isNew.value ? {} : { ...(record.value || {}) } }, { immediate: true })

const editable = computed(() => (isNew.value ? canCreate.value : canWrite.value))

// Full tabs → sections → columns layout, built from the real doctype meta (Tab Breaks become
// tabs, Section/Column Breaks the grid). Memoised per doctype by @framework/ui.
const doctypeLayout = computed(() => useDoctypeLayout(doctype.value))
const layout = computed(() => doctypeLayout.value.layout.value)
const layoutLoading = computed(() => doctypeLayout.value.loading.value)
const layoutError = computed(() => doctypeLayout.value.error.value)

// FormLayout only pads itself (full-width section borders, inset column grid) when it
// shows a tab strip; a tab-less form gets no padding and the grid hugs the edge. Rather
// than re-create that spacing, render every form as tabbed and hide the strip when there's
// only one tab: label the lone tab (on a clone, so the cached layout isn't mutated) so
// FormLayout's `hasTabs` flips true, then CSS hides the single-item tablist.
const singleTab = computed(() => (layout.value ?? []).filter((tab: any) => !tab.hidden).length <= 1)
const displayLayout = computed(() => {
  const tabs = layout.value ?? []
  if (!singleTab.value) return tabs
  return tabs.map((tab: any) => ({ ...tab, label: tab.label || 'Details' }))
})

// Drop the card outline FormLayout draws around tabbed forms (`!border-0 !rounded-none`
// beat its `border`/`rounded-lg`) — Frappe OS forms sit flush in the window. For a single
// tab the strip is meaningless, so hide the tablist with the same arbitrary variant
// FormLayout uses internally; the tab panel (and its padded, full-width grid) still renders.
const formLayoutClass = computed(() => [
  '!border-0 !rounded-none',
  singleTab.value ? "[&_[role='tablist']]:hidden" : '',
])

const formTitle = computed(() => {
  if (isNew.value) return 'New ' + (props.meta?.label || doctype.value)
  return record.value?.[props.meta?.titleField || ''] || record.value?.name || props.recordName || ''
})
const statusValue = computed(() => record.value?.[props.meta?.statusField || ''])
const statusTheme = computed(() => (props.meta?.statusThemes || {})[statusValue.value] || 'gray')

// ---------- dirty tracking + save / create ----------
function changed(a: unknown, b: unknown) {
  if (a === b) return false
  return JSON.stringify(a) !== JSON.stringify(b)
}
const dirtyFields = computed(() => {
  if (isNew.value) return Object.keys(formDoc.value).filter((k) => formDoc.value[k] != null && formDoc.value[k] !== '')
  const orig: Record<string, any> = record.value || {}
  return Object.keys(formDoc.value).filter((k) => changed(formDoc.value[k], orig[k]))
})
const isDirty = computed(() => dirtyFields.value.length > 0)
const canSave = computed(() => editable.value && (isNew.value || isDirty.value))

const saving = ref(false)
const saveError = ref('')
async function save() {
  if (saving.value || !canSave.value) return
  saving.value = true
  saveError.value = ''
  try {
    if (isNew.value) {
      const created = await os.createDoc(doctype.value!, formDoc.value)
      if (created?.name) props.onCreated?.(doctype.value!, created.name)
    } else {
      const changes: Record<string, unknown> = {}
      dirtyFields.value.forEach((k) => { changes[k] = formDoc.value[k] })
      await os.saveDoc(doctype.value!, props.recordName!, changes)
    }
  } catch (e) {
    saveError.value = (e as Error).message
  } finally {
    saving.value = false
  }
}

const saveLabel = computed(() => (saving.value ? 'Saving…' : isNew.value ? 'Create' : 'Save'))

// The chrome bar's action zone: when present (app window with a breadcrumb), Save + the record
// menu teleport up into it and the form's own breadcrumb/presence are dropped as duplicates.
// Null for a popped-out record window — the form then keeps its full inline header.
const toolbarSlot = inject(TOOLBAR_SLOT, shallowRef<HTMLElement | null>(null))

const formMenu = computed(() => [
  { label: 'Duplicate', onClick: () => {} },
  { label: 'Print', onClick: () => {} },
  { label: 'Delete', onClick: () => {} },
])
</script>

<template>
  <div class="flex h-full flex-col">
    <!-- merged: breadcrumb, title, status pill and actions all ride the chrome bar, so the form
         has no header strip of its own — only the actions teleport up. -->
    <Teleport v-if="toolbarSlot" :to="toolbarSlot">
      <Dropdown v-if="!isNew" :options="formMenu">
        <Button variant="subtle" size="sm">
          <span class="lucide-ellipsis size-[15px]"></span>
        </Button>
      </Dropdown>
      <Button v-if="editable" variant="solid" size="sm" :label="saveLabel" :loading="saving" :disabled="!canSave" @click="save" />
    </Teleport>
    <!-- chromeless (popped-out record window): full inline header -->
    <div v-else class="flex flex-shrink-0 items-center gap-2.5 border-b border-outline-gray-1 px-4 py-[11px]">
      <div class="flex min-w-0 flex-col gap-0.5">
        <div class="flex items-center gap-1.5 text-[11px] text-ink-gray-4">
          <span>{{ meta?.label }}</span>
          <span class="lucide-chevron-right size-[11px]"></span>
          <span class="text-ink-gray-6">{{ isNew ? 'New' : record?.name }}</span>
        </div>
        <div class="flex items-center gap-2.5">
          <span class="text-md font-semibold text-ink-gray-9">{{ formTitle }}</span>
          <StatusPill v-if="!isNew && statusValue != null" :value="statusValue" :theme="statusTheme" />
        </div>
      </div>
      <div class="flex-1"></div>
      <div class="mr-1 flex items-center">
        <Avatar v-for="(p, i) in presence" :key="i" :label="p.label" size="md"
          :style="{ marginLeft: i ? '-7px' : '0', boxShadow: '0 0 0 2px var(--surface-base)' }" :title="p.label + ' is editing'" />
      </div>
      <Dropdown v-if="!isNew" :options="formMenu">
        <Button variant="subtle" size="sm">
          <span class="lucide-ellipsis size-[15px]"></span>
        </Button>
      </Dropdown>
      <Button v-if="editable" variant="solid" size="sm" :label="saveLabel" :loading="saving" :disabled="!canSave" @click="save" />
    </div>
    <!-- save error -->
    <div v-if="saveError" class="flex-shrink-0 border-b border-outline-red-2 bg-surface-red-1 px-4 py-2 text-[12px] text-ink-red-6">{{ saveError }}</div>
    <!-- body: FormLayout field grid -->
    <div class="min-h-0 flex-1 overflow-auto">
      <div v-if="fieldMeta.error || layoutError" class="px-5 py-5 text-[13px] text-ink-red-6">{{ fieldMeta.error || String(layoutError) }}</div>
      <div v-else-if="!isNew && docState.error" class="px-5 py-5 text-[13px] text-ink-red-6">{{ docState.error }}</div>
      <div v-else-if="fieldMeta.loading || layoutLoading || (!isNew && docState.loading)" class="px-5 py-5 text-[13px] text-ink-gray-4">Loading…</div>
      <FormLayout v-else v-model:doc="formDoc" :layout="displayLayout" :class="formLayoutClass" />
    </div>
  </div>
</template>
