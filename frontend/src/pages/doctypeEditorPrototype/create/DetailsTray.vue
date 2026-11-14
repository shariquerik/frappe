<!-- PROTOTYPE (#47434), throwaway: Details' "Fields not on this layout" (#47262 E6), for ?tray=B and
     ?tray=C. With no field off the layout it draws nothing at all. B: a block under the form's last
     row, its fields as chips that drag onto the form or go to the end of the tab on a click.
     C: a count in the canvas's meta line that opens the same list in a popover below it.
     ?tray=A is in PanelAddField (the panel's first group, as on every other layout). -->
<template>
	<template v-if="rows.length">
		<div v-if="where === 'below'" class="mt-10 border-t border-outline-gray-1 pt-4" data-details-tray>
			<div class="flex h-7 items-center gap-1.5">
				<span class="text-base font-medium text-ink-gray-8">Fields not on this layout</span>
				<span class="text-sm text-ink-gray-5">{{ rows.length }}</span>
			</div>
			<p class="mb-3 text-p-sm text-ink-gray-5">They stay in the DocType, off the form. Drag one onto the form, or click it to add it at the end of this tab.</p>
			<Draggable
				:model-value="rows.map((one) => one.fieldname)"
				:item-key="(name: string) => name"
				:group="{ name: 'dte-fields', pull: true, put: false }"
				:sort="false"
				class="flex flex-wrap gap-2"
				:force-fallback="true"
				:fallback-on-body="false"
				fallback-class="dte-drag-fallback"
				ghost-class="dte-drop-line"
				@start="$emit('drag-start', $event)"
				@end="$emit('drag-end', $event)"
			>
				<template #item="{ element: name }">
					<div :data-fieldname="name">
						<Button variant="subtle" size="sm" :icon-left="typeIcon(field(name))" :label="field(name).label || name" class="cursor-grab" @click.stop="$emit('place', name)" />
					</div>
				</template>
			</Draggable>
		</div>
		<template v-else>
			·
			<Popover side="bottom" align="start" :auto-focus="false">
				<template #trigger="{ open }">
					<button type="button" class="rounded-3 text-ink-gray-7 underline decoration-[color:var(--outline-gray-3)] underline-offset-2 hover:text-ink-gray-9" :class="{ 'text-ink-gray-9': open }" data-details-tray-link>
						{{ rows.length }} {{ rows.length === 1 ? "field" : "fields" }} not on this layout
					</button>
				</template>
				<div class="flex w-[300px] flex-col p-1.5" data-details-tray-popover>
					<p class="px-2 pb-1.5 pt-2 text-p-sm text-ink-gray-5">Click one to add it at the end of this tab.</p>
					<ItemListRow
						v-for="row in rows"
						:key="row.fieldname"
						as="button"
						type="button"
						class="!min-h-8 text-left hover:bg-surface-gray-2"
						@click="$emit('place', row.fieldname)"
					>
						<template #prefix><span class="size-4 text-ink-gray-5" :class="typeIcon(row)" aria-hidden="true" /></template>
						<span class="block truncate text-ink-gray-8">{{ row.label || row.fieldname }}</span>
						<template #suffix><span class="text-sm text-ink-gray-5">{{ typeLabel(row.fieldtype, row.options) }}</span></template>
					</ItemListRow>
				</div>
			</Popover>
		</template>
	</template>
</template>

<script setup lang="ts">
import { computed, inject } from "vue";
// @ts-ignore, vuedraggable ships no bundled types
import Draggable from "vuedraggable";
import { Button, ItemListRow, Popover } from "frappe-ui";
import { EditorKey } from "../context";
import { typeLabel } from "./newDoctype";
import { typeIcon } from "./typeMenu";

defineProps<{ where: "below" | "meta" }>();
defineEmits<{ place: [fieldname: string]; "drag-start": [event: any]; "drag-end": [event: any] }>();
const editor = inject(EditorKey)!;
const field = (name: string) => editor.field(name)!;
const rows = computed(() => (editor.state.layout === "details" ? editor.unplaced.value.filter((one) => !one.hidden) : []));
</script>
