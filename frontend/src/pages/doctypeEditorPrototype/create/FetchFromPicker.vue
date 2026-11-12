<!-- PROTOTYPE (#47100), throwaway: the Fetch from row: "Customer › Customer Name", or "None". A
     click opens FetchMenu under the row, right edges together: a Link field of this DocType, then a
     field of its target. Writes `fetch_from` ("customer.customer_name"); a value the picker cannot
     read (no such Link field) shows as code and keeps its text. -->
<template>
	<Tooltip :text="text" :disabled="text.length < 27 || open">
		<button
			ref="button"
			type="button"
			class="flex h-7 w-full min-w-0 items-center gap-1.5 rounded-4 px-2 text-left text-base"
			:class="open ? 'bg-surface-gray-3' : 'hover:bg-surface-gray-2'"
			data-fetch-row
			@click="toggle"
		>
			<span v-if="!value" class="min-w-0 flex-1 truncate text-ink-gray-5">None</span>
			<span v-else-if="!link" class="min-w-0 flex-1 truncate font-mono text-sm text-ink-gray-7">{{ value }}</span>
			<span v-else class="flex min-w-0 flex-1 items-center gap-1 text-ink-gray-8">
				<span class="shrink-0">{{ link.label || link.fieldname }}</span>
				<span class="shrink-0 text-ink-gray-4">›</span>
				<span class="min-w-0 truncate">{{ sourceLabel }}</span>
			</span>
			<span class="lucide-chevron-down size-4 shrink-0 text-ink-gray-5" aria-hidden="true" />
		</button>
	</Tooltip>
	<Popover v-if="button" :open="open" trigger="manual" :reference="button" side="bottom" align="end" @update:open="onPopover">
		<FetchMenu :links="links" :value="value" @pick="pick" @close="close" />
		<div v-if="value" class="border-t border-outline-gray-1 p-1.5">
			<button type="button" class="flex h-7 w-full items-center gap-2 rounded-4 px-2 text-left text-base text-ink-gray-7 hover:bg-surface-gray-3" @click="$emit('update', ''), close()">
				<span class="lucide-x size-4 text-ink-gray-5" aria-hidden="true" />
				Stop fetching
			</button>
		</div>
	</Popover>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { Popover, Tooltip } from "frappe-ui";
import { useDoctypeMeta } from "@framework/ui/useDoctypeMeta";
import type { EditorField } from "../editor";
import FetchMenu from "./FetchMenu.vue";
import { makeRoomBelow } from "./roomBelow";

const props = defineProps<{ value: string; links: EditorField[] }>();
const emit = defineEmits<{ update: [value: string] }>();

const button = ref<HTMLElement | null>(null);
const open = ref(false);
const link = computed(() => props.links.find((one) => one.fieldname === props.value.split(".")[0]));
const { meta } = useDoctypeMeta(() => link.value?.options ?? "");
const sourceLabel = computed(() => {
	const name = props.value.split(".")[1];
	return (meta.value?.fields ?? []).find((one) => one.fieldname === name)?.label ?? name;
});
const text = computed(() => (!props.value ? "None" : link.value ? `${link.value.label || link.value.fieldname} › ${sourceLabel.value}` : props.value));

function pick(one: EditorField, source: EditorField) {
	emit("update", `${one.fieldname}.${source.fieldname}`);
	close();
}

let closedAt = 0;
function onPopover(next: boolean) {
	if (next) return;
	open.value = false;
	closedAt = Date.now();
}
let release = () => {};
function toggle() {
	if (Date.now() - closedAt < 300) return;
	if (open.value) return close();
	release = makeRoomBelow(button.value, 400);
	open.value = true;
}
watch(open, (next) => !next && (release(), (release = () => {})));
function close() {
	open.value = false;
	button.value?.focus();
}
</script>
