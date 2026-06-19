<script setup lang="ts">
// Registry-resolved view dispatcher: renders whichever component the registry maps the
// active view to (builtin list/form today; an applet-backed custom view via the same rail).
// Each view component is self-fetching — DoctypeView owns only the resolution and the
// uniform prop bundle, so a new view kind is a new component + a BUILTIN_VIEWS entry
// (see ./registry), never an edit here. Async-by-id (shallowRef + watch), mirroring how
// OSWindow resolves an applet surface; builtin resolution settles synchronously.
import { shallowRef, watch } from 'vue'
import type { Component } from 'vue'
import { resolveView } from './registry'
// Import macro types from the concrete module, not the @/types barrel: @vue/compiler-sfc's
// defineProps type resolver can't walk the barrel's `export *` (it trips on OsStore's
// ReturnType<> in data/types). tsc/vue-tsc handle the barrel fine for non-macro imports.
import type { ViewProps } from '@/config/types'

const props = defineProps<ViewProps>()

const view = shallowRef<Component | null>(null)
watch(
  () => [props.doctype, props.view] as const,
  async ([doctype, name]) => { view.value = doctype ? await resolveView(doctype, name) : null },
  { immediate: true },
)
</script>

<template>
  <component :is="view" v-if="view" v-bind="$props" />
</template>
