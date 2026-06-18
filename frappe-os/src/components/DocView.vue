<script setup lang="ts">
// Meta-driven list + form, wired to the live records store. The list renders rows
// from listFor(doctype); the form fetches the real field schema (getDoctypeMeta) and
// the live doc, builds a sectioned, EDITABLE @framework/ui FormLayout, and writes via
// Save (saveDoc) / Create (createDoc). Display config (columns, title/status fields,
// icon, themes) still comes from the curated `meta` prop; records and field schemas
// are live.
import { ref, computed, watch } from 'vue'
import { Button, Avatar, Dropdown } from 'frappe-ui'
import { FormLayout } from '@framework/ui/FormLayout'
import StatusPill from './StatusPill.vue'
import { useOS } from '@/store'
import type { DocViewDoc, DoctypeMeta, FrappeDoc, ListColumn } from '@/types'

const props = withDefaults(defineProps<{
  doc?: DocViewDoc // { kind:'list'|'form', doctype, recordName }
  meta?: DoctypeMeta | null // curated display config (getMeta)
  presence?: { label: string }[]
  onOpen?: (doctype: string, name: string) => void // open a record
  onNew?: (doctype: string) => void // start a blank form
  onCreated?: (doctype: string, name: string) => void // after create
}>(), {
  presence: () => [],
})

const os = useOS()
const doctype = computed(() => props.doc?.doctype)
const isList = computed(() => props.doc?.kind === 'list')
const isForm = computed(() => props.doc?.kind === 'form')
const isNew = computed(() => isForm.value && (!props.doc?.recordName || props.doc.recordName === 'new'))

// ---------- live field schema + permissions ----------
const fieldMeta = computed(() => (doctype.value ? os.fieldMetaFor(doctype.value) : { loading: false, data: null, error: null }))
watch(doctype, (dt) => { if (dt) os.loadFieldMeta(dt) }, { immediate: true })
const canCreate = computed(() => !!fieldMeta.value.data?.can_create)
const canWrite = computed(() => !!fieldMeta.value.data?.can_write)

// ---------- LIST ----------
const listState = computed(() => (doctype.value ? os.listFor(doctype.value) : { loading: false, data: [], error: null }))
const records = computed(() => listState.value.data || [])
const countState = computed(() => (doctype.value ? os.countFor(doctype.value) : { data: null }))
const total = computed(() => (countState.value.data == null ? records.value.length : countState.value.data))

watch([doctype, isList], () => {
  if (isList.value && doctype.value) { os.loadList(doctype.value); os.loadCount(doctype.value) }
}, { immediate: true })

type Column = ListColumn & { align: string }
const columns = computed<Column[]>(() =>
  (props.meta?.listColumns || []).map((c) => ({
    ...c,
    align: c.type === 'currency' || c.type === 'int' ? 'justify-content:flex-end;text-align:right;' : '',
  })),
)
const gridCols = computed(() => '30px ' + columns.value.map((c) => c.width || 'minmax(120px,1fr)').join(' '))
const savedViews = computed(() => props.meta?.savedViews || [{ label: 'All' }])

interface Cell { align: string; display: string; kind: string; theme?: string; label?: string }
function cellFor(r: FrappeDoc, c: Column): Cell {
  const raw = r[c.key]
  const cell: Cell = { align: c.align, display: raw == null || raw === '' ? '—' : String(raw), kind: 'plain' }
  if (c.type === 'status' && raw != null) { cell.kind = 'status'; cell.theme = (props.meta?.statusThemes || {})[raw] || 'gray' }
  else if (c.type === 'avatar') { cell.kind = 'avatar'; cell.label = raw == null ? '' : String(raw) }
  else if (c.primary) cell.kind = 'primary'
  return cell
}

// ---------- FORM (live doc + editable FormLayout) ----------
const docState = computed(() =>
  doctype.value && props.doc?.recordName && !isNew.value
    ? os.docFor(doctype.value, props.doc.recordName)
    : { loading: false, data: null, error: null },
)
watch([doctype, () => props.doc?.recordName, isForm, isNew], () => {
  if (isForm.value && !isNew.value && doctype.value && props.doc?.recordName) os.loadDoc(doctype.value, props.doc.recordName)
}, { immediate: true })
const record = computed<Record<string, any> | null>(() => (isNew.value ? {} : docState.value.data))

