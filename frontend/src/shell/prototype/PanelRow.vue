<!-- PROTOTYPE (#47378), variant C: one row of the panel's tree; choosing it opens its form beneath. -->
<template>
	<div
		:data-panel-row="row.key"
		:class="[
			'group/row flex h-7 cursor-pointer items-center gap-1.5 rounded-4 pr-1 text-sm',
			chosen ? 'bg-surface-gray-3' : 'hover:bg-surface-gray-2',
			row.hidden_by || row.marker ? 'opacity-60' : '',
		]"
		:style="{ paddingLeft: `${depth * 14 + 4}px` }"
		@click="choose"
	>
		<button
			v-if="container === RAIL && sidebarOf(row)"
			type="button"
			:class="['lucide-chevron-right size-3.5 shrink-0 text-ink-gray-5 transition', open ? 'rotate-90' : '']"
			aria-label="Show its sidebar"
			@click.stop="emit('toggle')"
		/>
		<span v-else class="size-3.5 shrink-0" />
		<Icon :name="iconFor(row)" class="shrink-0 text-ink-gray-6" />
		<span :class="['min-w-0 flex-1 truncate', row.item_type === 'Section' ? 'font-medium text-ink-gray-8' : 'text-ink-gray-7']">
			{{ nameOf(row) }}
		</span>
		<span class="shrink-0 text-xs text-ink-gray-4">{{ row.item_type }}</span>
		<Badge v-if="row.marker" :label="row.marker === 'no-access' ? 'No access' : 'View deleted'" theme="red" size="sm" />
		<span v-else-if="row.hidden_by" class="lucide-eye-off size-3.5 text-ink-gray-5" />
		<Badge v-else-if="row.origin !== 'app'" :label="ORIGIN_LABEL[row.origin]" size="sm" :theme="row.origin === 'site' ? 'blue' : 'orange'" />
		<button
			v-if="container !== RAIL"
			type="button"
			class="lucide-plus size-5 shrink-0 rounded-4 text-ink-gray-5 opacity-0 hover:bg-surface-gray-3 group-hover/row:opacity-100"
			:aria-label="`Add under ${nameOf(row)}`"
			@click.stop="adding = !adding"
		/>
		<Dropdown :options="rowMenu(container, row, { rename: choose, edit: choose })" align="end">
			<button type="button" class="lucide-ellipsis size-5 shrink-0 rounded-4 text-ink-gray-5 hover:bg-surface-gray-3" aria-label="Row menu" @click.stop />
		</Dropdown>
	</div>
	<div v-if="chosen && formOpen" class="my-1 rounded-8 border border-outline-gray-2 bg-surface-gray-1 p-3" :style="{ marginLeft: `${depth * 14}px` }">
		<RowForm :key="`${row.key}:${row.item_type}`" :container="container" :row="row" @done="formOpen = false" />
	</div>
	<div v-if="adding" :style="{ marginLeft: `${depth * 14 + 14}px` }">
		<div class="my-1 rounded-8 border border-outline-gray-2 bg-surface-gray-1 p-3">
			<RowForm :container="container" :parent-key="row.key" @done="adding = false" />
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { Badge, Dropdown } from "frappe-ui";
import Icon from "@/icons/Icon.vue";
import { type Container, type DraftRow, iconFor, nameOf, ORIGIN_LABEL, RAIL, selected, sidebarOf } from "./navDraft";
import { rowMenu } from "./navMenu";
import RowForm from "./RowForm.vue";

const props = defineProps<{ container: Container; row: DraftRow; depth: number; open?: boolean }>();
const emit = defineEmits<{ toggle: [] }>();

const adding = ref(false);
const chosen = computed(
	() => selected.value?.container === props.container && selected.value.key === props.row.key
);

// A new row is selected, so it is outlined in the live navigation, but its form opens on a click only.
const formOpen = ref(false);

function choose() {
	formOpen.value = !(chosen.value && formOpen.value);
	selected.value = { container: props.container, key: props.row.key };
}
</script>