// Editable working copy, reset whenever the loaded record (or new/edit mode) changes.
const formDoc = ref<Record<string, any>>({})
watch([record, isNew], () => { formDoc.value = isNew.value ? {} : { ...(record.value || {}) } }, { immediate: true })

const editable = computed(() => (isNew.value ? canCreate.value : canWrite.value))

// Build a single-tab, section-grouped, two-column layout from the live field schema.
interface LayoutField { fieldname: string; fieldtype: string; label: string; reqd: boolean; options: string | undefined; readOnly: boolean }
const layout = computed(() => {
  const fields = fieldMeta.value.data?.fields || []
  const secMap: { label: string; fields: LayoutField[] }[] = []
  fields.forEach((f: any) => {
    const title = f.section || 'Details'
    let s = secMap.find((x) => x.label === title)
    if (!s) { s = { label: title, fields: [] }; secMap.push(s) }
    s.fields.push({
      fieldname: f.fieldname,
      fieldtype: f.fieldtype,
      label: f.label,
      reqd: !!f.reqd,
      options: f.options || undefined,
      readOnly: !editable.value || !!f.read_only,
    })
  })
  const sections = secMap.map((s) => {
    const col0: LayoutField[] = [], col1: LayoutField[] = []
    s.fields.forEach((f, i) => (i % 2 ? col1 : col0).push(f))
    return { label: s.label, columns: [{ fields: col0 }, { fields: col1 }] }
  })
  return [{ sections }]
})

const formTitle = computed(() => {
  if (isNew.value) return 'New ' + (props.meta?.label || doctype.value)
  return record.value?.[props.meta?.titleField || ''] || record.value?.name || props.doc?.recordName || ''
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
      await os.saveDoc(doctype.value!, props.doc!.recordName!, changes)
    }
  } catch (e) {
    saveError.value = (e as Error).message
  } finally {
    saving.value = false
  }
}

const saveLabel = computed(() => (saving.value ? 'Saving…' : isNew.value ? 'Create' : 'Save'))
const formMenu = [
  { label: 'Duplicate', onClick: () => {} },
  { label: 'Print', onClick: () => {} },
  { label: 'Delete', onClick: () => {} },
]
</script>

<template>
  <div class="flex h-full w-full flex-col overflow-hidden bg-surface-base [font-family:var(--font-sans)]">
    <!-- ===================== LIST ===================== -->
    <div v-if="isList" class="flex h-full flex-col">
      <!-- toolbar -->
      <div class="flex flex-shrink-0 items-center gap-2.5 border-b border-outline-gray-1 px-[14px] py-[9px]">
        <span class="inline-flex h-[22px] w-[22px] items-center justify-center rounded-md bg-surface-gray-3 text-ink-gray-7">
          <span :class="meta?.icon" class="size-[14px]"></span>
        </span>
        <span class="font-semibold text-[14px] text-ink-gray-8">{{ meta?.label }}</span>
        <span class="rounded-full bg-surface-gray-2 px-[7px] py-px text-[12px] text-ink-gray-4">{{ total }}</span>
        <div class="flex-1"></div>
        <div class="mr-1 flex items-center">
          <Avatar v-for="(p, i) in presence" :key="i" :label="p.label" size="sm"
            :style="{ marginLeft: i ? '-6px' : '0', boxShadow: '0 0 0 2px var(--surface-base)' }" :title="p.label + ' is viewing'" />
        </div>
        <Button variant="subtle" size="sm" label="Filter">
          <template #prefix><span class="lucide-filter size-[13px]"></span></template>
        </Button>
        <Button variant="subtle" size="sm" label="Sort" />
        <Button v-if="canCreate" variant="solid" size="sm" label="New" @click="onNew?.(doc!.doctype)">
          <template #prefix><span class="lucide-plus size-[14px]"></span></template>
        </Button>
      </div>
      <!-- saved view chips -->
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
        <span v-if="listState.loading" class="inline-flex items-center gap-1.5 text-[11px] text-ink-gray-5">Loading…</span>
        <span v-else class="inline-flex items-center gap-1.5 text-[11px] text-ink-green-7">
          <span class="h-1.5 w-1.5 rounded-full bg-surface-green-5"></span>Live
        </span>
      </div>
      <!-- table -->
      <div class="min-h-0 flex-1 overflow-auto">
        <div class="sticky top-0 z-10 grid h-[34px] items-center border-b border-outline-gray-1 bg-surface-gray-1 px-[14px]" :style="{ gridTemplateColumns: gridCols }">
          <span class="inline-flex"><span class="h-[13px] w-[13px] rounded-[3px] border-[1.5px] border-outline-gray-3"></span></span>
          <span v-for="(c, i) in columns" :key="i" class="flex items-center gap-1 text-[11px] font-medium text-ink-gray-5" :style="c.align">{{ c.label }}</span>
        </div>
        <!-- error / empty / loading states -->
        <div v-if="listState.error" class="px-[14px] py-[34px] text-center text-[13px] text-ink-red-6">{{ listState.error }}</div>
        <div v-else-if="!records.length && listState.loading" class="px-[14px] py-[34px] text-center text-[13px] text-ink-gray-4">Loading…</div>
        <div v-else-if="!records.length" class="px-[14px] py-[34px] text-center text-[13px] text-ink-gray-4">No {{ meta?.label }} records yet.</div>
        <!-- rows -->
        <div v-for="(r, ri) in records" :key="r.name || ri" class="grid min-h-10 cursor-pointer items-center border-b border-outline-gray-1 bg-surface-base px-[14px] hover:bg-surface-gray-1" @click="onOpen?.(doc!.doctype, r.name)"
          :style="{ gridTemplateColumns: gridCols }">
          <span class="inline-flex items-center gap-1.5"><span class="h-[13px] w-[13px] rounded-[3px] border-[1.5px] border-outline-gray-3"></span></span>
          <span v-for="(c, ci) in columns" :key="ci" class="flex items-center gap-1.5 overflow-hidden text-ellipsis whitespace-nowrap text-[13px] text-ink-gray-7" :style="c.align">
            <template v-for="cell in [cellFor(r, c)]" :key="c.key">
              <StatusPill v-if="cell.kind==='status'" :value="cell.display" :theme="cell.theme" />
              <span v-else-if="cell.kind==='primary'" class="font-medium text-ink-gray-8">{{ cell.display }}</span>
              <template v-else-if="cell.kind==='avatar'">
                <Avatar :label="cell.label" size="sm" />{{ cell.label }}
              </template>
              <template v-else>{{ cell.display }}</template>
            </template>
          </span>
        </div>
      </div>
      <!-- footer -->
      <div class="flex flex-shrink-0 items-center gap-3 border-t border-outline-gray-1 bg-surface-gray-1 px-[14px] py-[7px] text-[12px] text-ink-gray-5">
        <span>{{ records.length }} of {{ total }}</span>
        <div class="flex-1"></div>
        <span class="text-ink-gray-4">Rows per page: 100</span>
      </div>
    </div>

    <!-- ===================== FORM ===================== -->
    <div v-else-if="isForm" class="flex h-full flex-col">
      <!-- header -->
      <div class="flex flex-shrink-0 items-center gap-2.5 border-b border-outline-gray-1 px-4 py-[11px]">
        <div class="flex min-w-0 flex-col gap-0.5">
          <div class="flex items-center gap-1.5 text-[11px] text-ink-gray-4">
            <span>{{ meta?.label }}</span>
            <span class="lucide-chevron-right size-[11px]"></span>
            <span class="text-ink-gray-6">{{ isNew ? 'New' : record?.name }}</span>
          </div>
          <div class="flex items-center gap-2.5">
            <span class="text-lg font-semibold text-ink-gray-9">{{ formTitle }}</span>
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
      <div class="min-h-0 flex-1 overflow-auto px-[22px] py-[18px]">
        <div v-if="fieldMeta.error" class="text-[13px] text-ink-red-6">{{ fieldMeta.error }}</div>
        <div v-else-if="!isNew && docState.error" class="text-[13px] text-ink-red-6">{{ docState.error }}</div>
        <div v-else-if="fieldMeta.loading || (!isNew && docState.loading)" class="text-[13px] text-ink-gray-4">Loading…</div>
        <FormLayout v-else v-model:doc="formDoc" :layout="layout" />
      </div>
    </div>
  </div>
</template>
